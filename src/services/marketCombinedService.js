/**
 * marketCombinedService.js
 * 산지+도매 합산 데이터 서비스 (홈 하단 종합 카드용)
 *
 * 합산 규칙:
 * - 기준일(baseDate) = 산지(성주군) 날짜
 * - 합산 = 산지(baseDate) + 도매(baseDate+1) — 항상 쌍으로만 표시
 * - selectedDate >= 오늘이면 baseDate = selectedDate - 1 (전일 산지 + 당일 도매)
 * - selectedDate < 오늘이면 baseDate = selectedDate (해당일 산지 + 익일 도매)
 * - 전년 비교: 항상 산지+도매 합산 (seongjuOnly 모드 없음)
 * - 추세 차트: 모든 날짜가 산지(date)+도매(date+1) — 예외 없음
 */
import { supabase } from '../config/supabase.js';
import marketService from './marketService.js';

// 날짜 포맷 유틸
const fmt = (dt) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

// 익일 날짜 계산
const getNextDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + 1);
  return fmt(dt);
};

// 요일 매칭: 작년 동일 날짜 근처에서 같은 요일 찾기
const findLastYearWeekdayDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const thisDate = new Date(y, m - 1, d);
  const lyBase = new Date(y - 1, m - 1, d);
  const thisDay = thisDate.getDay();
  const lyDay = lyBase.getDay();
  const diff = thisDay - lyDay;
  const adj = Math.abs(diff) <= 3 ? diff : diff - 7 * Math.sign(diff);
  lyBase.setDate(lyBase.getDate() + adj);
  return { targetDate: fmt(lyBase), weekday: thisDay };
};

const marketCombinedService = {
  /**
   * 도매시장 특정 날짜 데이터 조회
   * @param {string} date - 조회할 날짜 (YYYY-MM-DD)
   * @returns {Object|null}
   */
  async getWholesaleForDate(date) {
    try {
      const { data, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, total_boxes, total_amount, avg_price, max_price, min_price')
        .eq('region_name', '도매시장')
        .eq('market_date', date)
        .maybeSingle();
      if (error) throw error;
      return data && (data.avg_price > 0 || data.total_boxes > 0) ? data : null;
    } catch (error) {
      console.error('도매시장 날짜 데이터 조회 오류:', error);
      return null;
    }
  },

  /**
   * 성주군 산지 특정 날짜 데이터 조회
   * @param {string} date - 조회할 날짜 (YYYY-MM-DD)
   * @returns {Object|null}
   */
  async getSeongjuForDate(date) {
    try {
      const { data, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, total_boxes, total_amount, avg_price, max_price, min_price')
        .eq('region_name', '성주군')
        .eq('market_date', date)
        .maybeSingle();
      if (error) throw error;
      return data && (data.avg_price > 0 || data.total_boxes > 0) ? data : null;
    } catch (error) {
      console.error('산지 날짜 데이터 조회 오류:', error);
      return null;
    }
  },

  /**
   * 작년 비교 데이터 조회 — 항상 산지(date)+도매(date+1) 합산
   * 요일 기준으로 작년 같은 요일 날짜를 매칭
   * @param {string} date - 기준 날짜 (baseDate, 산지 날짜)
   * @returns {Object|null}
   */
  async getLastYearComparison(date) {
    try {
      const { targetDate, weekday } = findLastYearWeekdayDate(date);

      // 작년 ±7일 범위에서 같은 요일 검색
      const rangeStart = new Date(targetDate + 'T00:00:00');
      rangeStart.setDate(rangeStart.getDate() - 7);
      const rangeEnd = new Date(targetDate + 'T00:00:00');
      rangeEnd.setDate(rangeEnd.getDate() + 7);

      const { data: rows, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, region_name, total_boxes, total_amount, avg_price')
        .in('region_name', ['성주군', '도매시장'])
        .gte('market_date', fmt(rangeStart))
        .lte('market_date', fmt(rangeEnd))
        .order('market_date', { ascending: false });

      if (error) throw error;
      if (!rows || rows.length === 0) return null;

      // 같은 요일 날짜들 그룹핑
      const dateMap = new Map();
      rows.forEach(row => {
        const dow = new Date(row.market_date + 'T00:00:00').getDay();
        if (dow === weekday) {
          if (!dateMap.has(row.market_date)) dateMap.set(row.market_date, []);
          dateMap.get(row.market_date).push(row);
        }
      });
      if (dateMap.size === 0) return null;

      // targetDate에 가장 가까운 날짜 선택
      const bestDate = [...dateMap.keys()].sort((a, b) =>
        Math.abs(new Date(a) - new Date(targetDate)) - Math.abs(new Date(b) - new Date(targetDate))
      )[0];
      const bestRows = dateMap.get(bestDate);
      const lySeongju = bestRows.find(r => r.region_name === '성주군');

      // 항상 도매(익일) 합산
      const lyNextDate = getNextDate(bestDate);
      const { data: lyWholesale } = await supabase
        .from('market_aggregate_summary')
        .select('total_boxes, total_amount, avg_price')
        .eq('region_name', '도매시장')
        .eq('market_date', lyNextDate)
        .maybeSingle();

      const sBoxes = lySeongju?.total_boxes || 0;
      const sAmount = lySeongju?.total_amount || 0;
      const wBoxes = lyWholesale?.total_boxes || 0;
      const wAmount = lyWholesale?.total_amount || 0;
      const totalBoxes = sBoxes + wBoxes;
      const totalAmount = sAmount + wAmount;

      return {
        date: bestDate,
        wholesaleDate: wBoxes > 0 ? lyNextDate : null,
        totalBoxes,
        totalAmount,
        avgPrice: totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0,
        seongjuBoxes: sBoxes,
        wholesaleBoxes: wBoxes,
      };
    } catch (error) {
      console.error('작년 비교 데이터 조회 오류:', error);
      return null;
    }
  },

  /**
   * 추세 차트용 합산 데이터 — 모든 날짜가 산지(date)+도매(date+1)
   * 예외 없이 전부 합산, 작년도 동일 패턴으로 합산 비교
   * @param {string} startDate - 산지 기준 시작일 (YYYY-MM-DD)
   * @param {string} endDate - 산지 기준 종료일 (YYYY-MM-DD)
   * @returns {Array}
   */
  async getCombinedTrendData(startDate, endDate) {
    try {
      // 도매 조회 범위: startDate+1 ~ endDate+1 (익일 매칭용)
      const wholesaleEnd = getNextDate(endDate);
      const wholesaleStart = getNextDate(startDate);

      // 작년 기간 계산 (요일 매칭)
      const { targetDate: lyEnd } = findLastYearWeekdayDate(endDate);
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [eY, eM, eD] = endDate.split('-').map(Number);
      const daySpan = Math.round((new Date(eY, eM - 1, eD) - new Date(sY, sM - 1, sD)) / 86400000);
      const lyEndDt = new Date(lyEnd + 'T00:00:00');
      const lyStartDt = new Date(lyEndDt);
      lyStartDt.setDate(lyStartDt.getDate() - daySpan);
      const lyWholesaleEndDt = new Date(lyEndDt);
      lyWholesaleEndDt.setDate(lyWholesaleEndDt.getDate() + 1);

      // 올해/작년 산지+도매 데이터 병렬 조회
      const [seongjuData, wholesaleData, lySeonju, lyWholesale] = await Promise.all([
        marketService.getSeongjuAggregateTrend(startDate, endDate),
        marketService.getWholesaleTrendData(wholesaleStart, wholesaleEnd),
        marketService.getSeongjuAggregateTrend(fmt(lyStartDt), fmt(lyEndDt)),
        marketService.getWholesaleTrendData(
          getNextDate(fmt(lyStartDt)),
          fmt(lyWholesaleEndDt)
        ),
      ]);

      // 산지 기준 날짜 목록
      const seongjuDates = seongjuData.map(d => d.market_date).sort();
      const seongjuMap = new Map(seongjuData.map(d => [d.market_date, d]));

      // 도매: 익일 데이터를 산지 기준일로 역매핑 (도매date-1 → 산지 기준일)
      const wholesaleByPrevDay = new Map();
      wholesaleData.forEach(d => {
        const [wy, wm, wd] = d.market_date.split('-').map(Number);
        const prevDt = new Date(wy, wm - 1, wd);
        prevDt.setDate(prevDt.getDate() - 1);
        wholesaleByPrevDay.set(fmt(prevDt), d);
      });

      // 작년 데이터 맵 구성
      const lySeongjuMap = new Map(lySeonju.map(d => [d.market_date, d]));
      const lyWholesaleByPrevDay = new Map();
      lyWholesale.forEach(d => {
        const [wy, wm, wd] = d.market_date.split('-').map(Number);
        const prevDt = new Date(wy, wm - 1, wd);
        prevDt.setDate(prevDt.getDate() - 1);
        lyWholesaleByPrevDay.set(fmt(prevDt), d);
      });
      const lyDates = [...lySeongjuMap.keys()].sort();

      // 작년 데이터 합산 (항상 산지+도매 합산, 예외 없음)
      const lyMergedFull = lyDates.map(date => {
        const s = lySeongjuMap.get(date);
        const w = lyWholesaleByPrevDay.get(date);
        const sBoxes = s?.total_boxes || 0;
        const sAmount = s?.total_amount || 0;
        const wBoxes = w?.total_boxes || 0;
        const wAmount = w?.total_amount || 0;
        const totalBoxes = sBoxes + wBoxes;
        const totalAmount = sAmount + wAmount;
        return {
          date,
          avg_price: totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0,
          total_boxes: totalBoxes,
        };
      });

      // 올해 데이터 조합 — 모든 날짜가 산지+도매(익일)
      return seongjuDates.map(date => {
        const s = seongjuMap.get(date);
        const w = wholesaleByPrevDay.get(date);

        const sBoxes = s?.total_boxes || 0;
        const sAmount = s?.total_amount || 0;
        const wBoxes = w?.total_boxes || 0;
        const wAmount = w?.total_amount || 0;
        const totalBoxes = sBoxes + wBoxes;
        const totalAmount = sAmount + wAmount;
        const avgPrice = totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0;

        // 작년 매칭: 같은 요일끼리 순서 매칭
        const thisDay = new Date(date + 'T00:00:00').getDay();
        const sameDayDates = seongjuDates.filter(d => new Date(d + 'T00:00:00').getDay() === thisDay);
        const sameDayIdx = sameDayDates.indexOf(date);
        const lySameDays = lyMergedFull.filter(ly => new Date(ly.date + 'T00:00:00').getDay() === thisDay);
        const lyMatch = lySameDays[sameDayIdx] || null;

        return {
          market_date: date,
          avg_price: avgPrice,
          total_boxes: totalBoxes,
          total_amount: totalAmount,
          seongju_boxes: sBoxes,
          wholesale_boxes: wBoxes,
          wholesale_date: getNextDate(date),
          hasSeonju: !!s,
          hasWholesale: !!w,
          lastYear_avg_price: lyMatch?.avg_price ?? null,
          lastYear_total_boxes: lyMatch?.total_boxes ?? null,
          lastYear_date: lyMatch?.date || null,
        };
      });
    } catch (error) {
      console.error('합산 추세 데이터 조회 오류:', error);
      return [];
    }
  },
};

export default marketCombinedService;
