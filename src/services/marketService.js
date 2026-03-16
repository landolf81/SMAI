import { supabase } from '../config/supabase.js';

/** 한글 Unicode 정규화 (NFD→NFC 통일) */
const nfc = (s) => typeof s === 'string' ? s.normalize('NFC') : s;

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
        .maybeSingle();

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

      // 중복 제거 (NFC 정규화로 유니코드 중복 방지)
      const uniqueMarkets = [...new Set(data.map(item => nfc(item.market_name)))];
      return uniqueMarkets;
    } catch (error) {
      console.error('시장 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 홈화면용 경락가 요약 조회 (단일 쿼리, 14일 범위)
   * getAvailableMarkets + getMultipleMarkets를 하나로 합쳐 네트워크 왕복 1회로 축소.
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @returns {Object} { availableMarkets: string[], markets: Array }
   */
  async getMarketsSummary(date) {
    try {
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - 5);
      const startDate = pastDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('market_summary')
        .select('market_name, market_date, avg_price, min_price, max_price, total_boxes, total_amount')
        .gte('market_date', startDate)
        .lte('market_date', date)
        .order('market_date', { ascending: false });

      if (error) throw error;

      // 시장별로 당일 / 가장 최근 이전일 분리
      const currentByMarket = {};
      const prevByMarket = {};
      for (const row of (data || [])) {
        const name = nfc(row.market_name);
        if (row.market_date === date) {
          currentByMarket[name] = row;
        } else if (!prevByMarket[name]) {
          prevByMarket[name] = row;
        }
      }

      // is_finalized 조회 시도 (컬럼 미생성 시 빈 맵으로 폴백)
      let finalizedMap = {};
      const { data: fData, error: fError } = await supabase
        .from('market_summary')
        .select('market_name, is_finalized')
        .eq('market_date', date);
      if (!fError && fData) {
        for (const row of fData) {
          finalizedMap[nfc(row.market_name)] = row.is_finalized;
        }
      }

      const availableMarkets = Object.keys(currentByMarket).sort();

      const transformedMarkets = availableMarkets.map(name => {
        const market = currentByMarket[name];
        const prev = prevByMarket[name] || null;

        const currentAvgPrice = parseInt(market.avg_price) || 0;
        const previousAvgPrice = prev ? (parseInt(prev.avg_price) || 0) : 0;
        const avgChange = previousAvgPrice > 0 ? currentAvgPrice - previousAvgPrice : 0;
        const avgChangePercent = previousAvgPrice > 0
          ? Math.round((avgChange / previousAvgPrice) * 1000) / 10
          : 0;

        const currentMinPrice = parseInt(market.min_price) || 0;
        const previousMinPrice = prev ? (parseInt(prev.min_price) || 0) : 0;
        const currentMaxPrice = parseInt(market.max_price) || 0;
        const previousMaxPrice = prev ? (parseInt(prev.max_price) || 0) : 0;
        const currentVolume = parseInt(market.total_boxes) || 0;
        const previousVolume = prev ? (parseInt(prev.total_boxes) || 0) : 0;

        return {
          market_name: market.market_name,
          success: true,
          is_finalized: finalizedMap[name] ?? false,
          data: {
            summary: {
              overall_avg_price: currentAvgPrice,
              total_boxes: currentVolume,
              total_amount: parseInt(market.total_amount) || 0
            },
            details: [{
              boxes: currentVolume,
              min_price: currentMinPrice,
              max_price: currentMaxPrice,
              avg_price: currentAvgPrice
            }],
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
      });

      return { availableMarkets, markets: transformedMarkets };
    } catch (error) {
      console.error('홈 경락가 요약 조회 오류:', error);
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
      // NFC 정규화 (유니코드 중복 방지)
      const normalizedMarkets = markets.map(nfc);

      // 60일 이내 데이터를 한 번에 조회 (N+1 쿼리 → 1 쿼리)
      const pastDate = new Date(date);
      pastDate.setDate(pastDate.getDate() - 60);
      const startDate = pastDate.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('market_summary')
        .select('*')
        .in('market_name', normalizedMarkets)
        .gte('market_date', startDate)
        .lte('market_date', date)
        .order('market_date', { ascending: false });

      if (error) throw error;

      // 시장별로 현재 날짜 / 가장 최근 이전 날짜 분리 (date 내림차순이므로 순서 보장)
      const currentByMarket = {};
      const prevByMarket = {};
      for (const row of (data || [])) {
        const name = row.market_name;
        if (row.market_date === date) {
          currentByMarket[name] = row;
        } else if (!prevByMarket[name]) {
          prevByMarket[name] = row;
        }
      }

      // 원래 순서 유지 + 현재 날짜 데이터가 있는 시장만 포함
      const transformedMarkets = normalizedMarkets
        .filter(name => currentByMarket[name])
        .map(name => {
          const market = currentByMarket[name];
          const previousDateData = prevByMarket[name] || null;

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
        });

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
      marketName = nfc(marketName);
      console.log('🔍 상세 경락가 조회:', marketName, date);

      // 1. market_summary에서 요약 정보 조회
      const { data: summaryData, error: summaryError } = await supabase
        .from('market_summary')
        .select('*')
        .eq('market_name', marketName)
        .eq('market_date', date)
        .maybeSingle();

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
        .maybeSingle();

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
          .maybeSingle();

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
        const currentMaxPrice = parseInt(row.max_price) || 0;
        const previousMaxPrice = prevItem ? (parseInt(prevItem.max_price) || 0) : 0;
        const currentMinPrice = parseInt(row.min_price) || 0;
        const previousMinPrice = prevItem ? (parseInt(prevItem.min_price) || 0) : 0;
        const currentBoxes = parseInt(row.boxes) || 0;
        const previousBoxes = prevItem ? (parseInt(prevItem.boxes) || 0) : 0;

        const change = previousAvgPrice > 0 ? currentAvgPrice - previousAvgPrice : 0;
        const changePercent = previousAvgPrice > 0
          ? Math.round((change / previousAvgPrice) * 1000) / 10
          : 0;

        const maxChange = previousMaxPrice > 0 ? currentMaxPrice - previousMaxPrice : 0;
        const maxChangePercent = previousMaxPrice > 0
          ? Math.round((maxChange / previousMaxPrice) * 1000) / 10
          : 0;

        const minChange = previousMinPrice > 0 ? currentMinPrice - previousMinPrice : 0;
        const minChangePercent = previousMinPrice > 0
          ? Math.round((minChange / previousMinPrice) * 1000) / 10
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
          min_price: currentMinPrice,
          max_price: currentMaxPrice,
          record_count: parseInt(row.record_count) || 0,
          // 평균가 비교
          price_comparison: {
            comparison_available: previousAvgPrice > 0,
            previousPrice: previousAvgPrice,
            change: change,
            changePercent: changePercent
          },
          // 최고가 비교
          max_price_comparison: {
            comparison_available: previousMaxPrice > 0,
            change: maxChange,
            changePercent: maxChangePercent
          },
          // 최저가 비교
          min_price_comparison: {
            comparison_available: previousMinPrice > 0,
            change: minChange,
            changePercent: minChangePercent
          },
          // 수량 비교
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

      // 중복 제거 (NFC 정규화)
      const uniqueMarkets = [...new Set(data.map(item => nfc(item.market_name)).filter(Boolean))];
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
      marketName = nfc(marketName);
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

        // 시장별로 등급 그룹화 (NFC 정규화)
        data.forEach(item => {
          if (!item.market_name || !item.grade) return;
          const name = nfc(item.market_name);
          if (!gradesByMarket[name]) {
            gradesByMarket[name] = new Set();
          }
          gradesByMarket[name].add(item.grade);
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
   * 특정 시장+등급의 전일 비교 데이터 경량 조회 (2 쿼리 병렬)
   * @param {string} marketName - 시장명
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @param {string} grade - 등급/법인명
   * @param {string} weight - 규격
   * @returns {Object|null} 비교 데이터
   */
  async getGradeComparison(marketName, date, grade, weight) {
    try {
      marketName = nfc(marketName);

      // 전 경매일 + 현재 데이터 병렬 조회
      const [prevDateRes, currentRes] = await Promise.all([
        supabase
          .from('market_data')
          .select('boxes, avg_price, max_price, min_price, market_date')
          .eq('market_name', marketName)
          .eq('grade', grade)
          .eq('weight', weight)
          .lt('market_date', date)
          .order('market_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('market_data')
          .select('boxes, avg_price, max_price, min_price')
          .eq('market_name', marketName)
          .eq('market_date', date)
          .eq('grade', grade)
          .eq('weight', weight)
          .maybeSingle()
      ]);

      const prev = prevDateRes.data;
      const curr = currentRes.data;
      if (!curr) return null;

      const calc = (cur, pre) => {
        const c = parseInt(cur) || 0;
        const p = parseInt(pre) || 0;
        const change = p > 0 ? c - p : 0;
        const pct = p > 0 ? Math.round((change / p) * 1000) / 10 : 0;
        return { comparison_available: p > 0, previousValue: p, change, changePercent: pct };
      };

      return {
        price_comparison: { ...calc(curr.avg_price, prev?.avg_price), previousPrice: parseInt(prev?.avg_price) || 0 },
        max_price_comparison: calc(curr.max_price, prev?.max_price),
        min_price_comparison: calc(curr.min_price, prev?.min_price),
        boxes_comparison: { ...calc(curr.boxes, prev?.boxes), previousBoxes: parseInt(prev?.boxes) || 0 },
      };
    } catch (error) {
      console.error('등급 비교 데이터 조회 오류:', error);
      return null;
    }
  },

  /**
   * 도매시장 법인명 검색용 데이터 조회 (제외 시장 필터링)
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @param {string[]} excludeMarkets - 제외할 시장 목록
   * @returns {Array} [{ market_name, grade, weight, boxes, avg_price, min_price, max_price }]
   */
  async searchMarketGrades(date, excludeMarkets = []) {
    try {
      const normalizedExclude = excludeMarkets.map(nfc);
      const { data, error } = await supabase
        .from('market_data')
        .select('market_name, grade, weight, boxes, avg_price, min_price, max_price')
        .eq('market_date', date)
        .order('market_name')
        .order('grade');

      if (error) throw error;

      // 제외 시장 필터링 (클라이언트 사이드)
      return (data || []).filter(item =>
        !normalizedExclude.includes(nfc(item.market_name))
      );
    } catch (error) {
      console.error('도매시장 검색 데이터 조회 오류:', error);
      return [];
    }
  },

  /**
   * 도매시장 법인별 상세 데이터 조회 (규격+출하지명별)
   * @param {string} marketName - 시장명
   * @param {string} date - 날짜 (YYYY-MM-DD)
   * @param {string} grade - 등급/법인명
   * @returns {Array} 상세 데이터 배열
   */
  async getMarketDetail(marketName, date, grade) {
    try {
      marketName = nfc(marketName);
      const { data, error } = await supabase
        .from('market_detail')
        .select('*')
        .eq('market_name', marketName)
        .eq('market_date', date)
        .eq('grade', grade)
        .order('weight')
        .order('shipper_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('상세 데이터 조회 오류:', error);
      return [];
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
        .maybeSingle();

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
        .maybeSingle();

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
  },

  /**
   * 성주군 합계 당일+전일 데이터 조회 (홈 카드용)
   * market_aggregate_summary 테이블에서 최근 2일 데이터 조회
   * @param {string} date - 조회 날짜 (YYYY-MM-DD)
   * @returns {Object} { today, previous } 당일/전일 데이터
   */
  async getSeongjuAggregateForCard(date) {
    try {
      const { data, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, total_boxes, total_amount, avg_price, max_price, min_price')
        .eq('region_name', '성주군')
        .lte('market_date', date)
        .order('market_date', { ascending: false })
        .limit(2);

      if (error) throw error;

      const today = data?.find(d => d.market_date === date) || null;
      const previous = data?.find(d => d.market_date !== date) || null;

      // is_finalized 조회 시도 (컬럼 미생성 시 무시)
      if (today) {
        const { data: fData, error: fErr } = await supabase
          .from('market_aggregate_summary')
          .select('is_finalized')
          .eq('region_name', '성주군')
          .eq('market_date', date)
          .maybeSingle();
        if (!fErr && fData) today.is_finalized = fData.is_finalized;
      }

      return { today, previous };
    } catch (error) {
      console.error('성주군 합계 카드 데이터 조회 오류:', error);
      return { today: null, previous: null };
    }
  },

  /**
   * 연간 누적 출하량/금액 조회 (1월1일~오늘, 작년 동기)
   * @param {string} marketName - 공판장명 또는 '성주군 합계'
   * @param {string} todayDate - 오늘 날짜 (YYYY-MM-DD)
   * @returns {Object} { thisYear: {boxes, amount}, lastYear: {boxes, amount} }
   */
  async getYearlyCumulative(marketName, todayDate) {
    try {
      const year = parseInt(todayDate.slice(0, 4));
      const thisYearStart = `${year}-01-01`;
      const lastYearStart = `${year - 1}-01-01`;
      const lastYearEnd = `${year - 1}${todayDate.slice(4)}`; // 작년 동일 월일

      const isSeongjuTotal = marketName === '성주군 합계';

      let thisYearQuery, lastYearQuery;

      if (isSeongjuTotal) {
        thisYearQuery = supabase
          .from('market_aggregate_summary')
          .select('total_boxes, total_amount')
          .eq('region_name', '성주군')
          .gte('market_date', thisYearStart)
          .lte('market_date', todayDate);
        lastYearQuery = supabase
          .from('market_aggregate_summary')
          .select('total_boxes, total_amount')
          .eq('region_name', '성주군')
          .gte('market_date', lastYearStart)
          .lte('market_date', lastYearEnd);
      } else {
        thisYearQuery = supabase
          .from('market_summary')
          .select('total_boxes, total_amount')
          .eq('market_name', marketName)
          .gte('market_date', thisYearStart)
          .lte('market_date', todayDate);
        lastYearQuery = supabase
          .from('market_summary')
          .select('total_boxes, total_amount')
          .eq('market_name', marketName)
          .gte('market_date', lastYearStart)
          .lte('market_date', lastYearEnd);
      }

      const [thisYearRes, lastYearRes] = await Promise.all([thisYearQuery, lastYearQuery]);

      const sum = (rows) => ({
        boxes: (rows || []).reduce((s, r) => s + (parseInt(r.total_boxes) || 0), 0),
        amount: (rows || []).reduce((s, r) => s + (parseInt(r.total_amount) || 0), 0),
      });

      return {
        thisYear: sum(thisYearRes.data),
        lastYear: sum(lastYearRes.data),
      };
    } catch (error) {
      console.error('연간 누적 조회 오류:', error);
      return { thisYear: { boxes: 0, amount: 0 }, lastYear: { boxes: 0, amount: 0 } };
    }
  },

  // ─── 경매시간 관리 ─────────────────────────────────────────

  /**
   * 특정 공판장의 해당 날짜 경매시간 조회
   * @param {string} marketName - 공판장명
   * @param {string} date - 조회 날짜 (YYYY-MM-DD)
   * @returns {Promise<string|null>} 경매시간 (예: '13:00') 또는 null
   */
  async getAuctionTime(marketName, date) {
    try {
      const { data, error } = await supabase
        .from('market_auction_times')
        .select('auction_time')
        .eq('market_name', marketName)
        .lte('effective_from', date)
        .or(`effective_to.is.null,effective_to.gte.${date}`)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data?.auction_time || null;
    } catch {
      return null;
    }
  },

  /**
   * 경매시간 전체 목록 조회 (관리자용)
   * @returns {Promise<Array>} 경매시간 목록
   */
  async getAuctionTimes() {
    const { data, error } = await supabase
      .from('market_auction_times')
      .select('*')
      .order('market_name')
      .order('effective_from', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * 경매시간 등록/수정
   * @param {Object} timeData - { id?, market_name, auction_time, effective_from, effective_to }
   * @returns {Promise<Object>} 저장된 데이터
   */
  async upsertAuctionTime(timeData) {
    const row = {
      market_name: timeData.market_name,
      auction_time: timeData.auction_time,
      effective_from: timeData.effective_from,
      effective_to: timeData.effective_to || null,
      updated_at: new Date().toISOString(),
    };

    if (timeData.id) {
      const { data, error } = await supabase
        .from('market_auction_times')
        .update(row)
        .eq('id', timeData.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await supabase
        .from('market_auction_times')
        .insert(row)
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  /**
   * 경매시간 삭제
   * @param {string} id - 경매시간 ID
   */
  async deleteAuctionTime(id) {
    const { error } = await supabase
      .from('market_auction_times')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  /**
   * 도매시장 합계 추세 데이터 조회 (DB 집계)
   * market_aggregate_summary 테이블에서 region_name = '도매시장'으로 조회
   * (트리거에 의해 market_summary INSERT/UPDATE 시 자동 갱신됨)
   * @param {string} startDate - 시작 날짜 (YYYY-MM-DD)
   * @param {string} endDate - 종료 날짜 (YYYY-MM-DD)
   * @returns {Array} 날짜별 집계 데이터 ({ market_date, avg_price, min_price, max_price, total_boxes, total_amount })
   */
  async getWholesaleTrendData(startDate, endDate) {
    try {
      const { data, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, total_boxes, total_amount, avg_price, max_price, min_price')
        .eq('region_name', '도매시장')
        .gte('market_date', startDate)
        .lte('market_date', endDate)
        .order('market_date', { ascending: true });

      if (error) throw error;

      // MarketTrend 차트 형식으로 변환 (성주군 합계와 동일한 구조)
      return (data || []).map((row) => ({
        market_date: row.market_date,
        avg_price: row.avg_price,
        min_price: row.min_price,
        max_price: row.max_price,
        total_boxes: row.total_boxes,
        total_amount: row.total_amount,
      }));
    } catch (error) {
      console.error('도매시장 합계 추세 데이터 조회 오류:', error);
      return [];
    }
  },

  /**
   * 도매시장 합계 연간 누적 출하량/금액 조회 (1월1일~오늘, 작년 동기)
   * market_aggregate_summary 테이블에서 region_name = '도매시장'으로 조회
   * @param {string} todayDate - 오늘 날짜 (YYYY-MM-DD)
   * @returns {Object} { thisYear: {boxes, amount}, lastYear: {boxes, amount} }
   */
  async getWholesaleYearlyCumulative(todayDate) {
    try {
      const year = parseInt(todayDate.slice(0, 4));
      const thisYearStart = `${year}-01-01`;
      const lastYearStart = `${year - 1}-01-01`;
      const lastYearEnd = `${year - 1}${todayDate.slice(4)}`; // 작년 동일 월일

      // 올해 + 작년 데이터 병렬 조회 (성주군 합계와 동일한 패턴)
      const [thisYearRes, lastYearRes] = await Promise.all([
        supabase
          .from('market_aggregate_summary')
          .select('total_boxes, total_amount')
          .eq('region_name', '도매시장')
          .gte('market_date', thisYearStart)
          .lte('market_date', todayDate),
        supabase
          .from('market_aggregate_summary')
          .select('total_boxes, total_amount')
          .eq('region_name', '도매시장')
          .gte('market_date', lastYearStart)
          .lte('market_date', lastYearEnd),
      ]);

      const sum = (rows) => ({
        boxes: (rows || []).reduce((s, r) => s + (parseInt(r.total_boxes) || 0), 0),
        amount: (rows || []).reduce((s, r) => s + (parseInt(r.total_amount) || 0), 0),
      });

      return {
        thisYear: sum(thisYearRes.data),
        lastYear: sum(lastYearRes.data),
      };
    } catch (error) {
      console.error('도매시장 합계 연간 누적 조회 오류:', error);
      return { thisYear: { boxes: 0, amount: 0 }, lastYear: { boxes: 0, amount: 0 } };
    }
  },

  /**
   * 도매시장 합계 당일+전일 데이터 조회 (홈 카드용)
   * market_aggregate_summary 테이블에서 region_name = '도매시장'으로 조회
   * @param {string} date - 조회 날짜 (YYYY-MM-DD)
   * @returns {Object} { today, previous } 당일/전일 데이터
   */
  async getWholesaleAggregateForCard(date) {
    try {
      const { data, error } = await supabase
        .from('market_aggregate_summary')
        .select('market_date, total_boxes, total_amount, avg_price, max_price, min_price, is_finalized')
        .eq('region_name', '도매시장')
        .lte('market_date', date)
        .order('market_date', { ascending: false })
        .limit(2);

      if (error) throw error;

      const today = data?.find((d) => d.market_date === date) || null;
      const previous = data?.find((d) => d.market_date !== date) || null;

      return { today, previous };
    } catch (error) {
      console.error('도매시장 합계 카드 데이터 조회 오류:', error);
      return { today: null, previous: null };
    }
  },

  /**
   * 공판장 정보 전체 조회 (홈 카드 ℹ️ 버튼용)
   * market_info 테이블에서 모든 공판장 기본 정보 조회
   * @returns {Array} 공판장 정보 배열
   */
  async getMarketInfo() {
    const { data, error } = await supabase
      .from('market_info')
      .select('*')
      .order('market_name');
    if (error) throw error;
    return data || [];
  },

  /**
   * 공판장 정보 등록/수정 (어드민 전용)
   * market_name을 기준으로 upsert 처리
   * @param {Object} infoData - 공판장 정보 객체
   * @returns {Object} 저장된 공판장 정보
   */
  async upsertMarketInfo(infoData) {
    const { data, error } = await supabase
      .from('market_info')
      .upsert(infoData, { onConflict: 'market_name' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

export default marketService;
