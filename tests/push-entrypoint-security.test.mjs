import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
const bundle=await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/send-push/index.ts',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',plugins:[{name:'offline-providers',setup(b){
 b.onResolve({filter:/^(jsr:|npm:)/},args=>({path:args.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path.includes('edge-runtime')?'':args.path.includes('web-push')?'export default {generateRequestDetails(sub,payload){globalThis.__mock.payloads.push(JSON.parse(payload));return{endpoint:sub.endpoint,method:"POST",headers:{},body:payload};}}':'export const createClient=()=>({from(){globalThis.__mock.subscriptionReads++;return{select(){return this},eq(){return this},then(resolve){return Promise.resolve({data:globalThis.__mock.subscriptions,error:null}).then(resolve)}}}});'}));
}}]});
const user='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function worker(mock){
 let handler;
 runInNewContext(bundle.outputFiles[0].text,{__mock:mock,Deno:{env:{get:n=>({SUPABASE_URL:'https://offline.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock-service',VAPID_PUBLIC_KEY:'mock-public',VAPID_PRIVATE_KEY:'mock-private'})[n]},serve:h=>{handler=h;}},URL,Response,Request,TextEncoder,TextDecoder,AbortSignal,console:{log(){},error(){}},fetch:async(url,opts={})=>{
  const path=new URL(url).pathname;
  if(path==='/auth/v1/user')return Response.json({id:user});
  if(path.includes('admin_roles'))return Response.json([]);
  if(path.includes('/messages'))return Response.json([{id:123,sender_id:user,receiver_id:other,content:'actual',created_at:new Date().toISOString()}]);
  if(path.includes('/users'))return Response.json([{name:'농부'}]);
  if(path.endsWith('/reserve_security_action')){
   if(mock.unavailable)return new Response(null,{status:503});
   const {p_event_key}=JSON.parse(opts.body);
   if(mock.events.has(p_event_key))return Response.json({allowed:false,reason:'duplicate'});
   mock.events.add(p_event_key);return Response.json({allowed:true});
  }
  if(String(url).startsWith('https://fcm.googleapis.com/')){mock.deliveries++;return new Response(null,{status:201});}
  throw new Error('unexpected real outbound request');
 }});
 return body=>handler(new Request('https://offline.example/push',{method:'POST',headers:{Authorization:'Bearer mock-user'},body:JSON.stringify(body)}));
}
const setup=()=>({events:new Set(),deliveries:0,subscriptionReads:0,payloads:[],subscriptions:[{id:'sub',endpoint:'https://fcm.googleapis.com/fcm/send/mock',keys:{p256dh:'mock',auth:'mock'}}]});
test('real push entrypoint accepts old/new contracts across separate workers but sends canonical event only once',async()=>{
 const s=setup(),oldWorker=worker(s),newWorker=worker(s);
 assert.equal((await oldWorker({tag:'dm',userId:other,body:'actual',title:'forged',url:'/forged'})).status,200);
 const duplicate=await newWorker({tag:'dm',userId:other,referenceId:123});assert.equal((await duplicate.json()).duplicate,true);
 assert.equal(s.deliveries,1);assert.equal(s.subscriptionReads,1);assert.deepEqual(JSON.parse(JSON.stringify(s.payloads)),[{title:'💬 농부',body:'actual',url:`/dm/${user}`}]);
});
test('unavailable quota prevents subscription lookup/delivery; attacker endpoints never leave server',async()=>{
 const missing=setup();missing.unavailable=true;
 assert.equal((await worker(missing)({tag:'dm',userId:other,referenceId:123})).status,503);assert.equal(missing.subscriptionReads,0);assert.equal(missing.deliveries,0);
 const unsafe=setup();unsafe.subscriptions[0].endpoint='https://127.0.0.1/private';
 const result=await worker(unsafe)({tag:'dm',userId:other,referenceId:123});assert.equal((await result.json()).failed,1);assert.equal(unsafe.deliveries,0);assert.equal(unsafe.payloads.length,0);
});
