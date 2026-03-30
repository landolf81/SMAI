/**
 * api/render.js
 * Vercel Edge Function - 크롤러 감지 및 SEO HTML 제공
 *
 * 역할:
 * - 검색엔진 크롤러(Naver Yeti, Googlebot 등) 요청 시 메타태그 + 본문 텍스트 포함 HTML 반환
 * - 일반 사용자 요청 시 기존 SPA index.html 그대로 반환
 * - Edge Runtime으로 동작하여 지연 최소화
 */
export const config = { runtime: 'edge' };

// ── 크롤러 User-Agent 패턴 ──
const CRAWLER_UA = /Yeti|Googlebot|bingbot|Baiduspider|DuckDuckBot|Slurp|facebookexternalhit|Twitterbot|kakaotalk-scrap|developers\.kakao|AdsBot|Mediapartners|PetalBot|SemrushBot|AhrefsBot|MJ12bot|Screaming Frog|Daum|namu\.wiki/i;

// ── 페이지별 SEO 메타 정보 ──
const PAGE_META = {
  '/': {
    title: '참외이야기 - 성주군 농업인 커뮤니티',
    description: '성주군 참외 농업인을 위한 커뮤니티. 참외 재배 정보, 시세 확인, 농업인 소통 공간. 성주 참외의 모든 것을 함께 나눠요.',
    keywords: '성주참외, 참외, 성주군, 농업, 커뮤니티, 참외시세, 참외재배, 농산물, 성주농업',
    bodyText: '참외이야기는 성주군 참외 농업인을 위한 커뮤니티입니다. 참외 재배 정보 공유, 실시간 시세 확인, 농업인 간 소통이 가능합니다. 성주 참외의 모든 것을 함께 나눠요. 날씨 정보, 산지시세, 도매시세를 한눈에 확인하고, 다른 농업인들과 소통해보세요.',
  },
  '/community': {
    title: '커뮤니티 - 참외이야기',
    description: '성주군 참외 농업인들의 소통 공간. 재배 노하우, 병해충 정보, 농사 일상을 자유롭게 공유하세요.',
    keywords: '참외커뮤니티, 성주농업인, 참외재배, 농사정보, 병해충, 참외농사',
    bodyText: '참외이야기 커뮤니티에서 성주군 참외 농업인들과 소통하세요. 재배 노하우, 병해충 정보, 농사 일상 등을 자유롭게 공유할 수 있습니다. 사진과 동영상도 올릴 수 있어요.',
  },
  '/qna': {
    title: '질문답변 - 참외이야기',
    description: '참외 재배 관련 질문과 답변. 경험 많은 농업인들에게 물어보세요. 재배기술, 병해충, 비료 등 다양한 질문이 가능합니다.',
    keywords: '참외질문, 참외답변, 참외재배질문, 농업질문, 참외병해충',
    bodyText: '참외 재배에 대한 질문과 답변을 나눌 수 있는 공간입니다. 재배기술, 병해충 관리, 비료 사용법 등 경험 많은 농업인들의 답변을 받아보세요.',
  },
  '/market': {
    title: '시세정보 - 참외이야기',
    description: '성주 참외 산지시세와 전국 도매시세를 실시간으로 확인하세요. 일별, 주별 시세 변동 추이도 제공합니다.',
    keywords: '참외시세, 성주참외가격, 참외도매, 참외산지가격, 참외시장',
    bodyText: '성주 참외 시세 정보를 실시간으로 확인하세요. 산지시세와 전국 주요 도매시장의 참외 가격, 일별·주별 시세 변동 추이를 한눈에 볼 수 있습니다.',
  },
  '/secondhand': {
    title: '중고거래 - 참외이야기',
    description: '성주군 농업인들의 중고 농기구, 자재 거래 공간. 필요한 농업 물품을 합리적인 가격에 거래하세요.',
    keywords: '농기구중고, 농업자재, 성주중고거래, 농기계, 참외자재',
    bodyText: '성주군 농업인들을 위한 중고거래 공간입니다. 농기구, 농업 자재, 비품 등을 합리적인 가격에 사고 팔 수 있습니다.',
  },
  '/lounge': {
    title: '광장 - 참외이야기',
    description: '성주군 참외 농업인들의 실시간 대화 공간. 자유롭게 이야기를 나눠보세요.',
    keywords: '참외이야기광장, 농업인채팅, 실시간대화, 성주농업인',
    bodyText: '참외이야기 광장에서 성주군 농업인들과 실시간으로 대화하세요. 자유로운 주제로 이야기를 나눌 수 있는 소통 공간입니다.',
  },
};

// ── 기본 메타 (알 수 없는 경로) ──
const DEFAULT_META = PAGE_META['/'];

// ── OG 이미지 URL ──
const OG_IMAGE = 'https://pub-1d5977ce7cec48079bcd6f847b2f3dd1.r2.dev/logos/og-image.png';
const SITE_URL = 'https://seonnam.com';

/**
 * 경로에 맞는 메타 정보 반환
 */
function getMetaForPath(pathname) {
  // 정확한 매칭 먼저
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  // 동적 경로 매칭
  if (pathname.startsWith('/post/')) {
    return {
      title: '게시물 - 참외이야기',
      description: '참외이야기 커뮤니티 게시물입니다. 성주군 참외 농업인들의 소통 공간.',
      keywords: '참외이야기, 커뮤니티, 성주참외, 게시물',
      bodyText: '참외이야기 커뮤니티 게시물입니다.',
    };
  }
  if (pathname.startsWith('/qna/')) {
    return {
      title: '질문답변 - 참외이야기',
      description: '참외 재배 관련 질문과 답변. 경험 많은 농업인들에게 물어보세요.',
      keywords: '참외질문, 참외답변, 참외재배',
      bodyText: '참외 재배 관련 질문과 답변입니다.',
    };
  }
  if (pathname.startsWith('/secondhand/')) {
    return {
      title: '중고거래 - 참외이야기',
      description: '성주군 농업인들의 중고거래 상세 정보.',
      keywords: '농기구중고, 중고거래, 성주',
      bodyText: '성주군 농업인들의 중고거래 상세 정보입니다.',
    };
  }
  if (pathname.startsWith('/profile/')) {
    return {
      title: '프로필 - 참외이야기',
      description: '참외이야기 사용자 프로필입니다.',
      keywords: '참외이야기, 프로필, 사용자',
      bodyText: '참외이야기 사용자 프로필 페이지입니다.',
    };
  }

  return DEFAULT_META;
}

/**
 * 크롤러용 SEO HTML 생성
 */
function generateSeoHtml(meta, pathname) {
  const canonicalUrl = `${SITE_URL}${pathname === '/' ? '' : pathname}`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${meta.title}</title>
  <meta name="description" content="${meta.description}" />
  <meta name="keywords" content="${meta.keywords}" />
  <meta name="author" content="참외이야기" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${canonicalUrl}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="참외이야기" />
  <meta property="og:title" content="${meta.title}" />
  <meta property="og:description" content="${meta.description}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:locale" content="ko_KR" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${meta.title}" />
  <meta name="twitter:description" content="${meta.description}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />

  <!-- Naver / Google 인증 -->
  <meta name="naver-site-verification" content="naver5049a90e158c395bed64e14802fa4290" />
  <meta name="google-site-verification" content="구글인증코드를여기에입력" />

  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#004225" />
  <link rel="icon" type="image/svg+xml" href="/logo.svg" />

  <!-- 구조화된 데이터 (JSON-LD) -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "참외이야기",
    "alternateName": "성주 참외 커뮤니티",
    "url": "${SITE_URL}",
    "description": "${meta.description}",
    "publisher": {
      "@type": "Organization",
      "name": "참외이야기",
      "logo": {
        "@type": "ImageObject",
        "url": "${SITE_URL}/cf.png"
      }
    }
  }
  </script>
</head>
<body>
  <header>
    <h1>${meta.title}</h1>
    <nav>
      <ul>
        <li><a href="${SITE_URL}/">홈</a></li>
        <li><a href="${SITE_URL}/community">커뮤니티</a></li>
        <li><a href="${SITE_URL}/qna">질문답변</a></li>
        <li><a href="${SITE_URL}/market">시세정보</a></li>
        <li><a href="${SITE_URL}/secondhand">중고거래</a></li>
        <li><a href="${SITE_URL}/lounge">광장</a></li>
      </ul>
    </nav>
  </header>
  <main>
    <article>
      <h2>${meta.title}</h2>
      <p>${meta.bodyText}</p>
    </article>
    <section>
      <h3>참외이야기 주요 기능</h3>
      <ul>
        <li>성주군 참외 농업인 커뮤니티 - 재배 정보, 노하우 공유</li>
        <li>실시간 산지시세 및 도매시세 확인</li>
        <li>농업 관련 질문답변 (Q&A)</li>
        <li>중고 농기구 및 자재 거래</li>
        <li>실시간 날씨 정보 (성주군)</li>
        <li>농업인 간 자유로운 소통 공간 (광장)</li>
      </ul>
    </section>
  </main>
  <footer>
    <p>© 참외이야기 - 성주군 농업인을 위한 커뮤니티</p>
    <p>문의: seonnam.com</p>
  </footer>
</body>
</html>`;
}

/**
 * Edge Function 핸들러
 */
export default async function handler(req) {
  const ua = req.headers.get('user-agent') || '';
  const url = new URL(req.url);
  const pathname = url.pathname;

  // 크롤러 감지
  if (CRAWLER_UA.test(ua)) {
    const meta = getMetaForPath(pathname);
    return new Response(generateSeoHtml(meta, pathname), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  }

  // 일반 사용자: 정적 index.html 반환
  const origin = url.origin;
  try {
    const indexResponse = await fetch(`${origin}/_app.html`, {
      headers: { 'x-bypass-render': 'true' },
    });

    // index.html 응답을 그대로 전달
    return new Response(indexResponse.body, {
      status: indexResponse.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (e) {
    // fallback: 리다이렉트
    return Response.redirect(`${origin}/_app.html`, 302);
  }
}
