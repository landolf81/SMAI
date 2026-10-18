import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { getPublicPost, serverPostMetadata } from '../lib/public-post.js';
import { trustedImageUrl, representativePhoto, fetchPhoto, renderPostCard } from '../lib/post-card.js';
import { publicPostMetadata, unavailableMetadata, isPublicPost, contentVersion, validPostId } from '../src/utils/postShareMetadata.js';
import { injectShareHead } from '../lib/share-html.js';
import { applyShareMetadata } from '../src/utils/shareDocument.js';
import render from '../api/render.js';
import share from '../api/share.js';
const post = { id:299,title:'새 작기 준비, PO 필름은 씻고 쓸까?',description:'공개 내용',photo:null,is_private:false,is_hidden:false,status:'published',updated_at:'2026-10-16' };
const photoUrl = 'https://zynlhezlaxvolpptruiu.supabase.co/storage/v1/object/public/posts/sample/photo.png';
const env = { VITE_SUPABASE_URL:'https://zynlhezlaxvolpptruiu.supabase.co',VITE_SUPABASE_ANON_KEY:'sb_publishable_test' };
function responseRecorder() { return { statusCode:200,headers:{},setHeader(n,v){this.headers[n.toLowerCase()]=v;},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;},end(body){this.body=body;return this;} }; }
async function withFetch(fn, fetchImpl) { const old=global.fetch;const saved={...process.env};global.fetch=fetchImpl;Object.assign(process.env,env);try{return await fn();}finally{global.fetch=old;process.env=saved;} }

test('public lookup uses anonymous key, a field allowlist, hidden/private/published filters, no caller session',async()=>{
 let called=false;
 const row=await getPublicPost('299',{env,fetchImpl:async(url,opts)=>{called=true;url=new URL(url);assert.equal(url.hostname,'zynlhezlaxvolpptruiu.supabase.co');assert.equal(url.searchParams.get('id'),'eq.299');assert.match(url.searchParams.get('and'),/is_private/);assert.match(url.searchParams.get('and'),/status.eq.published/);assert.doesNotMatch(url.searchParams.get('select'),/user_id|latitude|longitude|users|\*/);assert.equal(opts.headers.Authorization,'Bearer sb_publishable_test');assert.equal(opts.redirect,'manual');assert.equal(opts.headers['Cache-Control'],'no-store');return Response.json([post]);}});
 assert.equal(row.title,post.title);assert.ok(called);
});
test('hidden, private, draft, deleted and absent rows are not public even if upstream misbehaves',async()=>{
 for(const row of [null,{...post,is_hidden:true},{...post,is_private:true},{...post,status:'draft'},{...post,status:'deleted'},{...post,deleted_at:'2026-10-18'},{...post,is_deleted:true}]){
 assert.equal(isPublicPost(row),false);assert.equal(publicPostMetadata(row).available,false);
 assert.equal(await getPublicPost('299',{env,fetchImpl:async()=>Response.json(row?[row]:[])}),null);
 }
});
test('invalid ids and privileged or foreign project configuration fail closed',async()=>{
 let calls=0; const fetchImpl=async()=>{calls++;return Response.json([post]);};
 for(const id of ['../../etc/passwd','299&select=*','0','299/1','']) { assert.equal(validPostId(id),false);assert.equal(await getPublicPost(id,{env,fetchImpl}),null); }
 assert.equal(calls,0);
 for(const e of [{...env,VITE_SUPABASE_ANON_KEY:'sb_secret_nope'},{...env,VITE_SUPABASE_ANON_KEY:`a.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.c`},{...env,VITE_SUPABASE_URL:'https://127.0.0.1'}]) await assert.rejects(getPublicPost('299',{env:e,fetchImpl}));
});
test('SSRF: exact trusted hosts/public paths, no userinfo, redirects, SVG, queries or arbitrary schemes',async()=>{
 assert.equal(trustedImageUrl(photoUrl),photoUrl);
 for(const url of ['http://127.0.0.1/a.png','https://169.254.169.254/latest/meta-data','file:///etc/passwd','https://evil.com/a.png','https://zynlhezlaxvolpptruiu.supabase.co.evil.com/a.png','https://user:pass@zynlhezlaxvolpptruiu.supabase.co/storage/v1/object/public/posts/a.png','https://zynlhezlaxvolpptruiu.supabase.co/storage/v1/object/sign/posts/a.png',photoUrl+'?url=http://127.0.0.1',photoUrl.replace('photo.png','%2e%2e%2fa.png'),photoUrl.replace('.png','.svg')])assert.equal(trustedImageUrl(url),null,url);
 let calls=0;assert.equal(await fetchPhoto('https://evil.com/a.png',async()=>{calls++;}),null);assert.equal(calls,0);
 assert.equal(await fetchPhoto(photoUrl,async(u,o)=>{assert.equal(o.redirect,'error');throw new Error('redirect');}),null);
 assert.equal(representativePhoto({...post,photo:JSON.stringify(['https://evil.com/a.png',photoUrl])}),photoUrl);
});
test('photo failures, type and byte limits return safe fallback input',async()=>{
 for(const result of [new Response('<svg><image href="file:///etc/passwd"/></svg>',{headers:{'content-type':'image/png'}}),new Response('bad',{status:404}),new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}}),new Response('x',{headers:{'content-type':'image/png','content-length':String(7*1024*1024)}}),new Response(new Uint8Array(6*1024*1024+1),{headers:{'content-type':'image/png'}})])assert.equal(await fetchPhoto(photoUrl,async()=>result),null);
});
test('version changes for title/photo/update and ignores arbitrary image query data',()=>{
 for(const key of ['title','photo','updated_at'])assert.notEqual(contentVersion(post),contentVersion({...post,[key]:'changed'}));
 const m=publicPostMetadata(post);assert.equal(m.title,post.title);assert.match(m.image,/format=png&v=post-card-v2/);assert.equal(m.url,'https://seonnam.com/post/299');
});
test('HTML injection replaces all stale OG/Twitter/canonical metadata and escapes content',()=>{
 const m=publicPostMetadata({...post,title:'" <script>alert(1)</script> & 테스트'});
 const html=injectShareHead('<head><title>old</title><meta property="og:image" content="old"><meta name="twitter:image" content="old"><link rel="canonical" href="old"></head>',m);
 assert.equal((html.match(/property="og:image"/g)||[]).length,1);assert.equal((html.match(/name="twitter:image"/g)||[]).length,1);assert.doesNotMatch(html,/<script>|content="old"/);assert.match(html,/&amp;/);assert.match(html,/og:image:width/);
});
test('SPA updates existing metadata through attributes, including image and canonical',()=>{
 const elements=new Map(); const doc={title:'',head:{querySelector:k=>elements.get(k),appendChild(e){const key=e.attrs.property?`meta[property="${e.attrs.property}"]`:e.attrs.name?`meta[name="${e.attrs.name}"]`:'link[rel="canonical"]';elements.set(key,e);}},createElement:()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;}})};
 const m=publicPostMetadata(post);applyShareMetadata(m,doc);assert.equal(doc.title,post.title);assert.equal(elements.get('meta[property="og:image"]').attrs.content,m.image);assert.equal(elements.get('meta[name="twitter:image"]').attrs.content,m.image);applyShareMetadata(unavailableMetadata(299),doc);assert.equal(elements.get('meta[name="robots"]').attrs.content,'noindex, nofollow');
});
test('crawler HTML and regular initial HTML agree without JS; hidden returns generic 404 and no private content',async()=>{
 for(const ua of ['kakaotalk-scrap/1.0','facebookexternalhit/1.1','Twitterbot','Mozilla/5.0'])await withFetch(async()=>{
 const response=await render(new Request('https://seonnam.com/post/299',{headers:{'user-agent':ua}}));const html=await response.text();assert.equal(response.status,200);assert.match(html,/새 작기 준비/);assert.match(html,/api\/share\?id=299/);assert.equal(response.headers.get('vary'),'User-Agent');
 },async(url)=>String(url).includes('/_app.html')?new Response('<html><head><title>old</title></head><body>SPA</body></html>'):Response.json([post]));
 for(const ua of ['kakaotalk-scrap','Mozilla/5.0'])await withFetch(async()=>{const r=await render(new Request('https://seonnam.com/post/299',{headers:{'user-agent':ua}}));assert.equal(r.status,404);assert.doesNotMatch(await r.text(),/SECRET/);},async(url)=>String(url).includes('/_app.html')?new Response('<head></head>'):Response.json([{...post,is_private:true,title:'SECRET'}]));
});
test('PNG HTTP response, HEAD, errors and old version visibility checks',async()=>{
 await withFetch(async()=>{for(const method of ['GET','HEAD']){const res=responseRecorder();await share({method,query:{id:'299',format:'png',v:'old'}},res);assert.equal(res.statusCode,200);assert.equal(res.headers['content-type'],'image/png');assert.match(res.headers['cache-control'],/no-store/);if(method==='GET'){const meta=await sharp(res.body).metadata();assert.equal(meta.width,1200);assert.equal(meta.height,630);}else assert.equal(res.body,undefined);}},async()=>Response.json([post]));
 for(const row of [null,{...post,is_private:true},{...post,is_hidden:true},{...post,status:'deleted'}])await withFetch(async()=>{const res=responseRecorder();await share({method:'GET',query:{id:'299',format:'png',v:'old'}},res);assert.equal(res.statusCode,404);assert.equal(res.body.available,false);},async()=>Response.json(row?[row]:[]));
 await withFetch(async()=>{const res=responseRecorder();await share({method:'GET',query:{id:'299',format:'png'}},res);assert.equal(res.statusCode,503);},async()=>{throw new Error('timeout');});
 const res=responseRecorder();await share({method:'POST',query:{id:'299'}},res);assert.equal(res.statusCode,405);
});
test('no-photo, failed-photo, long title, malicious title and empty title always render 1200x630 PNG',async()=>{
 for(const p of [post,{...post,photo:photoUrl},{...post,title:'아주 긴 제목을 가진 농업인의 이야기 '.repeat(18)},{...post,title:'<b>& "안전한 제목"</b>'},{...post,title:'',description:''}]){const png=await renderPostCard(p,{fetchImpl:async()=>new Response('corrupt',{headers:{'content-type':'image/png'}})});const m=await sharp(png).metadata();assert.equal(m.width,1200);assert.equal(m.height,630);}
});
test('valid raster representative photo is rendered in the right panel',async()=>{
 const red=await sharp({create:{width:50,height:50,channels:3,background:'#ff0000'}}).png().toBuffer();
 const png=await renderPostCard({...post,photo:photoUrl},{fetchImpl:async()=>new Response(red,{headers:{'content-type':'image/png'}})});
 const {data}=await sharp(png).extract({left:1000,top:300,width:1,height:1}).raw().toBuffer({resolveWithObject:true});
 assert.equal(data[0],255);assert.equal(data[1],0);assert.equal(data[2],0);
});
test('corrupt photograph produces exactly the no-photo branded card',async()=>{
 const expected=await renderPostCard(post);
 const actual=await renderPostCard({...post,photo:photoUrl},{fetchImpl:async()=>new Response('bad raster',{headers:{'content-type':'image/png'}})});
 assert.deepEqual(actual,expected);
});

test('Preview image URLs use trusted Vercel deployment origin while canonical remains public',()=>{
 const meta = serverPostMetadata(post,{VERCEL_ENV:'preview',VERCEL_URL:'seongjumai-review.vercel.app'});
 assert.ok(meta.image.startsWith('https://seongjumai-review.vercel.app/api/share'));
 assert.equal(meta.url,'https://seonnam.com/post/299');
 for(const host of ['evil.com','good.vercel.app.evil.com','good.vercel.app/path','user@good.vercel.app']) assert.ok(serverPostMetadata(post,{VERCEL_ENV:'preview',VERCEL_URL:host}).image.startsWith('https://seonnam.com/api/share'));
 assert.ok(serverPostMetadata(post,{VERCEL_ENV:'production',VERCEL_URL:'good.vercel.app'}).image.startsWith('https://seonnam.com/api/share'));
});

test('footer logo and brand name align by visible pixel centers, within one pixel',async()=>{
 const png = await renderPostCard(post);
 const {data,info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const bounds=(left,right,predicate)=>{
   let top=630,bottom=-1;
   for(let y=530;y<585;y++)for(let x=left;x<right;x++){
     const at=(y*info.width+x)*info.channels;
     if(predicate(data[at],data[at+1],data[at+2])){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   }
   assert.ok(bottom>=top);return {top,bottom,center:(top+bottom)/2};
 };
 const logo=bounds(68,102,(r,g,b)=>r>180&&g>140&&b<120);
 const name=bounds(114,350,(r,g,b)=>r<100&&g<130&&b<110);
 assert.ok(Math.abs(logo.center-name.center)<=1,JSON.stringify({logo,name}));
});

test('public lookup works without AbortSignal.timeout and uses portable string fetch URLs',async()=>{
 const original=AbortSignal.timeout;AbortSignal.timeout=undefined;
 try{const p=await getPublicPost('299',{env,fetchImpl:async(url)=>{assert.equal(typeof url,'string');return Response.json([post]);}});assert.equal(p.id,299);}finally{AbortSignal.timeout=original;}
});
test('protected Preview shell credentials are sent only to the exact configured deployment origin',async()=>{
 for(const host of ['preview-review.vercel.app','unexpected.vercel.app'])await withFetch(async()=>{
   process.env.VERCEL_ENV='preview';process.env.VERCEL_URL='preview-review.vercel.app';
   const r=await render(new Request(`https://${host}/post/299`,{headers:{cookie:'test-session','x-vercel-trusted-oidc-idp-token':'test-oidc'}}));assert.equal(r.status,200);
 },async(url,opts)=>{
   if(String(url).endsWith('/_app.html')){
     assert.equal(opts.headers.cookie,host==='preview-review.vercel.app'?'test-session':undefined);
     assert.equal(opts.headers['x-vercel-trusted-oidc-idp-token'],host==='preview-review.vercel.app'?'test-oidc':undefined);
     assert.equal(opts.redirect,'manual');return new Response('<head></head><div id="root"></div>');
   }
   return Response.json([post]);
 });
});

test('Edge compile-time environment bindings work without a runtime process.env object',async()=>{
 const {build}=await import('esbuild');
 const result=await build({entryPoints:[fileURLToPath(new URL('../lib/public-post.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',define:{'process.env.VITE_SUPABASE_URL':JSON.stringify(env.VITE_SUPABASE_URL),'process.env.VITE_SUPABASE_ANON_KEY':JSON.stringify(env.VITE_SUPABASE_ANON_KEY),'process.env.VERCEL_ENV':'"preview"','process.env.VERCEL_URL':'"edge-review.vercel.app"','process.env':'undefined'}});
 const mod=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const p=await mod.getPublicPost('299',{fetchImpl:async()=>Response.json([post])});
 assert.equal(p.id,299);assert.ok(mod.serverPostMetadata(p).image.startsWith('https://edge-review.vercel.app/'));
});

test('Edge-compatible manual redirects are rejected without forwarding the anonymous key elsewhere',async()=>{
 let calls=0;
 await assert.rejects(getPublicPost('299',{env,fetchImpl:async(url,opts)=>{
   calls++;assert.equal(opts.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://example.invalid/redirect'}});
 }}),{code:'upstream_302'});
 assert.equal(calls,1);
});

test('SPA retains same-origin deployment authentication without using a signed-in post',async()=>{
 const {build}=await import('esbuild');
 const bundled=await build({entryPoints:[fileURLToPath(new URL('../src/hooks/usePostShareMetadata.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'effect-harness',setup(b){b.onResolve({filter:/^react$/},()=>({path:'react',namespace:'hook-test'}));b.onLoad({filter:/.*/,namespace:'hook-test'},()=>({contents:'export function useEffect(fn){globalThis.__shareHookCleanup=fn();}'}));}}]});
 const mod=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
 const previousDoc=global.document;const entries=new Map();const doc={title:'',head:{querySelector:k=>entries.get(k),appendChild(e){const key=e.attrs.property?`meta[property="${e.attrs.property}"]`:e.attrs.name?`meta[name="${e.attrs.name}"]`:'link[rel="canonical"]';entries.set(key,e);}},createElement:()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v;}})};global.document=doc;
 try{await withFetch(async()=>{
   mod.usePostShareMetadata('/post/299');await new Promise(resolve=>setImmediate(resolve));
   assert.equal(doc.title,post.title);
 },async(url,options)=>{assert.equal(url,'/api/share?id=299');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');return Response.json(publicPostMetadata(post));});}
 finally{global.__shareHookCleanup?.();delete global.__shareHookCleanup;global.document=previousDoc;}
});
