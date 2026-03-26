/**
 * marketCombinedService.js
 * 산지+도매 합산 데이터 서비스 (홈 하단 종합 카드용)
 *
 * 기능:
 * - 산지(성주군) + 도매시장 합산 추세 데이터 조회
 * - 작년 동일 요일 기준 비교 데이터 조회
 * - 요일 매칭 로직 (토: 산지 휴장, 일: 도매 휴장 반영)
 */
import { supabase } from '../config/supabase.js';
import marketService from './marketService.js';

const marketCombinedService = {
  /**
   * 작년 동일 요일 합산 데이터 조회 (요일 기준 비교)
   * 올해 선택된 날짜의 요일과 동일한 작년 날짜 데이터를 조회
   * 예: 2026-03-26(목) → 작년 같은 주차의 목요일 근처 데이터
   * @param {string} date - 올해 기준 날짜 (YYYY-MM-DD)
   * @returns {Object|null} 작년 동일 요일 합산 데이터
   */
  async getLastYearSameWeekday(date) {
    try {
      const [y, m, d] = date.split('-').map(Number);
      const thisDate = new Date(y, m - 1, d);
      const lastYearBase = new Date(y - 1, m - 1, d);
      const thisDay = thisDate.getDay();
      const lastDay = lastYearBase.getDay();
      const diff = thisDay - lastDay;
      // 요일 차이만큼 조정 (-3~+3 범위)
      const adjustedDate = new Date(lastYearBase);
      if (Math.abs(diff) <= 3) {
        adjustedDate.setDate(adjustedDate.getDate() + diff);
      } else {
        adjustedDate.setDate(adjustedDate.getDate() + diff - 7 * Math.sign(diff));
      }
      const fmt = (dt) => {
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      };
      const targetDate = fmt(adjustedDate);
      const rangeStart = new Date(adjustedDate);
      rangeStart.setDate(rangeStart.getDate() - 7);
      const rangeEnd = new Date(adjustedDate);
      rangeEnd.setDate(rangeEnd.getDate() + 7);

      const { data: rows, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, region_name, total_boxes, total_amount, avg_price, max_price, min_price')
        .in('region_name', ['성주군', '도매시장'])
        .gte('market_date', fmt(rangeStart))
        .lte('market_date', fmt(rangeEnd))
        .order('market_date', { ascending: false });

      if (error) throw error;
      if (!rows || rows.length === 0) return null;

      // 같은 요일인 날짜들만 필터 → targetDate에 가장 가까운 날짜 선택
      const dateMap = new Map();
      rows.forEach(row => {
        const rowDay = new Date(row.market_date + 'T00:00:00').getDay();
        if (rowDay === thisDay) {
          if (!dateMap.has(row.market_date)) dateMap.set(row.market_date, []);
          dateMap.get(row.market_date).push(row);
        }
      });

      if (dateMap.size === 0) return null;

      const sortedDates = [...dateMap.keys()].sort((a, b) => {
        return Math.abs(new Date(a) - new Date(targetDate)) - Math.abs(new Date(b) - new Date(targetDate));
      });
      const bestDate = sortedDates[0];
      const bestRows = dateMap.get(bestDate);

      const seongju = bestRows.find(r => r.region_name === '성주군');
      const wholesale = bestRows.find(r => r.region_name === '도매시장');
      const totalBoxes = (seongju?.total_boxes || 0) + (wholesale?.total_boxes || 0);
      const totalAmount = (seongju?.total_amount || 0) + (wholesale?.total_amount || 0);
      const avgPrice = totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0;

      return {
        date: bestDate,
        totalBoxes,
        totalAmount,
        avgPrice,
        seongjuBoxes: seongju?.total_boxes || 0,
        wholesaleBoxes: wholesale?.total_boxes || 0,
      };
    } catch (error) {
      console.error('작년 동일 요일 데이터 조회 오류:', error);
      return null;
    }
  },

  /**
   * 산지+도매 합산 추세 데이터 조회 (홈 하단 합산 카드 그래프용)
   * 올해 데이터 + 작년 동일 요일 매칭 데이터 병합 반환
   * @param {string} startDate - 시작 날짜 (YYYY-MM-DD)
   * @param {string} endDate - 종료 날짜 (YYYY-MM-DD)
   * @returns {Array} 합산 추세 데이터 (lastYear_avg_price, lastYear_total_boxes 포함)
   */
  async getCombinedTrendData(startDate, endDate) {
    try {
      // 작년 동일 기간 계산 (요일 매칭)
      const [sY, sM, sD] = startDate.split('-').map(Number);
      const [eY, eM, eD] = endDate.split('-').map(Number);
      const startDt = new Date(sY, sM - 1, sD);
      const endDt = new Date(eY, eM - 1, eD);
      const lyEnd = new Date(eY - 1, eM - 1, eD);
      const dayDiff = endDt.getDay() - lyEnd.getDay();
      const adj = Math.abs(dayDiff) <= 3 ? dayDiff : dayDiff - 7 * Math.sign(dayDiff);
      lyEnd.setDate(lyEnd.getDate() + adj);
      const lyStart = new Date(lyEnd);
      lyStart.setDate(lyStart.getDate() - (Math.round((endDt - startDt) / 86400000)));
      const fmt = (dt) => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;

      // 올해 + 작년 병렬 조회 (4개 쿼리 동시)
      const [seongjuData, wholesaleData, lySeonju, lyWholesale] = await Promise.all([
        marketService.getSeongjuAggregateTrend(startDate, endDate),
        marketService.getWholesaleTrendData(startDate, endDate),
        marketService.getSeongjuAggregateTrend(fmt(lyStart), fmt(lyEnd)),
        marketService.getWholesaleTrendData(fmt(lyStart), fmt(lyEnd)),
      ]);

      // 올해 데이터 합산
      const seongjuMap = new Map(seongjuData.map(d => [d.market_date, d]));
      const wholesaleMap = new Map(wholesaleData.map(d => [d.market_date, d]));
      const allDates = [...new Set([
        ...seongjuData.map(d => d.market_date),
        ...wholesaleData.map(d => d.market_date),
      ])].sort();

      // 작년 데이터 합산 → 날짜순 배열
      const lyAllMap = new Map();
      lySeonju.forEach(d => {
        if (!lyAllMap.has(d.market_date)) lyAllMap.set(d.market_date, { s: null, w: null });
        lyAllMap.get(d.market_date).s = d;
      });
      lyWholesale.forEach(d => {
        if (!lyAllMap.has(d.market_date)) lyAllMap.set(d.market_date, { s: null, w: null });
        lyAllMap.get(d.market_date).w = d;
      });
      const lyDates = [...lyAllMap.keys()].sort();
      const lyMerged = lyDates.map(date => {
        const { s, w } = lyAllMap.get(date);
        const boxes = (s?.total_boxes || 0) + (w?.total_boxes || 0);
        const amount = (s?.total_amount || 0) + (w?.total_amount || 0);
        return { date, avg_price: boxes > 0 ? Math.round(amount / boxes) : 0, total_boxes: boxes };
      });

      // 올해 데이터에 작년 요일 매칭 병합 (같은 요일끼리 순서 매칭)
      return allDates.map((date) => {
        const s = seongjuMap.get(date);
        const w = wholesaleMap.get(date);
        const totalBoxes = (s?.total_boxes || 0) + (w?.total_boxes || 0);
        const totalAmount = (s?.total_amount || 0) + (w?.total_amount || 0);
        const avgPrice = totalBoxes > 0 ? Math.round(totalAmount / totalBoxes) : 0;

        // 같은 요일끼리 순서 매칭
        const thisDay = new Date(date + 'T00:00:00').getDay();
        const sameDayDates = allDates.filter(d => new Date(d + 'T00:00:00').getDay() === thisDay);
        const sameDayIdx = sameDayDates.indexOf(date);
        const lySameDays = lyMerged.filter(ly => new Date(ly.date + 'T00:00:00').getDay() === thisDay);
        const lyByOrder = lySameDays[sameDayIdx] || null;

        return {
          market_date: date,
          avg_price: avgPrice,
          total_boxes: totalBoxes,
          total_amount: totalAmount,
          seongju_boxes: s?.total_boxes || 0,
          seongju_avg: s?.avg_price || 0,
          wholesale_boxes: w?.total_boxes || 0,
          wholesale_avg: w?.avg_price || 0,
          hasSeonju: !!s,
          hasWholesale: !!w,
          lastYear_avg_price: lyByOrder?.avg_price || null,
          lastYear_total_boxes: lyByOrder?.total_boxes || null,
          lastYear_date: lyByOrder?.date || null,
        };
      });
    } catch (error) {
      console.error('합산 추세 데이터 조회 오류:', error);
      return [];
    }
  },
};

export default marketCombinedService;
