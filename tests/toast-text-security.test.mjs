import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('server error text remains text in actual post/report toast templates',async()=>{
 const attack='<img src=x onerror=alert(1)><script>bad()</script>';
 let checked=0;
 for(const file of ['src/components/EnhancedInstagramPost.jsx','src/components/ReportModal.jsx','src/pages/AdminReports.jsx']){
  const source=await readFile(new URL(`../${file}`,import.meta.url),'utf8');
  for(const match of source.matchAll(/(\w+)\.innerHTML\s*=\s*`([^`]*?)`;\s*\1\.querySelector\('\[data-toast-text\]'\)\.textContent\s*=\s*([^;]+);/g)){
   const textNode={};const element={querySelector(){return textNode;}};
   const execute=new Function(match[1],'errorMessage','errorMsg','error',match[0]);
   execute(element,attack,attack,{message:attack,response:{data:{error:attack}}});
   assert.doesNotMatch(element.innerHTML,/<img|<script|onerror/);
   assert.equal(textNode.textContent,attack);checked++;
  }
 }
 assert.ok(checked>=5);
});
