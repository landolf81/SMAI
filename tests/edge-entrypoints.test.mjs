// Compile each local Edge entrypoint with remote dependencies external; never call a live function.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
test('all Edge Function entrypoints and shared imports bundle without executing remote code',async()=>{
 const root=new URL('../supabase/functions/',import.meta.url);
 const dirs=await readdir(root,{withFileTypes:true});
 let count=0;
 for(const entry of dirs.filter(d=>d.isDirectory()&&d.name!=='_shared')){
  const result=await build({entryPoints:[fileURLToPath(new URL(`${entry.name}/index.ts`,root))],bundle:true,write:false,platform:'neutral',format:'esm',logLevel:'silent',plugins:[{name:'offline-remote-imports',setup(b){b.onResolve({filter:/^(?:https?:|jsr:|npm:)/},args=>({path:args.path,external:true}));}}]});
  assert.ok(result.outputFiles[0].text.length>0,entry.name);count++;
 }
 assert.ok(count>=16);
});
