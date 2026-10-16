import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const b=await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/_shared/previewFetch.ts',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node'});
const {previewURL,canFetchPreview,fetchPreviewText}=await import(`data:text/javascript;base64,${Buffer.from(b.outputFiles[0].text).toString('base64')}`);
test('preview rejects unsafe URLs and never fetches unknown or lookalike hosts',async()=>{
 for(const url of ['http://naver.com','https://127.0.0.1','https://[::1]','https://local.test','https://u:p@naver.com','https://naver.com:8443'])assert.throws(()=>previewURL(url));
 for(const url of ['https://naver.com.evil.example','https://attacker.example']){assert.equal(canFetchPreview(previewURL(url)),false);let called=false;await assert.rejects(fetchPreviewText(url,async()=>{called=true;}));assert.equal(called,false);}
});
test('allowed redirects are checked at every hop, time bounded and manual',async()=>{
 let calls=0;
 await assert.rejects(fetchPreviewText('https://news.naver.com',async(url,options)=>{calls++;assert.equal(options.redirect,'manual');assert.ok(options.signal);return new Response(null,{status:302,headers:{location:'https://127.0.0.1'}});}));assert.equal(calls,1);
 calls=0;assert.equal(await fetchPreviewText('https://news.naver.com',async()=>{calls++;return calls===1?new Response(null,{status:302,headers:{location:'https://n.news.naver.com/article/1'}}):new Response('<title>ok</title>',{headers:{'content-type':'text/html'}});}),'<title>ok</title>');assert.equal(calls,2);
});
test('preview limits response type and byte size before parsing HTML',async()=>{
 await assert.rejects(fetchPreviewText('https://news.naver.com',async()=>new Response('image',{headers:{'content-type':'image/png'}})));
 await assert.rejects(fetchPreviewText('https://news.naver.com',async()=>new Response('x'.repeat(1024*1024+1),{headers:{'content-type':'text/html'}})));
});
test('actual link-preview endpoint returns an unknown-host plain card without any outbound request',async()=>{
 const result=await build({entryPoints:[fileURLToPath(new URL('../supabase/functions/link-preview/index.ts',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',plugins:[{name:'offline-entry-mocks',setup(plugin){
  plugin.onResolve({filter:/^https:/},args=>({path:args.path,namespace:'mock'}));
  plugin.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path.includes('cheerio')?'export function load(){throw new Error("parser must not run");}':'export function serve(handler){globalThis.__previewHandler=handler;}'}));
 }}]});
 const {runInNewContext}=await import('node:vm');let calls=0;
 const context={Response,URL,TextDecoder,console,fetch(){calls++;throw new Error('network must not run');}};
 runInNewContext(result.outputFiles[0].text,context);
 const out=await context.__previewHandler(new Request('https://offline.example',{method:'POST',body:JSON.stringify({url:'https://attacker.example/post'})}));
 assert.equal(out.status,200);assert.equal((await out.json()).title,'attacker.example');assert.equal(calls,0);
});
