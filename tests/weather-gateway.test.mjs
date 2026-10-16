import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler as weatherHandler, providerURL } from '../api/weather.js';
const response = () => ({ headers: {}, setHeader(k,v){this.headers[k]=v;}, status(n){this.code=n;return this;}, json(body){this.body=body;return this;} });
const endpoint='/1360000/VilageFcstInfoService_2.0/getVilageFcst?dataType=JSON&numOfRows=1000&pageNo=1&base_date=20261016&base_time=0200&nx=83&ny=91';
test('weather key is attached only on server and encoded once',()=>{
  const url=providerURL(endpoint,'mock%2Bkey%3D');assert.equal(url.searchParams.get('serviceKey'),'mock+key=');
  for(const value of ['https://evil.example/',endpoint+'&serviceKey=client',endpoint+'&nx=1',endpoint.replace('numOfRows=1000','numOfRows=9999'),endpoint.replace('getVilageFcst','other')])assert.throws(()=>providerURL(value,'mock'));
});
test('weather proxy caches success, fails closed without server key and hides provider errors',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;return Response.json({response:{header:{resultCode:'00'},body:{items:{item:[]}}}});};
  const handler=weatherHandler({env:{KMA_API_KEY:'mock-weather'},fetcher});const out=response();await handler({method:'GET',query:{endpoint}},out);assert.equal(out.code,200);assert.match(out.headers['Cache-Control'],/s-maxage=900/);
  const bad=response();await weatherHandler({env:{VITE_KMA_API_KEY:'wrong'},fetcher})({method:'GET',query:{endpoint}},bad);assert.equal(bad.code,503);assert.equal(calls,1);
  const fail=response();await weatherHandler({env:{KMA_API_KEY:'mock-weather'},fetcher:async()=>{throw new Error('mock-weather in URL');}})({method:'GET',query:{endpoint}},fail);assert.equal(fail.code,502);assert.doesNotMatch(JSON.stringify(fail),/mock-weather/);
});
