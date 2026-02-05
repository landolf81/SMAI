import { supabase } from '../config/supabase.js';

/**
 * 시장 정보 서비스
 * 경락 정보 및 관심 시장, 알림 관리
 */
export const marketService = {
  /**
   * 가장 최근 데이터가 있는 날짜 조회
   * @returns {string|null} 날짜 (YYYY-MM-DD) 또는 null
   */
  async getLatestMarketDate() {
    try {
      const { data, error } = await supabase
        .from('market_summary')
        .select('market_date')
        .order('market_date', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.error('최신 날짜 조회 오류:', error);
        return null;
      }

      return data?.market_date || null;
    } catch (error) {
      console.error('최신 날짜 조회 예외:', error);
      return null;
    }
  },

  /**
   * 사용자 관심 시장 목록 조회
   */
  async getFavorites() {
    try {
      // 읽기 전용 - 캐시된 세션 사용
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('market_favorites')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('관심 시장 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 관심 시장 추가
   */
  async addToFavorites(marketData) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 기존 관심 목록 확인
      const { data: existing } = await supabase
        .from('market_favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('market_name', marketData.marketName)
        .eq('item_name', marketData.itemName || '참외')
        .eq('weight', marketData.weight)
        .eq('grade', marketData.grade)
        .maybeSingle();

      if (existing) {
        // 이미 있으면 is_active = true로 업데이트
        const { data, error } = await supabase
          .from('market_favorites')
          .update({
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // 없으면 새로 추가
        const { data, error } = await supabase
          .from('market_favorites')
          .insert([{
            user_id: user.id,
            market_name: marketData.marketName,
            item_name: marketData.itemName || '참외',
            weight: marketData.weight,
            grade: marketData.grade,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('관심 시장 추가 오류:', error);
      throw error;
    }
  },

  /**
   * 관심 시장 제거
   */
  async removeFromFavorites(favoriteId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('market_favorites')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', favoriteId)
        .eq('user_id', user.id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('관심 시장 제거 오류:', error);
      throw error;
    }
  },

  /**
   * 가격 알림 목록 조회
   */
  async getAlerts() {
    try {
      // 읽기 전용 - 캐시된 세션 사용
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('market_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('가격 알림 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 가격 알림 생성
   */
  async createAlert(alertData) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('market_alerts')
        .insert([{
          user_id: user.id,
          market_name: alertData.marketName,
          item_name: alertData.itemName || '참외',
          weight: alertData.weight,
          grade: alertData.grade,
          alert_type: alertData.alertType,
          target_price: alertData.targetPrice,
          notification_type: alertData.notificationType || 'web',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('가격 알림 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 가격 알림 수정
   */
  async updateAlert(alertId, updates) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('market_alerts')
        .update({
          target_price: updates.targetPrice,
          is_active: updates.isActive,
          notification_type: updates.notificationType,
          updated_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('가격 알림 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 가격 알림 삭제
   */
  async deleteAlert(alertId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('market_alerts')
        .update({
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', alertId)
        .eq('user_id', user.id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('가격 알림 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 특정 날짜에 데이터가 있는 시장 목록 조회
   * @param {string} date - 날짜 (YYYY-MM-DD)
   */
  async getAvailableMarkets(date) {
    try {
      const { data, error} = await supabase
        .from('market_summary')
        .select('market_name')
        .eq('market_date', date)
        .order('market_name');

      if (error) throw error;

      // 중복 제거
      const uniqueMarkets = [...new Set(data.map(item => item.market_name))];
      return uniqueMarkets;
    } catch (error) {
      console.error('시장 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 여러 시장의 경락가 정보 조회 (전 경매일 비교 포함)
   * @param {Array<string>} markets - 시장명 배열
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @returns {Object} { success: boolean, markets: Array }
   */
  async getMultipleMarkets(markets, date) {
    try {
      // 1. 현재 날짜의 시장 데이터 조회
      const { data, error } = await supabase
        .from('market_summary')
        .select('*')
        .in('market_name', markets)
        .eq('market_date', date)
        .order('market_name');

      if (error) throw error;

      // 2. 각 시장별로 전 경매일 찾기 및 비교 데이터 생성
      const transformedMarkets = await Promise.all((data || []).map(async (market) => {
        // 전 경매일 찾기 (현재 날짜보다 이전 날짜 중 가장 최근)
        const { data: previousDateData } = await supabase
          .from('market_summary')
          .select('*')
          .eq('market_name', market.market_name)
          .lt('market_date', date)
          .order('market_date', { ascending: false })
          .limit(1)
          .single();

        // 전일 비교 계산
        const currentAvgPrice = parseInt(market.avg_price) || 0;
        const previousAvgPrice = previousDateData ? (parseInt(previousDateData.avg_price) || 0) : 0;
        const avgChange = previousAvgPrice > 0 ? currentAvgPrice - previousAvgPrice : 0;
        const avgChangePercent = previousAvgPrice > 0
          ? Math.round((avgChange / previousAvgPrice) * 1000) / 10
          : 0;

        const currentMinPrice = parseInt(market.min_price) || 0;
        const previousMinPrice = previousDateData ? (parseInt(previousDateData.min_price) || 0) : 0;

        const currentMaxPrice = parseInt(market.max_price) || 0;
        const previousMaxPrice = previousDateData ? (parseInt(previousDateData.max_price) || 0) : 0;

        const currentVolume = parseInt(market.total_boxes) || 0;
        const previousVolume = previousDateData ? (parseInt(previousDateData.total_boxes) || 0) : 0;

        return {
          market_name: market.market_name,
          success: true,
          data: {
            summary: {
              overall_avg_price: currentAvgPrice,
              total_boxes: currentVolume,
              total_amount: parseInt(market.total_amount) || 0
            },
            details: [
              {
                boxes: currentVolume,
                min_price: currentMinPrice,
                max_price: currentMaxPrice,
                avg_price: currentAvgPrice
              }
            ],
            previous_min_price: previousMinPrice,
            previous_max_price: previousMaxPrice,
            overall_comparison: {
              comparison_available: previousAvgPrice > 0,
              previousPrice: previousAvgPrice,
              change: avgChange,
              changePercent: avgChangePercent
            },
            volume_comparison: {
              comparison_available: previousVolume > 0,
              previousVolume: previousVolume
            }
          }
        };
      }));

      return {
        success: true,
        markets: transformedMarkets
      };
    } catch (error) {
      console.error('경락가 정보 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 시장별 상세 경락가 정보 조회 (등급/무게별) + 전일 비교
   * @param {string} marketName - 시장명
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @returns {Object} 상세 경락가 정보
   */
  async getMarketDataWithComparison(marketName, date) {
    try {
      console.log('🔍 상세 경락가 조회:', marketName, date);

      // 1. market_summary에서 요약 정보 조회
      const { data: summaryData, error: summaryError } = await supabase
        .from('market_summary')
        .select('*')
        .eq('market_name', marketName)
        .eq('market_date', date)
        .single();

      if (summaryError && summaryError.code !== 'PGRST116') {
        throw summaryError;
      }

      // 2. market_data에서 등급/무게별 상세 정보 조회
      const { data: detailsData, error: detailsError } = await supabase
        .from('market_data')
        .select('*')
        .eq('market_name', marketName)
        .eq('market_date', date)
        .order('grade')
        .order('weight');

      if (detailsError) {
        throw detailsError;
      }

      // 데이터가 없는 경우
      if (!summaryData && (!detailsData || detailsData.length === 0)) {
        return {
          market_name: marketName,
          market_date: date,
          summary: {
            total_boxes: 0,
            total_amount: 0,
            overall_avg_price: 0
          },
          details: [],
          comparison: {
            comparison_available: false
          }
        };
      }

      // 3. 전 경매일 찾기 (현재 날짜보다 이전 날짜 중 가장 최근)
      const { data: previousDateData, error: previousDateError } = await supabase
        .from('market_summary')
        .select('market_date')
        .eq('market_name', marketName)
        .lt('market_date', date)
        .order('market_date', { ascending: false })
        .limit(1)
        .single();

      let previousMarketDate = null;
      let previousSummaryData = null;
      let previousDetailsData = [];

      if (!previousDateError && previousDateData) {
        previousMarketDate = previousDateData.market_date;
        console.log('📅 전 경매일:', previousMarketDate);

        // 4. 전 경매일 요약 정보 조회
        const { data: prevSummary } = await supabase
          .from('market_summary')
          .select('*')
          .eq('market_name', marketName)
          .eq('market_date', previousMarketDate)
          .single();

        previousSummaryData = prevSummary;

        // 5. 전 경매일 상세 정보 조회
        const { data: prevDetails } = await supabase
          .from('market_data')
          .select('*')
          .eq('market_name', marketName)
          .eq('market_date', previousMarketDate);

        previousDetailsData = prevDetails || [];
      }

      // 6. 전일 데이터를 Map으로 변환 (weight + grade 키)
      const previousDetailsMap = new Map();
      previousDetailsData.forEach(item => {
        const key = `${item.weight}_${item.grade}`;
        previousDetailsMap.set(key, item);
      });

      // 7. 응답 데이터 구성 (전일 비교 포함)
      const details = (detailsData || []).map(row => {
        const key = `${row.weight}_${row.grade}`;
        const prevItem = previousDetailsMap.get(key);

        const currentAvgPrice = parseInt(row.avg_price) || 0;
        const previousAvgPrice = prevItem ? (parseInt(prevItem.avg_price) || 0) : 0;
        const currentBoxes = parseInt(row.boxes) || 0;
        const previousBoxes = prevItem ? (parseInt(prevItem.boxes) || 0) : 0;

        const change = previousAvgPrice > 0 ? currentAvgPrice - previousAvgPrice : 0;
        const changePercent = previousAvgPrice > 0
          ? Math.round((change / previousAvgPrice) * 1000) / 10
          : 0;

        const boxesChange = previousBoxes > 0 ? currentBoxes - previousBoxes : 0;
        const boxesChangePercent = previousBoxes > 0
          ? Math.round((boxesChange / previousBoxes) * 1000) / 10
          : 0;

        return {
          weight: row.weight || '5kg',
          grade: row.grade || '특품',
          boxes: currentBoxes,
          avg_price: currentAvgPrice,
          min_price: parseInt(row.min_price) || 0,
          max_price: parseInt(row.max_price) || 0,
          record_count: parseInt(row.record_count) || 0,
          // 전일 비교 정보
          price_comparison: {
            comparison_available: previousAvgPrice > 0,
            previousPrice: previousAvgPrice,
            change: change,
            changePercent: changePercent
          },
          // 수량 비교 정보
          boxes_comparison: {
            comparison_available: previousBoxes > 0,
            previousBoxes: previousBoxes,
            change: boxesChange,
            changePercent: boxesChangePercent
          }
        };
      });

      // 8. 전체 평균가 비교
      const currentOverallAvg = parseInt(summaryData?.avg_price) || 0;
      const previousOverallAvg = previousSummaryData ? (parseInt(previousSummaryData.avg_price) || 0) : 0;
      const overallChange = previousOverallAvg > 0 ? currentOverallAvg - previousOverallAvg : 0;
      const overallChangePercent = previousOverallAvg > 0
        ? Math.round((overallChange / previousOverallAvg) * 1000) / 10
        : 0;

      const result = {
        market_name: marketName,
        market_date: date,
        previous_market_date: previousMarketDate,
        summary: {
          total_boxes: parseInt(summaryData?.total_boxes) || 0,
          total_amount: parseInt(summaryData?.total_amount) || 0,
          overall_avg_price: currentOverallAvg,
          min_price: parseInt(summaryData?.min_price) || 0,
          max_price: parseInt(summaryData?.max_price) || 0
        },
        details: details,
        // 전체 평균가 비교
        overall_comparison: {
          comparison_available: previousOverallAvg > 0,
          previousPrice: previousOverallAvg,
          change: overallChange,
          changePercent: overallChangePercent
        }
      };

      console.log('✅ 상세 경락가 조회 성공:', result);
      return result;

    } catch (error) {
      console.error('❌ 상세 경락가 조회 오류:', error);
      throw error;
    }
  },

  /**
   * DB에서 모든 공판장 목록 조회
   * @returns {Array<string>} 공판장 목록
   */
  async getAllMarkets() {
    try {
      const { data, error } = await supabase
        .from('market_data')
        .select('market_name')
        .order('market_name');

      if (error) throw error;

      // 중복 제거
      const uniqueMarkets = [...new Set(data.map(item => item.market_name).filter(Boolean))];
      return uniqueMarkets;
    } catch (error) {
      console.error('공판장 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 공판장별 등급 목록 조회
   * @param {string} marketName - 시장명
   * @returns {Array<string>} 등급 목록
   */
  async getMarketGrades(marketName) {
    try {
      const { data, error } = await supabase
        .from('market_data')
        .select('grade')
        .eq('market_name', marketName)
        .order('grade');

      if (error) throw error;

      // 중복 제거
      const uniqueGrades = [...new Set(data.map(item => item.grade).filter(Boolean))];
      return uniqueGrades;
    } catch (error) {
      console.error('등급 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 모든 공판장의 등급 목록 조회 (페이지네이션 적용)
   * @returns {Object} { marketName: [grades] }
   */
  async getAllMarketGrades() {
    try {
      // Supabase 기본 limit이 1000개이므로 페이지네이션으로 전체 조회
      const gradesByMarket = {};
      let from = 0;
      const pageSize = 1000;

      while (true) {
        const { data, error } = await supabase
          .from('market_data')
          .select('market_name, grade')
          .range(from, from + pageSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        // 시장별로 등급 그룹화
        data.forEach(item => {
          if (!item.market_name || !item.grade) return;
          if (!gradesByMarket[item.market_name]) {
            gradesByMarket[item.market_name] = new Set();
          }
          gradesByMarket[item.market_name].add(item.grade);
        });

        if (data.length < pageSize) break;
        from += pageSize;
      }

      // Set을 Array로 변환
      Object.keys(gradesByMarket).forEach(market => {
        gradesByMarket[market] = [...gradesByMarket[market]];
      });

      return gradesByMarket;
    } catch (error) {
      console.error('전체 등급 목록 조회 오류:', error);
      return {};
    }
  },

  /**
   * 시장 설정 조회 (공판장 순서, 등급 순서)
   * @returns {Object|null} { market_order: [], grade_orders: {} }
   */
  async getMarketSettings() {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'market_display_settings')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // 설정이 없는 경우
          return null;
        }
        throw error;
      }

      return data?.value || null;
    } catch (error) {
      console.error('시장 설정 조회 오류:', error);
      return null;
    }
  },

  /**
   * 시장 설정 저장 (공판장 순서, 등급 순서)
   * @param {Object} settings - { market_order: [], grade_orders: {} }
   */
  async saveMarketSettings(settings) {
    try {
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'market_display_settings')
        .single();

      if (existing) {
        // 업데이트
        const { error } = await supabase
          .from('app_settings')
          .update({
            value: settings,
            updated_at: new Date().toISOString()
          })
          .eq('key', 'market_display_settings');

        if (error) throw error;
      } else {
        // 신규 생성
        const { error } = await supabase
          .from('app_settings')
          .insert([{
            key: 'market_display_settings',
            value: settings,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;
      }

      return { success: true };
    } catch (error) {
      console.error('시장 설정 저장 오류:', error);
      throw error;
    }
  },

  /**
   * 기간별 경락가 추세 데이터 조회
   * @param {string} marketName - 시장명
   * @param {string} startDate - 시작 날짜 (YYYY-MM-DD)
   * @param {string} endDate - 종료 날짜 (YYYY-MM-DD)
   * @returns {Array} 날짜별 경락가 데이터
   */
  async getMarketTrendData(marketName, startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('market_summary')
        .select('market_date, avg_price, min_price, max_price, total_boxes, total_amount')
        .eq('market_name', marketName)
        .gte('market_date', startDate)
        .lte('market_date', endDate)
        .order('market_date', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('경락가 추세 데이터 조회 오류:', error);
      return [];
    }
  },

  /**
   * 성주군 합계 추세 데이터 조회 (그래프용)
   * market_aggregate_summary 테이블에서 조회
   * @param {string} startDate - 시작 날짜 (YYYY-MM-DD)
   * @param {string} endDate - 종료 날짜 (YYYY-MM-DD)
   * @returns {Array} 추세 데이터 배열
   */
  async getSeongjuAggregateTrend(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, total_boxes, total_amount, avg_price, max_price, min_price')
        .eq('region_name', '성주군')
        .gte('market_date', startDate)
        .lte('market_date', endDate)
        .order('market_date', { ascending: true });

      if (error) throw error;

      // MarketTrend 차트 형식으로 변환
      return (data || []).map(row => ({
        market_date: row.market_date,
        avg_price: row.avg_price,
        min_price: row.min_price,
        max_price: row.max_price,
        total_boxes: row.total_boxes,
        total_amount: row.total_amount
      }));
    } catch (error) {
      console.error('성주군 합계 추세 데이터 조회 오류:', error);
      return [];
    }
  }
};

export default marketService;
