import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
async function shared(name) {
 const result=await build({entryPoints:[fileURLToPath(new URL(`../supabase/functions/_shared/${name}.ts`,import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
 return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}
const {authorizePush}=await shared('pushAuthorization');
const {reserveSecurityAction}=await shared('securityQuota');
const {trustedPushEndpoint}=await shared('pushEndpoint');
const {readBoundedJSON}=await shared('requestBody');
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const vars={SUPABASE_URL:'https://offline.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock-service',CLOUDFLARE_ACCOUNT_ID:'mock-account',CLOUDFLARE_STREAM_TOKEN:'mock-provider'};
const env={get:k=>vars[k]};
const request=body=>new Request('https://offline.example/push',{method:'POST',headers:{Authorization:'Bearer mock-user'},body:JSON.stringify(body)});
const event={id:123,sender_id:user,receiver_id:other,content:'실제 메시지',created_at:new Date().toISOString()};
function setup(rows=[event],quota={allowed:true}) {
 const calls=[];
 return {env,calls,fetcher:async(url,opts={})=>{
  calls.push({url:String(url),opts});
  if(String(url).includes('/auth/v1/user'))return Response.json({id:user});
  if(String(url).includes('/admin_roles'))return Response.json([]);
  if(String(url).includes('/rpc/reserve_security_action'))return Response.json(quota);
  if(String(url).includes('/users?'))return Response.json([{name:'농부'}]);
  if(String(url).includes('/messages?')||String(url).includes('/lounge_messages?'))return Response.json(rows);
  throw new Error('unexpected outbound request');
 }};
}
test('old DM payload resolves a recent own stored event and discards forged title and URL',async()=>{
 const s=setup();
 const result=await authorizePush(request({}),{tag:'dm',userId:other,title:'가짜 관리자',body:'실제 메시지',url:'/evil'},s);
 assert.equal(result.title,'💬 농부');assert.equal(result.url,`/dm/${user}`);assert.equal(result.eventKey,`dm:123:${other}`);
 const lookup=s.calls.find(c=>c.url.includes('/messages?')).url;
 assert.match(lookup,new RegExp(`sender_id=eq.${user}`));assert.match(lookup,/created_at=gte/);assert.match(lookup,/limit=50/);
});
test('old-client fallback rejects absent, ambiguous, stale, foreign and mismatching events',async()=>{
 for(const rows of [[],[event,event],[{...event,created_at:'2020-01-01'}],[{...event,sender_id:other}],[{...event,receiver_id:user}],[{...event,content:'다른 내용'}]]){
  const result=await authorizePush(request({}),{tag:'dm',userId:other,body:'실제 메시지'},setup(rows));assert.equal(result.status,403);
 }
});
test('old and new payloads share a canonical event key; hidden/forged mentions never notify',async()=>{
 const old=await authorizePush(request({}),{tag:'dm',userId:other,body:'실제 메시지'},setup());
 const modern=await authorizePush(request({}),{tag:'dm',userId:other,referenceId:123},setup());assert.equal(old.eventKey,modern.eventKey);
 for(const content of ['@농부사칭 안녕','안녕']){
  const result=await authorizePush(request({}),{tag:'mention',userId:other,referenceId:'abc'},setup([{id:'abc',user_id:user,content,created_at:event.created_at}]));assert.equal(result.status,403);
 }
 const hidden=await authorizePush(request({}),{tag:'mention',userId:other,referenceId:'abc'},setup([{id:'abc',user_id:user,content:'@농부 안녕',created_at:event.created_at,is_hidden:true}]));assert.equal(hidden.status,403);
});
test('durable reservation distinguishes duplicate/rate limit and fails closed on missing/malformed DB',async()=>{
 for(const [result,status]of [[{reason:'duplicate'},200],[{reason:'rate_limit'},429],[{},503]]){
  const response=await reserveSecurityAction(user,'push-event','dm:123',30,60,setup([],result));assert.equal(response.status,status);
 }
 assert.equal(await reserveSecurityAction(user,'push-event','dm:123',30,60,setup()),null);
 for(const fetcher of [async()=>{throw new Error('unavailable');},async()=>new Response(null,{status:404})])assert.equal((await reserveSecurityAction(user,'push-event','x',30,60,{env,fetcher})).status,503);
});
test('push egress rejects internal/arbitrary URLs and accepts known browser push services',()=>{
 for(const url of ['https://fcm.googleapis.com/fcm/send/x','https://updates.push.services.mozilla.com/wpush/v2/x','https://web.push.apple.com/x','https://wns2-am2p.notify.windows.com/x'])assert.equal(trustedPushEndpoint(url),true);
 for(const url of ['http://fcm.googleapis.com/x','https://fcm.googleapis.com.evil.example/x','https://127.0.0.1/x','https://[::1]/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com:8443/x','https://evil.example/x'])assert.equal(trustedPushEndpoint(url),false);
});
test('request byte limit stops a chunked stream without trusting content-length',async()=>{
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(12001));},cancel(){cancelled=true;}});
 const req=new Request('https://offline.example',{method:'POST',body:stream,duplex:'half'});
 assert.equal((await readBoundedJSON(req)).status,413);assert.equal(cancelled,true);
 assert.deepEqual(await readBoundedJSON(request({hello:'농부'})),{hello:'농부'});
 for(const body of ['{','[]','null'])assert.equal((await readBoundedJSON(new Request('https://offline.example',{method:'POST',body}))).status,400);
});
