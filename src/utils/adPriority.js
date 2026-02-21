/**
 * 광고 우선순위 정렬 유틸리티
 * - 가중치 기반 랜덤 셔플: 높은 우선순위 광고일수록 앞에 뽑힐 확률↑, 매 로드마다 순서 변동
 * - 마감 임박 광고 우선 (3일 이내)
 * - priority + priority_boost 반영
 * - CTR(클릭률) 낮은 광고 우선 (형평성)
 * - 로컬 세션 노출 빈도 반영
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
 * 가중치 기반 랜덤 셔플
 * - 높은 점수 = 앞 순서에 뽑힐 확률이 높음 (확률적, 결정적이지 않음)
 * - 모든 광고가 순서에 포함되므로 낮은 우선순위 광고도 노출됨
 * @param {Array} adsWithScore - _score 필드가 있는 광고 배열
 * @returns {Array} 가중치 기반 랜덤 정렬된 배열
 */
const weightedRandomShuffle = (adsWithScore) => {
  const remaining = [...adsWithScore];
  const result = [];

  while (remaining.length > 0) {
    const totalWeight = remaining.reduce((sum, a) => sum + a._score, 0);
    let rand = Math.random() * totalWeight;

    let selectedIdx = remaining.length - 1; // 기본값 (부동소수점 오차 방지)
    for (let i = 0; i < remaining.length; i++) {
      rand -= remaining[i]._score;
      if (rand <= 0) {
        selectedIdx = i;
        break;
      }
    }

    result.push(remaining[selectedIdx]);
    remaining.splice(selectedIdx, 1);
  }

  return result;
};

/**
 * 광고 배열을 가중치 기반 랜덤 셔플로 정렬
 * @param {Array} ads - 광고 배열
 * @param {Object} viewCountsSnapshot - 로컬 노출 기록 스냅샷 (없으면 현재 값 사용)
 * @returns {Array} 가중치 기반 랜덤 정렬된 광고 배열
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

    // 2. 마감 임박 보너스 (3일 이내 마감 광고, 최대 50점으로 제한)
    if (ad.end_date) {
      const endDate = new Date(ad.end_date);
      if (endDate <= threeDaysLater && endDate >= now) {
        const daysLeft = (endDate - now) / (24 * 60 * 60 * 1000);
        const urgencyBonus = Math.max(0, 50 - (daysLeft * 15)); // 최대 50점 (기존 500 → 50)
        score += urgencyBonus;
      }
    }

    // 3. CTR 기반 점수 (낮은 CTR = 더 많은 노출 기회, 최대 20점)
    const impressions = ad.impressions || 0;
    const clicks = ad.clicks || 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const ctrBonus = Math.max(0, 20 - (ctr * 200)); // 최대 20점 (기존 100 → 20)
    score += ctrBonus;

    // 4. 로컬 세션 노출 빈도 (적게 본 광고 우선, 최대 -30점/회)
    const localViewCount = viewCounts[`ad_${ad.id}`] || 0;
    const localViewPenalty = localViewCount * 30; // 기존 50 → 30
    score -= localViewPenalty;

    // 최소 가중치 1 보장 (음수 방지 - 가중치 랜덤 셔플에 필요)
    return { ...ad, _score: Math.max(score, 1) };
  });

  // 가중치 기반 랜덤 셔플 (결정적 정렬 → 확률적 정렬)
  return weightedRandomShuffle(adsWithScore).map(({ _score, ...ad }) => ad);
};
