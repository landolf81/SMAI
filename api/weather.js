/** Public cached weather proxy: fixed provider paths, bounded parameters, server key. */
const PATHS = new Set([
  '/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst',
  '/1360000/VilageFcstInfoService_2.0/getVilageFcst',
  '/1360000/MidFcstInfoService/getMidLandFcst',
  '/1360000/MidFcstInfoService/getMidTa',
]);
const VALIDATORS = {
  numOfRows: value => /^\d{1,4}$/.test(value) && Number(value) > 0 && Number(value) <= 1000,
  pageNo: value => value === '1', dataType: value => value === 'JSON',
  base_date: value => /^\d{8}$/.test(value), base_time: value => /^\d{4}$/.test(value),
  nx: value => /^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 149,
  ny: value => /^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= 253,
  regId: value => /^[A-Z0-9]{8}$/.test(value), tmFc: value => /^\d{10}$/.test(value),
};
export function providerURL(endpoint, key) {
  if (typeof endpoint !== 'string' || endpoint.length > 1000 || !endpoint.startsWith('/1360000/')) throw new Error('endpoint');
  const url = new URL(endpoint, 'https://apis.data.go.kr');
  if (url.origin !== 'https://apis.data.go.kr' || !PATHS.has(url.pathname) || url.hash) throw new Error('path');
  const seen = new Set();
  for (const [name, value] of url.searchParams) {
    if (seen.has(name) || !VALIDATORS[name]?.(value)) throw new Error('parameters');
    seen.add(name);
  }
  const required = url.pathname.includes('Vilage') ? ['base_date', 'base_time', 'nx', 'ny'] : ['regId', 'tmFc'];
  if (required.some(name => !seen.has(name)) || url.searchParams.get('dataType') !== 'JSON') throw new Error('missing parameters');
  let decoded = key;
  try { decoded = decodeURIComponent(key); } catch { /* raw key */ }
  url.searchParams.set('serviceKey', decoded);
  return url;
}
export function createHandler({ env = process.env, fetcher = fetch } = {}) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') return res.status(405).json({ error: 'GET 요청만 지원합니다.' });
    if (!env.KMA_API_KEY) return res.status(503).json({ error: '날씨 서비스 설정이 필요합니다.' });
    let url;
    try { url = providerURL(req.query?.endpoint, env.KMA_API_KEY); }
    catch { return res.status(400).json({ error: '날씨 요청 항목을 확인해주세요.' }); }
    try {
      const response = await fetcher(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('upstream');
      const data = await response.json();
      if (data?.response?.header?.resultCode !== '00') throw new Error('provider');
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
      return res.status(200).json(data);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: '날씨 정보를 불러오지 못했습니다.' });
    }
  };
}
export default createHandler();
