import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
async function loadClient() {
  const output = await build({ entryPoints: [fileURLToPath(new URL('../src/services/geminiService.js',import.meta.url))], bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'offline-auth',setup(plugin){plugin.onResolve({filter:/config\/supabase/},()=>({path:'auth',namespace:'mock'}));plugin.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const supabase={auth:{getSession:async()=>({data:{session:globalThis.__translationSession},error:null})}};'}));}}] });
  return (await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text+`\n// ${Math.random()}`).toString('base64')}`)).geminiService;
}
test('guest same-origin request, translation ticket and concurrent TTS share one paid request',async()=>{
  const oldFetch=globalThis.fetch; globalThis.__translationSession=null; const calls=[];const client=await loadClient();
  globalThis.fetch=async (url, options)=>{calls.push({url,options,body:JSON.parse(options.body)});return calls.at(-1).body.action==='translate'?Response.json({targetTranslation:'ສະບາຍດີ',backTranslation:'안녕',requestId:'mock-ticket'}):new Response(new Uint8Array(48),{headers:{'Content-Type':'audio/wav'}});};
  try{const result=await client.translate('안녕','ko','lo');await Promise.all([client.textToSpeech(result.targetTranslation,'lo'),client.textToSpeech(result.targetTranslation,'lo')]);assert.equal(calls.length,2);assert.equal(calls[0].url,'/api/translation');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.headers.Authorization,undefined);assert.equal(calls[1].body.requestId,'mock-ticket');}finally{globalThis.fetch=oldFetch;delete globalThis.__translationSession;}
});
test('expired/missing ticket cannot initiate standalone TTS; provider key absent from client bundle',async()=>{
  const source=await readFile(new URL('../src/services/geminiService.js',import.meta.url),'utf8');assert.ok(!/VITE_GEMINI|VITE_AZURE|generativelanguage/.test(source));
  const client=await loadClient();await assert.rejects(client.textToSpeech('untranslated','lo'),/다시 번역/);
});
async function renderTranslate() {
  const output=await build({entryPoints:[fileURLToPath(new URL('../src/pages/Translate.jsx',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',jsx:'transform',plugins:[{name:'page-mocks',setup(plugin){
    plugin.onResolve({filter:/.*/},args=>args.kind==='entry-point'?undefined:{path:args.path,namespace:'mock'});
    plugin.onLoad({filter:/.*/,namespace:'mock'},args=>{
      if(args.path==='react')return{contents:`let index=0; export const useState=(initial)=>{let value=typeof initial==='function'?initial():initial;if(index===3)value='안녕';if(index===4&&globalThis.__translationExisting)value={target:'ສະບາຍດີ',backTranslation:'안녕'};index++;return[value,()=>{}]};export const useRef=value=>({current:value});export const useEffect=()=>{};export const useCallback=fn=>fn;export const useContext=()=>({currentUser:{id:'mock-user'}});export default {createElement:(type,props,...children)=>{if(props?.onClick)globalThis.__translationButtons.push(props);return{type,props,children}}};`};
      if(args.path==='prop-types')return{contents:'export default {bool:{}};'};
      if(args.path==='@tanstack/react-query')return{contents:'export const useQuery=()=>({data:[]});'};
      if(args.path==='react-hot-toast')return{contents:'export default {success(){},error(message){globalThis.__translationToastErrors?.push(message)},loading(){},dismiss(){}};'};
      if(args.path.endsWith('/services'))return{contents:`export const geminiService={translate:async()=>({targetTranslation:'ສະບາຍດີ',backTranslation:'안녕'}),textToSpeech:async()=>{if(globalThis.__translationMockSpeech){globalThis.__translationSpeechCalls++;return new Blob(['offline-audio'],{type:'audio/wav'});}throw new Error('mock voice failed')}};export const translationService={saveHistory:async(data,audio)=>{if(globalThis.__translationFailOnce){globalThis.__translationFailOnce=false;throw new Error('mock text save failed');}globalThis.__translationSaved.push({data,audio});return{id:'record'}},getHistory:async()=>[],getHistoryCount:async()=>1};export const adService={getActiveAds:async()=>[]};`};
      if(args.path.includes('AuthContext'))return{contents:'export const AuthContext={};'};
      if(args.path.includes('deviceDetector'))return{contents:'export const isMobileDevice=()=>true;'};
      return{contents:'export default function Stub(){return null;}'};
    });
  }}]});return(await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text+`\n// ${Math.random()}`).toString('base64')}`)).default;
}
test('actual page persists translation text when Gemini voice generation fails',async()=>{
  const savedSetTimeout=globalThis.setTimeout;const savedStorage=globalThis.localStorage;const queue=[];
  globalThis.__translationButtons=[];globalThis.__translationSaved=[];globalThis.localStorage={getItem:()=>null};globalThis.setTimeout=fn=>{queue.push(fn);return 1;};
  const oldError=console.error;console.error=()=>{};
  try{const Page=await renderTranslate();Page({});const button=globalThis.__translationButtons.find(p=>p.onClick.name==='handleTranslate');assert.ok(button);await button.onClick();await Promise.resolve();await queue[0]();assert.equal(globalThis.__translationSaved.length,1);assert.equal(globalThis.__translationSaved[0].audio,null);assert.equal(globalThis.__translationSaved[0].data.targetTranslation,'ສະບາຍດີ');}
  finally{globalThis.setTimeout=savedSetTimeout;globalThis.localStorage=savedStorage;console.error=oldError;delete globalThis.__translationButtons;delete globalThis.__translationSaved;}
});
async function loadHistoryService() {
  const output=await build({entryPoints:[fileURLToPath(new URL('../src/services/translationService.js',import.meta.url))],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'history-mocks',setup(plugin){
    plugin.onResolve({filter:/config\/supabase/},()=>({path:'database',namespace:'mock'}));
    plugin.onResolve({filter:/r2Service/},()=>({path:'storage',namespace:'mock'}));
    plugin.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='storage'?`export const r2Service={upload:async(file)=>{globalThis.__historyFiles.push(file);return{url:'https://mock.r2.dev/new.wav',key:'new-upload'}},delete:async key=>globalThis.__historyDeleted.push(key)};`:`export const supabase={from:()=>({insert:values=>{globalThis.__historyRows.push(values);return{select:()=>({single:async()=>({data:{id:'mock-record'},error:null})})}}}),rpc:async()=>({data:!globalThis.__historyFail,error:globalThis.__historyFail?new Error('offline mocked failure'):null})};`}));
  }}]});return(await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text+`\n// ${Math.random()}`).toString('base64')}`)).translationService;
}
test('actual history service preserves MP3 and stores Gemini WAV with correct extension/MIME',async()=>{
  globalThis.__historyFiles=[];globalThis.__historyRows=[];globalThis.__historyDeleted=[];
  try{const service=await loadHistoryService();const values={inputText:'hi',inputLang:'ko',targetLang:'lo',targetTranslation:'translated',backTranslation:'hi'};await service.saveHistory(values,new Blob(['audio'],{type:'audio/mpeg'}),'mock-user');await service.saveHistory(values,new Blob(['audio'],{type:'audio/wav'}),'mock-user');assert.match(globalThis.__historyFiles[0].name,/\.mp3$/);assert.match(globalThis.__historyFiles[1].name,/\.wav$/);assert.equal(globalThis.__historyFiles[1].type,'audio/wav');}
  finally{delete globalThis.__historyFiles;delete globalThis.__historyRows;delete globalThis.__historyDeleted;}
});
test('failed narrow audio attachment removes only new upload and leaves saved text record',async()=>{
  globalThis.__historyFiles=[];globalThis.__historyRows=[];globalThis.__historyDeleted=[];globalThis.__historyFail=true;
  try{const service=await loadHistoryService();await assert.rejects(service.attachAudio('record',new Blob(['audio'],{type:'audio/wav'}),'user'),/offline/);assert.deepEqual(globalThis.__historyDeleted,['new-upload']);assert.equal(globalThis.__historyRows.length,0);}
  finally{delete globalThis.__historyFiles;delete globalThis.__historyRows;delete globalThis.__historyDeleted;delete globalThis.__historyFail;}
});

test('actual modal recovers failed text save even while TTS is unavailable',async()=>{
 const originalTimer=globalThis.setTimeout;const originalStorage=globalThis.localStorage;const originalError=console.error;const queue=[];
 globalThis.__translationButtons=[];globalThis.__translationSaved=[];globalThis.__translationExisting=true;globalThis.__translationFailOnce=true;
 globalThis.localStorage={getItem:()=>null};globalThis.setTimeout=fn=>{queue.push(fn);return 1;};console.error=()=>{};
 try{const Page=await renderTranslate();Page({});await globalThis.__translationButtons.find(p=>p.onClick.name==='handleTranslate').onClick();await Promise.resolve();await queue[0]();
 const modal=globalThis.__translationButtons.find(p=>p.onClick.name==='openTranslationModal');assert.ok(modal);await modal.onClick();assert.equal(globalThis.__translationSaved.length,1);assert.equal(globalThis.__translationSaved[0].audio,null);}
 finally{globalThis.setTimeout=originalTimer;globalThis.localStorage=originalStorage;console.error=originalError;delete globalThis.__translationButtons;delete globalThis.__translationSaved;delete globalThis.__translationExisting;delete globalThis.__translationFailOnce;}
});

test('modal playback rejection is visible and does not leave a stale player or regenerate audio',async()=>{
 const oldTimer=globalThis.setTimeout,oldStorage=globalThis.localStorage,oldAudio=globalThis.Audio,oldError=console.error;const queue=[];let players=0;
 globalThis.__translationButtons=[];globalThis.__translationSaved=[];globalThis.__translationExisting=true;globalThis.__translationMockSpeech=true;globalThis.__translationSpeechCalls=0;globalThis.__translationToastErrors=[];
 globalThis.localStorage={getItem:()=>null};globalThis.setTimeout=fn=>{queue.push(fn);return 1;};console.error=()=>{};
 globalThis.Audio=class{constructor(src){this.src=src;players++;}pause(){}play(){return Promise.reject(Object.assign(new Error('mock blocked audio'),{name:'NotAllowedError'}));}};
 try{
  const Page=await renderTranslate();Page({});await globalThis.__translationButtons.find(p=>p.onClick.name==='openTranslationModal').onClick();
  queue[0]();for(let i=0;i<5;i++)await Promise.resolve();
  assert.equal(players,1);assert.ok(globalThis.__translationToastErrors.some(message=>message.includes('브라우저의 소리 설정')));
  await globalThis.__translationButtons.find(p=>p.onClick.name==='handleTTS').onClick();for(let i=0;i<5;i++)await Promise.resolve();
  assert.equal(players,2,'next click starts cached playback instead of consuming a stale player');assert.equal(globalThis.__translationSpeechCalls,1,'cached audio never regenerates');
 }finally{
  globalThis.setTimeout=oldTimer;globalThis.localStorage=oldStorage;globalThis.Audio=oldAudio;console.error=oldError;
  for(const name of ['__translationButtons','__translationSaved','__translationExisting','__translationMockSpeech','__translationSpeechCalls','__translationToastErrors'])delete globalThis[name];
 }
});
