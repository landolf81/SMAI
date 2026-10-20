/** Combined summary regression tests: render real components, mock only query/IO boundaries. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath } from 'node:url';

async function load(relative, mocks) {
  const result = await build({
    entryPoints: [fileURLToPath(new URL(relative, import.meta.url))],
    bundle: true, write: false, format: 'esm', platform: 'node', jsx: 'transform',
    plugins: [{ name: 'summary-boundaries', setup(plugin) {
      plugin.onResolve({ filter: /.*/ }, args => args.kind !== 'entry-point' && Object.hasOwn(mocks, args.path)
        ? { path: args.path, namespace: 'mock' } : undefined);
      plugin.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path] }));
    } }],
  });
  return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Math.random()}`)).default;
}
const reactMock = `const R=globalThis.__summaryReact; export default R; export const {useState,useMemo}=R;`;
globalThis.__summaryReact = React;
const Card = await load('../src/components/CombinedMarketCard.jsx', {
  react: reactMock,
  '@tanstack/react-query': 'export const useQuery = options => globalThis.__summaryQuery(options);',
  '../services': 'export const marketCombinedService = {};',
  recharts: "export const Area='area', Line='line', XAxis='x-axis', YAxis='y-axis', CartesianGrid='grid', Tooltip='tooltip', ResponsiveContainer=()=>null, Bar='bar', Legend='legend', ComposedChart='chart';",
});
const row = (total_boxes, total_amount) => ({ total_boxes, total_amount, avg_price: total_amount / total_boxes });
function render(seongju, wholesale, statuses = {}) {
  const calls = [];
  const refetches = [];
  globalThis.__summaryReact = React;
  globalThis.__summaryQuery = options => {
    calls.push(options);
    const name=options.queryKey[0];
    return { data: name==='combinedSeonju' ? seongju : name==='combinedWholesale' ? wholesale : null,
      isPending: false, isError: false, refetch: () => refetches.push(name), ...statuses[name] };
  };
  return { html: renderToStaticMarkup(React.createElement(Card, {
    selectedDate: '2026-10-20', formatPrice: value => value.toLocaleString('en-US'),
  })), calls, refetches };
}
// Each render imports React through a global boundary so the hooks share the renderer instance.
test('both markets render a weighted total using previous origin day and selected wholesale day', () => {
  const {html,calls}=render(row(10,100000),row(30,900000));
  assert.match(html,/40/); assert.match(html,/25,000/); assert.doesNotMatch(html,/자료만 집계/);
  assert.deepEqual(calls.slice(0,2).map(c=>c.queryKey[1]),['2026-10-19','2026-10-20']);
});
test('empty day renders no element, height or margin and disables history queries', () => {
  const {html,calls}=render(null,null);
  assert.equal(html,''); assert.ok(calls.slice(2).every(c=>c.enabled===false));
});
test('wholesale-only day remains visible with explicit missing origin notice', () => {
  const {html}=render(null,row(334,6836300));
  assert.match(html,/334/); assert.match(html,/20,468/); assert.match(html,/도매 자료만 집계 · 산지 자료 없음/);
});
test('origin-only day remains visible with explicit missing wholesale notice', () => {
  const {html}=render(row(66,2579000),null);
  assert.match(html,/66/); assert.match(html,/39,076/); assert.match(html,/산지 자료만 집계 · 도매 자료 없음/);
});
test('either query failure renders an alert and retry, never a partial total or empty success', () => {
  for(const key of ['combinedSeonju','combinedWholesale']) {
    const {html,calls}=render(row(10,100000),row(30,900000),{[key]:{isError:true}});
    assert.match(html,/role="alert"/); assert.match(html,/다시 시도/); assert.doesNotMatch(html,/총 출하량/);
    assert.ok(calls.slice(2).every(c=>c.enabled===false));
  }
});
test('pending market query does not briefly display an incomplete total', () => {
  assert.equal(render(null,row(30,900000),{combinedSeonju:{isPending:true}}).html,'');
});
test('Sunday retains the existing Friday origin + Saturday wholesale pairing', () => {
  render(null,null);
  const calls=[]; globalThis.__summaryQuery=options=>{calls.push(options);return {data:null,isPending:false};};
  renderToStaticMarkup(React.createElement(Card,{selectedDate:'2026-10-18',formatPrice:String}));
  assert.deepEqual(calls.slice(0,2).map(c=>c.queryKey[1]),['2026-10-16','2026-10-17']);
});

test('loaded deferred shell collapses completely around an empty summary', async () => {
  globalThis.__summaryReact=React;
  const Wrapper=await load('../src/components/DeferredCombinedMarketCard.jsx',{
    './CombinedMarketCard':'export default () => null;',
    react:`const R=globalThis.__summaryReact; export default R; export const Suspense=({children})=>children, useEffect=()=>{}, useRef=()=>({current:null}), useState=()=>[true,()=>{}], lazy=()=>()=>null;`,
  });
  const html=renderToStaticMarkup(React.createElement(Wrapper,{selectedDate:'2026-10-20',formatPrice:String}));
  assert.equal(html,'<div></div>');
});

test('date service differentiates no rows/zero rows from API errors for both markets', async () => {
  let response;
  globalThis.__summaryDB={from(){return this;},select(){return this;},eq(){return this;},async maybeSingle(){return response;}};
  const service=await load('../src/services/marketCombinedService.js',{
    '../config/supabase.js':'export const supabase=globalThis.__summaryDB;',
    './marketService.js':'export default {};',
  });
  for(const method of ['getSeongjuForDate','getWholesaleForDate']) {
    response={data:null,error:null}; assert.equal(await service[method]('2026-10-19'),null);
    response={data:row(0,0),error:null}; assert.equal(await service[method]('2026-10-19'),null);
    response={data:row(10,100000),error:null}; assert.deepEqual(await service[method]('2026-10-19'),response.data);
    response={data:null,error:new Error('offline')}; await assert.rejects(service[method]('2026-10-19'),/offline/);
  }
});
