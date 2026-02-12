/**
 * 광고 우선순위 정렬 유틸리티
 * - 마감 임박 광고 우선 (3일 이내)
 * - priority + priority_boost 반영
 * - CTR(클릭률) 낮은 광고 우선 (형평성)
 * - 로컬 세션 노출 빈도 반영 + 랜덤 요소
 *
 * 사용처: EnhancedInstagramFeed, MarketCards, SecondHand, QnAList
 */

/**
 * 로컬 스토리지에서 광고 노출 기록 가져오기
 */
export const getAdViewCounts = () => {
  try {
    const stored = localStorage.getItem('adViewCounts');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

/**
 * 광고 노출 기록 저장
 */
export const incrementAdViewCount = (adId) => {
  try {
    const counts = getAdViewCounts();
    const key = `ad_${adId}`;
    counts[key] = (counts[key] || 0) + 1;
    localStorage.setItem('adViewCounts', JSON.stringify(counts));
    return counts;
  } catch {
    return {};
  }
};

/**
 * 광고 배열을 우선순위 점수 기반으로 정렬
 * @param {Array} ads - 광고 배열
 * @param {Object} viewCountsSnapshot - 로컬 노출 기록 스냅샷 (없으면 현재 값 사용)
 * @returns {Array} 정렬된 광고 배열
 */
export const sortAdsByPriority = (ads, viewCountsSnapshot = null) => {
  if (!ads || ads.length === 0) return [];

  const viewCounts = viewCountsSnapshot || getAdViewCounts();
  const now = new Date();
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const adsWithScore = ads.map(ad => {
    let score = 0;

    // 1. 기본 우선순위 (priority + priority_boost)
    const basePriority = (ad.priority || 0) + (ad.priority_boost || 0);
    score += basePriority * 10;

    // 2. 마감 임박 보너스 (3일 이내 마감 광고)
    if (ad.end_date) {
      const endDate = new Date(ad.end_date);
      if (endDate <= threeDaysLater && endDate >= now) {
        const daysLeft = (endDate - now) / (24 * 60 * 60 * 1000);
        const urgencyBonus = Math.max(0, 500 - (daysLeft * 150));
        score += urgencyBonus;
      }
    }

    // 3. CTR 기반 점수 (낮은 CTR = 더 많은 노출 기회)
    const impressions = ad.impressions || 0;
    const clicks = ad.clicks || 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const ctrBonus = Math.max(0, 100 - (ctr * 1000));
    score += ctrBonus;

    // 4. 로컬 세션 노출 빈도 (적게 본 광고 우선)
    const localViewCount = viewCounts[`ad_${ad.id}`] || 0;
    const localViewPenalty = localViewCount * 50;
    score -= localViewPenalty;

    // 5. 랜덤 요소 (0~50점, 같은 점수일 때 변동성)
    const randomBonus = Math.random() * 50;
    score += randomBonus;

    return { ...ad, _score: score };
  });

  return adsWithScore
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...ad }) => ad);
};
