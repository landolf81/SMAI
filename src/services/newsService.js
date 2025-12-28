/**
 * 뉴스 피드 서비스
 * 참외/농업 관련 뉴스를 가져옴
 */

const isDev = import.meta.env.DEV;

// 필터링 키워드 (제목/설명에 포함되어야 함)
const FILTER_KEYWORDS = ['참외', '성주'];

// RSS 소스 목록 (개발 환경용)
const RSS_SOURCES = [
  {
    name: '구글 뉴스',
    url: 'https://news.google.com/rss/search?q=참외+OR+성주군+농업&hl=ko&gl=KR&ceid=KR:ko',
    skipFilter: true // 이미 검색 쿼리로 필터링됨
  }
];

// CORS 프록시 (개발 환경용)
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

// 키워드 필터링 함수
const matchesKeywords = (title, description) => {
  const text = `${title || ''} ${description || ''}`.toLowerCase();
  return FILTER_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
};

/**
 * RSS XML 파싱 (클라이언트용 간단 파서)
 */
const parseRSSClient = (xml, sourceName) => {
  const items = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const itemElements = doc.querySelectorAll('item');

  itemElements.forEach((item) => {
    const title = item.querySelector('title')?.textContent;
    const link = item.querySelector('link')?.textContent;
    const pubDate = item.querySelector('pubDate')?.textContent;
    const description = item.querySelector('description')?.textContent;

    // 이미지 URL 추출 시도
    let imageUrl = null;

    // 1. media:content 태그
    const mediaContent = item.querySelector('content');
    if (mediaContent?.getAttribute('url')) {
      imageUrl = mediaContent.getAttribute('url');
    }

    // 2. enclosure 태그
    if (!imageUrl) {
      const enclosure = item.querySelector('enclosure');
      if (enclosure?.getAttribute('url') && enclosure.getAttribute('type')?.startsWith('image')) {
        imageUrl = enclosure.getAttribute('url');
      }
    }

    // 3. description 내 img 태그
    if (!imageUrl && description) {
      const imgMatch = description.match(/<img[^>]+src="([^"]+)"/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }

    if (title && link) {
      items.push({
        title: title.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        link: link.trim(),
        pubDate: pubDate ? new Date(pubDate).toISOString() : null,
        description: description?.replace(/<[^>]+>/g, '').substring(0, 200),
        imageUrl,
        source: sourceName
      });
    }
  });

  return items;
};

/**
 * 뉴스 목록 가져오기
 * @returns {Promise<Array>} 뉴스 아이템 배열
 */
export const fetchNews = async () => {
  try {
    if (isDev) {
      // 개발 환경: CORS 프록시 사용
      const allItems = [];

      for (const source of RSS_SOURCES) {
        try {
          const response = await fetch(CORS_PROXY + encodeURIComponent(source.url));
          if (response.ok) {
            const xml = await response.text();
            const items = parseRSSClient(xml, source.name);
            allItems.push(...items);
          }
        } catch (e) {
          console.warn(`${source.name} RSS 가져오기 실패:`, e.message);
        }
      }

      // 중복 제거 (링크 기준)
      const seenLinks = new Set();
      const uniqueItems = allItems.filter(item => {
        const normalizedLink = item.link?.split('?')[0] || item.link;
        if (seenLinks.has(normalizedLink)) return false;
        seenLinks.add(normalizedLink);
        return true;
      });

      // 날짜순 정렬 후 최대 10개 반환
      return uniqueItems
        .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
        .slice(0, 10);
    }

    // 프로덕션: Vercel serverless function 사용
    const response = await fetch('/api/news');

    if (!response.ok) {
      throw new Error(`뉴스 API 오류: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || '뉴스를 가져올 수 없습니다');
    }

    return data.items || [];
  } catch (error) {
    console.warn('뉴스 가져오기 실패:', error.message);
    return [];
  }
};

/**
 * 상대 시간 포맷 (예: "3시간 전")
 * @param {string} dateString - ISO 날짜 문자열
 * @returns {string} 상대 시간
 */
export const formatRelativeTime = (dateString) => {
  if (!dateString) return '';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  // 7일 이상이면 날짜 표시
  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric'
  });
};

/**
 * 뉴스 소스 아이콘 가져오기
 * @param {string} source - 소스 이름
 * @returns {string} 이모지 또는 아이콘
 */
export const getSourceIcon = (source) => {
  const icons = {
    '구글 뉴스': '📰',
    '농촌진흥청 농업기술': '🌾',
    '농촌진흥청 그린매거진': '📗',
    '성주군청': '🏛️'
  };
  return icons[source] || '📄';
};

export const newsService = {
  fetchNews,
  formatRelativeTime,
  getSourceIcon
};

export default newsService;
