import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
// Bundle TypeScript helpers offline so this test does not depend on native TS loading.
async function loadShared(name) {
 const result=await build({entryPoints:[fileURLToPath(new URL(`../supabase/functions/_shared/${name}.ts`,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const { authorize } = await loadShared('authorization');
const { createMediaHandler } = await loadShared('media');
const { authorizePush } = await loadShared('pushAuthorization');
const user='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222';
const vars={ SUPABASE_URL:'https://offline.supabase.co', SUPABASE_SERVICE_ROLE_KEY:'mock-service', CLOUDFLARE_ACCOUNT_ID:'mock-account', CLOUDFLARE_STREAM_TOKEN:'mock-cf' };
const env={ get:name=>vars[name] };
const req=(body={},token='mock-user',method='POST')=>new Request('https://offline.example/function',{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify(body)}:{})});
function setup({ admin=false, owner=user, valid=true, missing=false, event={}, recipient='농부', userInfo={} }={}) {
 const calls=[];
 const fetcher=async(url,options={})=>{
  calls.push({url:String(url),options});
  if(String(url).includes('/auth/'))return Response.json({id:user,...userInfo},{status:valid?200:401});
  if(String(url).includes('/admin_roles'))return Response.json(admin?[{role:'admin'}]:[]);
  if(String(url).includes('/messages?')||String(url).includes('/lounge_messages?'))return Response.json([event]);
  if(String(url).includes('/users?'))return Response.json([{name:recipient}]);
  if(options.method==='DELETE')return new Response(null,{status:204});
  if(options.method==='POST')return Response.json({success:true,result:{uploadURL:'https://upload.example/url',id:'asset',uid:'asset'}});
  return missing?new Response(null,{status:404}):Response.json({success:true,result:{creator:owner}});
 };
 return {calls,env,fetcher};
}
test('auth rejects public anon/invalid JWT and unsafe methods; internal work accepts only service credential',async()=>{
 const s=setup({valid:false});assert.equal((await authorize(req({},'mock-anon'),'user',s)).status,401);
 const t=setup();assert.equal((await authorize(req(),'internal',t)).status,401);assert.equal(t.calls.length,0);
 assert.equal((await authorize(req({},'mock-service'),'internal',t)).service,true);
 assert.equal((await authorize(req({},'mock-user','GET'),'user',t)).status,405);
 assert.equal((await authorize(req({},'mock-user','OPTIONS'),'internal',t)).status,200);
 const anon=setup({userInfo:{is_anonymous:true}});assert.equal((await authorize(req(),'user',anon)).status,401);
});
test('member role cannot be elevated with user_metadata; admins require verified role lookup',async()=>{
 const s=setup({userInfo:{user_metadata:{role:'super_admin'}}});assert.equal((await authorize(req(),'admin',s)).status,403);
 assert.equal((await authorize(req(),'admin',setup({admin:true}))).admin,true);
 const fail=setup();fail.fetcher=async()=>{throw new Error('offline');};assert.equal((await authorize(req(),'user',fail)).status,503);
});
for(const kind of ['image','video']) {
 test(`${kind} deletion denies another owner and legacy assets, permits owner/admin without trusting request ownership`,async()=>{
  for(const owner of [other,undefined]){
   const s=setup({owner:owner===undefined?null:owner});const res=await createMediaHandler(kind,'delete',s)(req({imageId:'asset',uid:'asset',userId:user,creator:user}));assert.equal(res.status,403);assert.equal(s.calls.filter(x=>x.options.method==='DELETE').length,0);
  }
  for(const options of [{owner:user},{owner:other,admin:true}]){const s=setup(options);assert.equal((await createMediaHandler(kind,'delete',s)(req({imageId:'asset',uid:'asset'}))).status,200);assert.equal(s.calls.filter(x=>x.options.method==='DELETE').length,1);}
  const s=setup();assert.equal((await createMediaHandler(kind,'delete',s)(req({imageId:'../other',uid:'../other'}))).status,400);
 });
 test(`${kind} direct upload pins creator to verified identity and bounds request`,async()=>{
  const s=setup();const body=kind==='image'?{creator:other,metadata:{creator:other,size:1024,type:'image/jpeg'}}:{creator:other,maxDurationSeconds:60};
  assert.equal((await createMediaHandler(kind,'upload',s)(req(body))).status,200);
  const sent=s.calls.find(x=>x.options.method==='POST').options.body;
  assert.equal(kind==='image'?sent.get('creator'):JSON.parse(sent).creator,user);
  const invalid=kind==='image'?{metadata:{size:999999999,type:'image/jpeg'}}:{maxDurationSeconds:121};
  const t=setup();assert.equal((await createMediaHandler(kind,'upload',t)(req(invalid))).status,400);assert.equal(t.calls.filter(x=>x.options.method==='POST').length,0);
 });
}
test('push broadcast requires admin, individual DM uses owned stored event and canonical content',async()=>{
 const s=setup();assert.equal((await authorizePush(req(),{title:'broadcast',body:'forged'},s)).status,403);
 const now=Date.now();const d=setup({event:{sender_id:user,receiver_id:other,content:'actual message',created_at:new Date(now).toISOString()}});
 const result=await authorizePush(req(),{tag:'dm',userId:other,referenceId:'123',body:'forged',title:'forged'},d);
 assert.equal(result.body,'actual message');assert.equal(result.url,`/dm/${user}`);
 const f=setup({event:{sender_id:other,receiver_id:user,content:'private',created_at:new Date(now).toISOString()}});
 assert.equal((await authorizePush(req(),{tag:'dm',userId:other,referenceId:'123'},f)).status,403);
 const old=setup({event:{sender_id:user,receiver_id:other,content:'old',created_at:'2020-01-01'}});
 assert.equal((await authorizePush(req(),{tag:'dm',userId:other,referenceId:'123'},old)).status,403);
 const admin=setup({admin:true});assert.equal((await authorizePush(req(),{title:'notice',body:'official',url:'/community'},admin)).title,'notice');
 assert.equal((await authorizePush(req(),{title:'notice',body:'official',url:'//evil.example'},admin)).status,400);
});
test('mention push requires actual @recipient in a recent own lounge message',async()=>{
 for(const [text,allowed] of [['안녕 @농부 네',true],['@농부사칭',false],['그냥 글',false]]){
  const s=setup({event:{user_id:user,content:text,created_at:new Date().toISOString()}});
  const result=await authorizePush(req(),{tag:'mention',userId:other,referenceId:'message-id'},s);assert.equal(result instanceof Response,!allowed);
 }
});
async function loadWebhook(secret) {
 const result=await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/openclaw-response/index.ts',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',plugins:[{name:'no-live-sdk',setup(b){b.onResolve({filter:/^(jsr:|https:\/\/esm\.sh\/)/},()=>({path:'sdk',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export function createClient(){throw new Error("must not touch DB");}'}));}}]});
 let handler;
 runInNewContext(result.outputFiles[0].text,{Deno:{env:{get:n=>n==='OPENCLAW_RESPONSE_TOKEN'?secret:''},serve:h=>{handler=h;}},Response,TextEncoder,console});return handler;
}
test('webhook fails closed without secret and rejects wrong token before DB work',async()=>{
 assert.equal((await (await loadWebhook(''))(req())).status,503);
 assert.equal((await (await loadWebhook('mock-webhook'))(req())).status,401);
});
