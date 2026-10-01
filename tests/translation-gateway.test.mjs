import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createHandler, decodeAudio, normalizeSupabaseURL } from '../api/translation.js';
const env = { GEMINI_TRANSLATION_API_KEY: 'mock-provider', SUPABASE_URL: 'https://mock.supabase.co', SUPABASE_ANON_KEY: 'mock-anon', TRANSLATION_COOKIE_SECRET: 'mock-cookie-secret-for-offline-tests-only', TRANSLATION_RPC_SECRET: 'mock-rpc-secret-for-offline-tests-only', VERCEL: '1' };
const job = '12345678-1234-4234-8234-123456789abc';
function wav() { const b=Buffer.alloc(48); b.write('RIFF'); b.writeUInt32LE(40,4); b.write('WAVE',8); b.write('fmt ',12); b.writeUInt32LE(16,16); b.writeUInt16LE(1,20); b.writeUInt16LE(1,22); b.writeUInt32LE(24000,24); b.writeUInt32LE(48000,28); b.writeUInt16LE(2,32); b.writeUInt16LE(16,34); b.write('data',36); b.writeUInt32LE(4,40); return b; }
const audio = {steps:[{type:'model_output',content:[{type:'audio',data:wav().toString('base64')}]}]};
function setup({ auth=200, quota='reserved', providerStatus=200, providerData, cachedResult, vars={} }={}) {
  const calls=[]; const requests=[];
  const fetcher=async (url, options) => {
    calls.push(url); requests.push(options);
    if(url.includes('/auth/')) return new Response(JSON.stringify({id:'mock-user'}),{status:auth});
    if(url.includes('/rpc/')) {
      const envelope=JSON.parse(options.body);
      assert.equal(envelope.p_signature,createHmac('sha256',env.TRANSLATION_RPC_SECRET).update(envelope.p_payload).digest('hex'));
      const payload=JSON.parse(envelope.p_payload);
      assert.equal(payload.identity.length,64);
      return Response.json({status:payload.operation.startsWith('finish')||payload.operation.startsWith('fail')?'ok':quota,result:cachedResult});
    }
    return Response.json(providerData || (url.endsWith('/interactions')?audio:{candidates:[{content:{parts:[{text:JSON.stringify({targetTranslation:'ສະບາຍດີ',backTranslation:'안녕하세요'})}]}}]}),{status:providerStatus});
  };
  const handle=createHandler({fetcher,env:{...env,...vars}});
  async function run(body={action:'translate',text:'안녕',fromLang:'ko',toLang:'lo',requestId:job}, headers={}, method='POST') {
    const response={headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(value){this.body=value;return this;},send(value){this.body=value;return this;}};
    await handle({method,body,headers:{'content-type':'application/json',host:'www.seonnam.com','x-vercel-forwarded-for':'203.0.113.1',...headers}},response);
    return response;
  }
  return {run,calls,requests};
}
test('guest translates without login, signed HttpOnly cookie and two reserved provider units',async()=>{
  const {run,requests}=setup();const res=await run();assert.equal(res.code,200);assert.equal(res.body.requestId,job);
  assert.match(res.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
  const reserve=JSON.parse(JSON.parse(requests[0].body).p_payload);assert.equal(reserve.guest,true);assert.equal(reserve.ip.length,64);assert.equal(reserve.limits.daily,3);
  assert.equal(requests[1].headers['x-goog-api-key'],'mock-provider');
});
test('verified member session is validated before quota/provider',async()=>{const {run,calls}=setup();const res=await run(undefined,{authorization:'Bearer mock.jwt'});assert.equal(res.code,200);assert.match(calls[0],/auth/);});
test('invalid member auth never downgrades to guest or invokes provider',async()=>{const {run,calls}=setup({auth:401});assert.equal((await run(undefined,{authorization:'Bearer mock.jwt'})).code,401);assert.equal(calls.length,1);});
test('guest uses only trusted Vercel IP and rejects off-platform headers',async()=>{const {run,calls}=setup({vars:{VERCEL:'0'}});assert.equal((await run()).code,503);assert.equal(calls.length,0);});
test('guest character limit counts Unicode characters and quota cannot be bypassed by request model',async()=>{const a=setup();assert.equal((await a.run({action:'translate',text:'가'.repeat(101),fromLang:'ko',toLang:'lo',requestId:job})).code,400);assert.equal(a.calls.length,0);const b=setup();assert.equal((await b.run({action:'translate',text:'hi',fromLang:'ko',toLang:'lo',requestId:job,model:'anything'})).code,400);});
test('durable quota unavailable or denied fails closed before paid request',async()=>{const {run,calls}=setup({quota:'limited'});assert.equal((await run()).code,429);assert.equal(calls.length,1);});
test('TTS uses Interactions API, verbatim transcript, WAV and approved voice',async()=>{const {run,requests}=setup();const res=await run({action:'tts',text:'ສະບາຍດີ',langCode:'lo',requestId:job});assert.equal(res.code,200);assert.equal(res.headers['Content-Type'],'audio/wav');assert.equal(res.body.toString('ascii',0,4),'RIFF');const body=JSON.parse(requests[1].body);assert.equal(body.model,'gemini-3.8-flash-tts');assert.equal(body.store,false);assert.equal(body.generation_config.max_output_tokens,2000);assert.equal(body.input[0].content[0].text,'ສະບາຍດີ');assert.equal(body.response_format.mime_type,'audio/wav');});
test('pending and failed requests do not repeat paid calls',async()=>{for(const [quota,code] of [['pending',409],['failed',502],['invalid',400]]){const {run,calls}=setup({quota});assert.equal((await run()).code,code);assert.equal(calls.length,1);}});
test('provider errors are sanitized and fail job with no automatic retry',async()=>{const {run,calls}=setup({providerStatus:403,providerData:{error:{message:'SECRET PROVIDER DETAILS'}}});const res=await run();assert.equal(res.code,502);assert.ok(!JSON.stringify(res.body).includes('SECRET'));assert.equal(calls.filter(url=>url.includes('googleapis')).length,1);});
test('unknown model/voice or missing secret fails closed',async()=>{for(const vars of [{GEMINI_TTS_VOICE:'fake'},{GEMINI_TTS_MODEL:'fake'},{TRANSLATION_RPC_SECRET:''}]){const {run,calls}=setup({vars});assert.equal((await run()).code,503);assert.equal(calls.length,0);}});
test('raw PCM cannot be incorrectly labeled WAV or MP3',()=>{assert.throws(()=>decodeAudio({steps:[{type:'model_output',content:[{type:'audio',data:Buffer.alloc(44).toString('base64')}]}]}));});
test('cross-origin requests and unsafe methods do not use provider',async()=>{const {run,calls}=setup();assert.equal((await run(undefined,{origin:'https://evil.example'})).code,403);assert.equal((await run(undefined,{},'GET')).code,405);assert.equal(calls.length,0);});
test('RPC schema restricts table access, verifies signature, reserves global cost and isolates owner',async()=>{const sql=await readFile(new URL('../supabase/migrations/20260930_translation_quota.sql',import.meta.url),'utf8');for(const fragment of ['extensions.hmac','pg_advisory_xact_lock','j.identity <> owner',"'cost',2","interval '15 minutes'",'revoke all on all tables'])assert.ok(sql.includes(fragment));});

test('cached translation and WAV replay make no new provider call',async()=>{
  const text=setup({quota:'cached',cachedResult:{targetTranslation:'cached',backTranslation:'원문'}});assert.equal((await text.run()).body.targetTranslation,'cached');assert.equal(text.calls.length,1);
  const voice=setup({quota:'cached',cachedResult:{audio:wav().toString('base64')}});assert.equal((await voice.run({action:'tts',text:'cached',langCode:'lo',requestId:job})).code,200);assert.equal(voice.calls.length,1);
});
test('signed cookie keeps identity; edited cookie cannot impersonate it',async()=>{
  const {run,requests}=setup();const first=await run();const cookie=first.headers['Set-Cookie'].split(';')[0];await run(undefined,{cookie});await run(undefined,{cookie:cookie.replace(/.$/,'x')});
  const ids=requests.filter(r=>r.body?.includes('p_payload')).map(r=>JSON.parse(JSON.parse(r.body).p_payload)).filter(p=>p.operation==='translate').map(p=>p.identity);assert.equal(ids[0],ids[1]);assert.notEqual(ids[1],ids[2]);
});

test('public Supabase client configuration is reused when server names are absent',async()=>{
  const {run,calls,requests}=setup({vars:{SUPABASE_URL:undefined,SUPABASE_ANON_KEY:undefined,VITE_SUPABASE_URL:'https://public-config.supabase.co',VITE_SUPABASE_ANON_KEY:'mock-public-anon'}});
  assert.equal((await run(undefined,{authorization:'Bearer mock.jwt'})).code,200);
  assert.match(calls[0],/^https:\/\/public-config\.supabase\.co\/auth\//);
  assert.equal(requests[0].headers.apikey,'mock-public-anon');
  assert.equal(requests[1].headers.apikey,'mock-public-anon');
});
test('explicit server Supabase configuration takes priority over public fallback',async()=>{
  const {run,calls,requests}=setup({vars:{VITE_SUPABASE_URL:'https://ignored.supabase.co',VITE_SUPABASE_ANON_KEY:'ignored-public-anon'}});
  assert.equal((await run(undefined,{authorization:'Bearer mock.jwt'})).code,200);
  assert.match(calls[0],/^https:\/\/mock\.supabase\.co\/auth\//);
  assert.equal(requests[0].headers.apikey,'mock-anon');
});
test('provider and signing secrets never fall back to VITE variables',async()=>{
  for(const name of ['GEMINI_TRANSLATION_API_KEY','TRANSLATION_COOKIE_SECRET','TRANSLATION_RPC_SECRET']) {
    const {run,calls}=setup({vars:{[name]:undefined,['VITE_'+name]:'mock-public-value-must-never-be-used'}});
    assert.equal((await run()).code,503);assert.equal(calls.length,0);
  }
});

test('Supabase root URL accepts surrounding whitespace and a trailing slash',async()=>{
  assert.equal(normalizeSupabaseURL('  https://mock.supabase.co/  '),'https://mock.supabase.co');
  const {run,calls}=setup({vars:{SUPABASE_URL:'  https://mock.supabase.co/  '}});
  assert.equal((await run(undefined,{authorization:'Bearer mock.jwt'})).code,200);
  assert.equal(calls[0],'https://mock.supabase.co/auth/v1/user');
});
test('Supabase URL rejects credentials, alternate hosts, paths, queries and ports',()=>{
  for(const value of ['http://mock.supabase.co','https://evil.example','https://mock.supabase.co.evil.example','https://user:password@mock.supabase.co','https://mock.supabase.co:444','https://mock.supabase.co/path','https://mock.supabase.co?x=1','https://mock.supabase.co#fragment','https://evil.mock.supabase.co','https://mock.supabase.co/../private','']) assert.equal(normalizeSupabaseURL(value),null);
});
test('invalid explicit Supabase URL never silently selects another project',async()=>{
  const {run,calls}=setup({vars:{SUPABASE_URL:'https://wrong.example',VITE_SUPABASE_URL:'https://mock.supabase.co'}});
  assert.equal((await run()).code,503);assert.equal(calls.length,0);
});
