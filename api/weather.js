// Vercel Serverless Function - 기상청 API 프록시
// CORS 문제 해결을 위한 서버사이드 프록시

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint parameter is required' });
  }

  try {
    const targetUrl = `https://apis.data.go.kr${endpoint}`;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    console.error('기상청 API 프록시 오류:', error);
    return res.status(500).json({
      error: 'Failed to fetch weather data',
      message: error.message
    });
  }
}
