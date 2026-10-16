import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
test('home, prices and weather modal retain real data widgets without AI briefing UI/calls',async()=>{
 const home=await read('src/pages/home.jsx'),prices=await read('src/pages/Prices.jsx'),modal=await read('src/components/WeatherModal.jsx');
 assert.match(home,/<WeatherWidget/);assert.match(home,/<WeatherModal/);assert.match(home,/<CombinedMarketCard/);
 assert.match(home,/marketService\./);assert.match(prices,/marketService\./);assert.match(prices,/marketData\.details/);
 assert.match(modal,/useWeather\(\{ enabled: isOpen \}\)/);assert.match(modal,/weather\.current/);
 for(const code of [home,prices,modal,await read('src/services/index.js')])assert.doesNotMatch(code,/briefing|Briefing|agentService/);
 for(const file of ['src/services/briefingService.js','src/services/weatherBriefingService.js','src/services/agentService.js','api/briefing.js'])await assert.rejects(access(new URL(`../${file}`,import.meta.url)));
});
test('retired server jobs respond without Gemini, OpenClaw or DB calls; translation still has its separate gateway',async()=>{
 for(const name of ['generate-briefings','request-agent']){
  let handler,calls=0;
  runInNewContext(await read(`supabase/functions/${name}/index.ts`),{Deno:{serve:h=>{handler=h;}},Response,fetch(){calls++;throw new Error('no network');}});
  const response=await handler(new Request('https://offline.example/job'));
  assert.equal(response.status,410);assert.equal(calls,0);
 }
 assert.match(await read('api/translation.js'),/GEMINI_TRANSLATION_API_KEY/);
 assert.match(await read('src/pages/Translate.jsx'),/translation/);
});
