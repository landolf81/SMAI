/**
 * AI 브리핑 서비스
 * 공판장별 참외 시세 한 줄 브리핑 생성
 */

import { supabase } from '../config/supabase.js';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * ISO 주차 번호 계산
 */
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * 작년 동일 주차 같은 요일 날짜 계산
 */
function getLastYearSameWeekDay(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const weekNum = getWeekNumber(d);

  // 작년 1월 1일
  const lastYear = new Date(d.getFullYear() - 1, 0, 1);
  // 작년 1월 1일의 요일
  const lastYearFirstDay = lastYear.getDay();

  // 작년 동일 주차의 첫 날 (월요일)
  const daysToAdd = (weekNum - 1) * 7 + (1 - lastYearFirstDay);
  lastYear.setDate(lastYear.getDate() + daysToAdd);

  // 같은 요일로 조정
  const targetDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 월=0, 일=6
  lastYear.setDate(lastYear.getDate() + targetDay);

  return lastYear.toISOString().split('T')[0];
}

export const briefingService = {
  /**
   * 브리핑 조회 (DB에서만 조회, 생성 안 함)
   * Cron이나 관리자가 미리 생성해둔 브리핑만 반환
   */
  async getBriefing(marketName, targetDate) {
    try {
      const { data: cached } = await supabase
        .from('market_briefings')
        .select('*')
        .eq('market_name', marketName)
        .eq('market_date', targetDate)
        .single();

      if (cached) {
        return {
          briefing: cached.briefing,
          trend: cached.trend_data,
          cached: true
        };
      }

      // 브리핑 없으면 null 반환 (생성하지 않음)
      return { briefing: null };
    } catch (error) {
      console.error('브리핑 조회 오류:', error);
      return { briefing: null };
    }
  },

  /**
   * 브리핑 생성 (관리자 전용)
   * 새로 생성하거나 기존 브리핑 덮어쓰기
   */
  async generateBriefing(marketName, targetDate) {
    try {
      const data = await this.getBriefingData(marketName, targetDate);
      if (!data.today) {
        return { success: false, error: '해당 날짜 데이터가 없습니다.' };
      }

      const trend = this.analyzeTrend(data);
      const briefing = await this.generateBriefingText(marketName, data, trend);

      // DB에 저장 (upsert)
      const { error: upsertError } = await supabase
        .from('market_briefings')
        .upsert({
          market_name: marketName,
          market_date: targetDate,
          briefing: briefing,
          analysis_data: data,
          trend_data: trend,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'market_name,market_date'
        });

      if (upsertError) {
        throw upsertError;
      }

      return { success: true, briefing, trend };
    } catch (error) {
      console.error('브리핑 생성 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 브리핑용 시계열 데이터 수집
   */
  async getBriefingData(marketName, targetDate) {
    try {
      // 최근 경매일 4개 조회 (D, D-1, D-2, D-3)
      const { data: recentData } = await supabase
        .from('market_summary')
        .select('*')
        .eq('market_name', marketName)
        .lte('market_date', targetDate)
        .order('market_date', { ascending: false })
        .limit(4);

      // 7일 전 근처 데이터 조회
      const sevenDaysAgo = new Date(targetDate);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const d7Date = sevenDaysAgo.toISOString().split('T')[0];

      const { data: d7Data } = await supabase
        .from('market_summary')
        .select('*')
        .eq('market_name', marketName)
        .lte('market_date', d7Date)
        .order('market_date', { ascending: false })
        .limit(1)
        .single();

      // 작년 동일 주차 같은 요일 데이터 조회
      const lastYearDate = getLastYearSameWeekDay(targetDate);
      const { data: lastYearData } = await supabase
        .from('market_summary')
        .select('*')
        .eq('market_name', marketName)
        .gte('market_date', new Date(new Date(lastYearDate).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .lte('market_date', new Date(new Date(lastYearDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('market_date', { ascending: false })
        .limit(1)
        .single();

      const formatData = (row) => row ? {
        date: row.market_date,
        boxes: parseInt(row.total_boxes) || 0,
        avgPrice: parseInt(row.avg_price) || 0,
        minPrice: parseInt(row.min_price) || 0,
        maxPrice: parseInt(row.max_price) || 0,
        amount: parseInt(row.total_amount) || 0
      } : null;

      return {
        today: formatData(recentData?.[0]),
        d1: formatData(recentData?.[1]),
        d2: formatData(recentData?.[2]),
        d3: formatData(recentData?.[3]),
        d7: formatData(d7Data),
        lastYear: formatData(lastYearData)
      };
    } catch (error) {
      console.error('브리핑 데이터 수집 오류:', error);
      throw error;
    }
  },

  /**
   * 추세 분석
   */
  analyzeTrend(data) {
    const { today, d1, d2, d3, d7, lastYear } = data;

    // 가격 추세 분석
    let priceTrend = '보합';
    if (today && d1 && d2) {
      const change1 = ((today.avgPrice - d1.avgPrice) / d1.avgPrice) * 100;
      const change2 = ((d1.avgPrice - d2.avgPrice) / d2.avgPrice) * 100;

      if (change1 > 2 && change2 > 2) {
        priceTrend = '연속상승';
      } else if (change1 < -2 && change2 < -2) {
        priceTrend = '연속하락';
      } else if (change1 > 2 && change2 < -2) {
        priceTrend = '반등';
      } else if (change1 < -2 && change2 > 2) {
        priceTrend = '꺾임';
      } else if (change1 > 2) {
        priceTrend = '상승';
      } else if (change1 < -2) {
        priceTrend = '하락';
      }
    }

    // 물량 추세 분석
    let volumeTrend = '유지';
    if (today && d1) {
      const volumeChange = ((today.boxes - d1.boxes) / d1.boxes) * 100;
      if (volumeChange > 10) volumeTrend = '증가';
      else if (volumeChange < -10) volumeTrend = '감소';
    }

    // 주간 변동률
    let weeklyChange = null;
    if (today && d7) {
      weeklyChange = Math.round(((today.avgPrice - d7.avgPrice) / d7.avgPrice) * 1000) / 10;
    }

    // 작년 대비 변동률
    let yearlyChange = null;
    if (today && lastYear) {
      yearlyChange = Math.round(((today.avgPrice - lastYear.avgPrice) / lastYear.avgPrice) * 1000) / 10;
    }

    // 전일 대비 변동률
    let dailyChange = null;
    if (today && d1) {
      dailyChange = Math.round(((today.avgPrice - d1.avgPrice) / d1.avgPrice) * 1000) / 10;
    }

    // 물량 변동률
    let volumeChange = null;
    let volumeDiff = null; // 절대량 변화
    if (today && d1) {
      volumeChange = Math.round(((today.boxes - d1.boxes) / d1.boxes) * 1000) / 10;
      volumeDiff = today.boxes - d1.boxes;
    }

    return {
      priceTrend,
      volumeTrend,
      dailyChange,
      weeklyChange,
      yearlyChange,
      volumeChange,
      volumeDiff
    };
  },

  /**
   * Gemini로 브리핑 텍스트 생성
   */
  async generateBriefingText(marketName, data, trend) {
    if (!GEMINI_API_KEY) {
      // API 키 없으면 기본 브리핑 생성
      return this.generateFallbackBriefing(marketName, data, trend);
    }

    // 시장명 축약
    const shortName = marketName.replace('공판장', '').replace('원예농협', '').replace('성주참외', '선남');

    const prompt = `당신은 성주 참외 농가를 위한 시세 브리핑 전문가입니다.

[${shortName} ${data.today.date} 데이터]
- 오늘: 물량 ${data.today.boxes.toLocaleString()}박스, 평균 ${data.today.avgPrice.toLocaleString()}원
- 전일: ${data.d1 ? `물량 ${data.d1.boxes.toLocaleString()}박스, 평균 ${data.d1.avgPrice.toLocaleString()}원` : '없음'}
- 2일전: ${data.d2 ? `평균 ${data.d2.avgPrice.toLocaleString()}원` : '없음'}
- 3일전: ${data.d3 ? `평균 ${data.d3.avgPrice.toLocaleString()}원` : '없음'}
- 7일전: ${data.d7 ? `평균 ${data.d7.avgPrice.toLocaleString()}원` : '없음'}
- 작년 동주차: ${data.lastYear ? `평균 ${data.lastYear.avgPrice.toLocaleString()}원` : '없음'}

추세: 가격 ${trend.priceTrend}, 물량 ${trend.volumeTrend}
가격 전일대비: ${trend.dailyChange !== null ? `${trend.dailyChange > 0 ? '+' : ''}${trend.dailyChange}%` : '없음'}
물량 전일대비: ${trend.volumeDiff !== null ? `${trend.volumeDiff > 0 ? '+' : ''}${trend.volumeDiff.toLocaleString()}상자 (${trend.volumeChange > 0 ? '+' : ''}${trend.volumeChange}%)` : '없음'}
주간대비: ${trend.weeklyChange !== null ? `${trend.weeklyChange > 0 ? '+' : ''}${trend.weeklyChange}%` : '없음'}
작년대비: ${trend.yearlyChange !== null ? `${trend.yearlyChange > 0 ? '+' : ''}${trend.yearlyChange}%` : '없음'}

위 데이터로 농가에게 보낼 한 줄 브리핑을 작성해주세요.

규칙:
1. 50자 이내로 작성
2. 카카오톡으로 보내는 친근한 말투 (예: "~네요", "~같아요", "~입니다", "~해요")
3. 절대 금지 단어: 폭등, 폭락, 급등, 급락, 대박, 위기, 최악, 최고, 폭발, 붕괴
4. 이모지 사용 금지 (텍스트만 사용)
5. 구체적인 숫자보다는 흐름/분위기 중심으로 표현
6. 브리핑은 반드시 시장명으로 시작 (예: "${shortName} 지난 경매보다...")
   - "참외 농가", "농가 여러분" 같은 일반 호칭 절대 금지
   - 첫 단어는 무조건 시장명 (${shortName})
7. 물량/가격 변동 언급 시 비교 대상 명시 필수:
   - "지난 경매보다", "어제보다", "전 경매 대비" 등 비교 기준을 반드시 포함
   - 예: "지난 경매보다 물량 늘고 가격 올랐어요"
8. 물량 변동 표현 기준 (절대량 우선):
   - ±1,000상자 미만: "물량은 비슷해요"
   - 1,000~3,000상자 증감: "물량이 늘었어요/줄었어요"
   - 3,000상자 이상 증감: "물량이 크게 늘었어요/줄었어요"
   - 단, 비율이 30% 이상이면 "많이" 수식어 추가 (예: "물량이 많이 늘었어요")
9. JSON 형식으로만 반환: {"briefing": "브리핑 내용"}`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });

      if (!response.ok) {
        console.error('Gemini API 오류:', response.status);
        return this.generateFallbackBriefing(marketName, data, trend);
      }

      const result = await response.json();
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        return this.generateFallbackBriefing(marketName, data, trend);
      }

      // JSON 추출
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.briefing) {
          // 금지 단어 필터링
          const forbidden = ['폭등', '폭락', '급등', '급락', '대박', '위기', '최악', '최고', '폭발', '붕괴'];
          let briefing = parsed.briefing;
          forbidden.forEach(word => {
            briefing = briefing.replace(new RegExp(word, 'g'), '');
          });
          return briefing.trim();
        }
      }

      return this.generateFallbackBriefing(marketName, data, trend);
    } catch (error) {
      console.error('Gemini 브리핑 생성 오류:', error);
      return this.generateFallbackBriefing(marketName, data, trend);
    }
  },

  /**
   * 폴백 브리핑 (API 실패 시)
   */
  generateFallbackBriefing(marketName, data, trend) {
    const shortName = marketName.replace('공판장', '').replace('원예농협', '').replace('성주참외', '선남');

    const trendMessages = {
      '연속상승': '며칠째 좋은 흐름이에요',
      '연속하락': '조금씩 내려가는 분위기예요',
      '반등': '지난 경매 대비 반등 기미예요',
      '꺾임': '지난 경매 대비 오름세 주춤해요',
      '상승': '지난 경매보다 올랐어요',
      '하락': '지난 경매보다 내렸어요',
      '보합': '큰 변동 없이 유지 중이에요'
    };

    const volumeMessages = {
      '증가': ', 물량은 늘었어요',
      '감소': ', 물량은 줄었어요',
      '유지': ''
    };

    return `${shortName} ${trendMessages[trend.priceTrend] || '오늘도 무난해요'}${volumeMessages[trend.volumeTrend] || ''}`;
  },

  /**
   * 여러 시장 브리핑 한번에 조회
   */
  async getMultipleBriefings(marketNames, targetDate) {
    const results = {};

    await Promise.all(
      marketNames.map(async (name) => {
        try {
          results[name] = await this.getBriefing(name, targetDate);
        } catch (error) {
          results[name] = { briefing: null, error: error.message };
        }
      })
    );

    return results;
  }
};

export default briefingService;
