/**
 * 가격 정보 공유 유틸리티
 * Web Share API + 클립보드 fallback
 */

// 날짜 포맷 (M/D)
const formatShareDate = (dateStr) => {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

// 공판장명 축약 (성주참외원예농협공판장 → 선남공판장)
const shortenMarketName = (name) => {
  if (name.includes('성주참외원예농협')) return '선남공판장';
  if (name.includes('성주군농협')) return '성주군농협공판장';
  // 기타 공판장은 그대로
  return name;
};

/**
 * 공판장 카드용 공유 텍스트 생성
 */
export const generateMarketShareText = (market, date) => {
  const formattedDate = formatShareDate(date);
  const shortName = shortenMarketName(market.name);

  return `[참외이야기] ${formattedDate} 시세

📊 ${shortName}
평균 ${market.averagePrice?.toLocaleString()} | 최고 ${market.maxPrice?.toLocaleString()} | 최저 ${market.minPrice?.toLocaleString()}
출하량 ${market.totalQuantity?.toLocaleString()}${market.unit}

👉 ${window.location.origin}/?date=${date}`;
};

/**
 * 상세 페이지용 공유 텍스트 생성
 */
export const generatePriceDetailShareText = (market, date, briefing) => {
  const formattedDate = formatShareDate(date);
  const shortName = shortenMarketName(market.name);

  let text = `[참외이야기] ${formattedDate} ${shortName} 시세

📊 오늘 시세
평균 ${market.averagePrice?.toLocaleString()} | 최고 ${market.maxPrice?.toLocaleString()} | 최저 ${market.minPrice?.toLocaleString()}
출하량 ${market.totalQuantity?.toLocaleString()}${market.unit}`;

  if (briefing) {
    text += `

💬 ${briefing}`;
  }

  text += `

👉 ${window.location.origin}/prices?market=${encodeURIComponent(market.name)}&date=${date}`;

  return text;
};

/**
 * Web Share API 또는 클립보드 복사
 * @returns {Promise<{success: boolean, method: 'share'|'clipboard'|'cancelled', error?: Error}>}
 */
export const shareContent = async (title, text, url) => {
  // Web Share API 지원 여부 확인
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return { success: true, method: 'share' };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, method: 'cancelled' };
      }
      // share 실패 시 clipboard로 fallback
      console.warn('Web Share API 실패, 클립보드로 fallback:', error);
    }
  }

  // Clipboard fallback (PC 또는 share 실패 시)
  try {
    await navigator.clipboard.writeText(text);
    return { success: true, method: 'clipboard' };
  } catch (error) {
    console.error('클립보드 복사 실패:', error);
    return { success: false, error };
  }
};

export default {
  generateMarketShareText,
  generatePriceDetailShareText,
  shareContent
};
