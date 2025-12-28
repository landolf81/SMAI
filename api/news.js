// Vercel Serverless Function - 뉴스 RSS 프록시
// CORS 문제 해결을 위한 서버사이드 프록시

// 필터링 키워드 (제목/설명에 포함되어야 함)
const FILTER_KEYWORDS = ['참외', '성주'];

// RSS 소스 목록
const RSS_SOURCES = {
  google: {
    name: '구글 뉴스',
    url: 'https://news.google.com/rss/search?q=참외+OR+성주군+농업&hl=ko&gl=KR&ceid=KR:ko',
    skipFilter: true // 구글 뉴스는 이미 검색 필터 적용됨
  },
  rdaTech: {
    name: '농촌진흥청 농업기술',
    url: 'https://www.rda.go.kr/rss/rss.jsp?board_id=pubctebook',
    skipFilter: false
  },
  rdaMagazine: {
    name: '농촌진흥청 그린매거진',
    url: 'https://www.rda.go.kr/rss/rss.jsp?board_id=webzine',
    skipFilter: false
  }
};

// 키워드 필터링 함수
function matchesKeywords(title, description) {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  return FILTER_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

// XML을 JSON으로 파싱 (간단한 RSS 파서)
function parseRSS(xml, sourceName) {
  const items = [];

  // <item> 태그 추출
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    // 각 필드 추출
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');
    const description = extractTag(itemXml, 'description');

    // 이미지 URL 추출 시도 (여러 패턴 시도)
    let imageUrl = null;

    // 1. media:content 태그
    const mediaContentMatch = itemXml.match(/<media:content[^>]+url="([^"]+)"/i);
    if (mediaContentMatch) {
      imageUrl = mediaContentMatch[1];
    }

    // 2. enclosure 태그 (이미지 타입)
    if (!imageUrl) {
      const enclosureMatch = itemXml.match(/<enclosure[^>]+url="([^"]+)"[^>]+type="image/i);
      if (enclosureMatch) {
        imageUrl = enclosureMatch[1];
      }
    }

    // 3. description 내 img 태그
    if (!imageUrl && description) {
      const imgMatch = description.match(/<img[^>]+src="([^"]+)"/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }

    // 4. 일반 이미지 URL 패턴 (jpg, png, webp)
    if (!imageUrl) {
      const urlMatch = itemXml.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|gif|webp)/i);
      if (urlMatch) {
        imageUrl = urlMatch[0];
      }
    }

    if (title && link) {
      items.push({
        title: cleanText(title),
        link: cleanLink(link),
        pubDate: pubDate ? new Date(pubDate).toISOString() : null,
        description: cleanText(description)?.substring(0, 200),
        imageUrl,
        source: sourceName
      });
    }
  }

  return items;
}

// XML 태그 내용 추출
function extractTag(xml, tagName) {
  // CDATA 처리
  const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tagName}>`, 'i');
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) return cdataMatch[1];

  // 일반 태그
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

// 텍스트 정리 (HTML 태그 제거)
function cleanText(text) {
  if (!text) return null;
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// 구글 뉴스 리다이렉트 링크 처리
function cleanLink(link) {
  if (!link) return null;
  // 구글 뉴스 리다이렉트 URL에서 실제 URL 추출 시도
  if (link.includes('news.google.com')) {
    // 구글 뉴스는 리다이렉트 URL을 사용하므로 그대로 반환
    return link.trim();
  }
  return link.trim();
}

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // 15분 캐싱
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const allItems = [];

    // 모든 RSS 소스에서 데이터 가져오기
    const fetchPromises = Object.entries(RSS_SOURCES).map(async ([key, source]) => {
      try {
        const response = await fetch(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
            'Accept': 'application/rss+xml, application/xml, text/xml'
          }
        });

        if (!response.ok) {
          console.warn(`${source.name} RSS 가져오기 실패: ${response.status}`);
          return [];
        }

        const xml = await response.text();
        let items = parseRSS(xml, source.name);

        // 키워드 필터링 적용 (skipFilter가 false인 소스만)
        if (!source.skipFilter) {
          items = items.filter(item => matchesKeywords(item.title, item.description));
        }

        return items;
      } catch (error) {
        console.warn(`${source.name} RSS 오류:`, error.message);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    results.forEach(items => allItems.push(...items));

    // 중복 제거 (링크 기준)
    const seenLinks = new Set();
    const uniqueItems = allItems.filter(item => {
      // 링크 정규화 (쿼리 파라미터 제거하여 비교)
      const normalizedLink = item.link?.split('?')[0] || item.link;
      if (seenLinks.has(normalizedLink)) {
        return false;
      }
      seenLinks.add(normalizedLink);
      return true;
    });

    // 날짜순 정렬 (최신순)
    uniqueItems.sort((a, b) => {
      const dateA = a.pubDate ? new Date(a.pubDate) : new Date(0);
      const dateB = b.pubDate ? new Date(b.pubDate) : new Date(0);
      return dateB - dateA;
    });

    // 최대 20개만 반환
    const limitedItems = uniqueItems.slice(0, 20);

    return res.status(200).json({
      success: true,
      count: limitedItems.length,
      items: limitedItems,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('뉴스 RSS 프록시 오류:', error);
    return res.status(500).json({
      error: 'Failed to fetch news',
      message: error.message
    });
  }
}
