/**
 * 날씨 브리핑 서비스
 * 참외 재배 관점의 날씨 한 줄 브리핑 생성
 */

import { supabase } from '../config/supabase.js';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * 하늘 상태 텍스트 변환
 */
function getSkyText(sky) {
  const skyMap = {
    1: '맑음',
    3: '구름많음',
    4: '흐림'
  };
  return skyMap[sky] || '정보없음';
}

/**
 * 강수형태 텍스트 변환
 */
function getPtyText(pty) {
  const ptyMap = {
    0: '없음',
    1: '비',
    2: '비/눈',
    3: '눈',
    4: '소나기'
  };
  return ptyMap[pty] || '없음';
}

/**
 * 오늘 날짜 (YYYY-MM-DD)
 */
function getTodayDate() {
  const now = new Date();
  // 한국 시간 (UTC+9)
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
}

export const weatherBriefingService = {
  /**
   * 브리핑 조회 (캐시 우선)
   * @param {Object} weather - weatherService에서 가져온 날씨 데이터
   * @returns {Promise<string|null>} 브리핑 텍스트
   */
  async getBriefing(weather) {
    const today = getTodayDate();

    try {
      // 1. 캐시에서 먼저 조회 (.maybeSingle: 0건이어도 null 반환, 406 에러 없음)
      const { data: cached } = await supabase
        .from('weather_briefings')
        .select('briefing')
        .eq('briefing_date', today)
        .maybeSingle();

      if (cached?.briefing) {
        return cached.briefing;
      }

      // 2. 캐시 없으면 새로 생성
      const briefing = await this.generateBriefing(weather);

      // 3. 생성된 브리핑 캐시에 저장
      if (briefing) {
        await supabase
          .from('weather_briefings')
          .upsert({
            briefing_date: today,
            briefing: briefing,
            weather_data: {
              temp: weather.current?.temp,
              humidity: weather.current?.humidity,
              windSpeed: weather.current?.windSpeed,
              sky: weather.current?.sky,
              today: {
                minTemp: weather.daily?.[0]?.minTemp,
                maxTemp: weather.daily?.[0]?.maxTemp,
                pop: weather.daily?.[0]?.pop,
                maxPcp: weather.daily?.[0]?.maxPcp
              },
              tomorrow: {
                minTemp: weather.daily?.[1]?.minTemp,
                maxTemp: weather.daily?.[1]?.maxTemp,
                pop: weather.daily?.[1]?.pop,
                maxPcp: weather.daily?.[1]?.maxPcp
              }
            },
            created_at: new Date().toISOString()
          }, {
            onConflict: 'briefing_date'
          });
      }

      return briefing;
    } catch (error) {
      console.error('날씨 브리핑 조회 오류:', error);
      // 오류 시 폴백 브리핑 반환
      return this.generateFallbackBriefing(weather);
    }
  },

  /**
   * 캐시 삭제 후 브리핑 재생성 (관리자용)
   * @param {Object} weather - weatherService에서 가져온 날씨 데이터
   * @returns {Promise<string|null>} 새 브리핑 텍스트
   */
  async regenerateBriefing(weather) {
    const today = getTodayDate();

    try {
      // 1. 기존 캐시 삭제
      await supabase
        .from('weather_briefings')
        .delete()
        .eq('briefing_date', today);

      // 2. 새로 생성
      const briefing = await this.generateBriefing(weather);

      // 3. 캐시에 저장
      if (briefing) {
        await supabase
          .from('weather_briefings')
          .upsert({
            briefing_date: today,
            briefing: briefing,
            weather_data: {
              temp: weather.current?.temp,
              humidity: weather.current?.humidity,
              windSpeed: weather.current?.windSpeed,
              sky: weather.current?.sky,
              today: {
                minTemp: weather.daily?.[0]?.minTemp,
                maxTemp: weather.daily?.[0]?.maxTemp,
                pop: weather.daily?.[0]?.pop,
                maxPcp: weather.daily?.[0]?.maxPcp
              },
              tomorrow: {
                minTemp: weather.daily?.[1]?.minTemp,
                maxTemp: weather.daily?.[1]?.maxTemp,
                pop: weather.daily?.[1]?.pop,
                maxPcp: weather.daily?.[1]?.maxPcp
              }
            },
            created_at: new Date().toISOString()
          }, {
            onConflict: 'briefing_date'
          });
      }

      return briefing;
    } catch (error) {
      console.error('날씨 브리핑 재생성 오류:', error);
      return null;
    }
  },

  /**
   * Gemini로 브리핑 생성
   * @param {Object} weather - 날씨 데이터
   * @returns {Promise<string>} 브리핑 텍스트
   */
  async generateBriefing(weather) {
    if (!GEMINI_API_KEY) {
      return this.generateFallbackBriefing(weather);
    }

    const { current, daily } = weather;
    const today = daily?.[0];
    const tomorrow = daily?.[1];

    console.log('[브리핑 데이터]', {
      currentPty: current?.pty,
      todayPty: today?.pty,
      tomorrowPty: tomorrow?.pty,
      currentSky: current?.sky,
      todaySky: today?.sky,
    });

    // 현재 월 (KST 기준)
    const currentMonth = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).getMonth() + 1;

    const prompt = `당신은 경북 성주군 참외 비닐하우스(온실) 농가를 위한 날씨 브리핑 전문가입니다.
참외는 노지가 아닌 비닐하우스에서 재배됩니다.

[현재 시점: ${currentMonth}월]

[오늘 날씨]
- 현재 기온: ${current?.temp ?? '정보없음'}°C
- 오늘 최저/최고: ${today?.minTemp ?? '?'}°C / ${today?.maxTemp ?? '?'}°C
- 현재 습도: ${current?.humidity ?? '정보없음'}%
- 강수확률: ${today?.pop ?? 0}%
- 예상 강수량: ${today?.maxPcp ?? '강수없음'}
- 풍속: ${current?.windSpeed ?? '정보없음'} m/s
- 하늘 상태: ${getSkyText(today?.sky ?? current?.sky)}
- 강수형태: ${getPtyText(current?.pty ?? today?.pty)}

[내일 날씨]
- 내일 최저/최고: ${tomorrow?.minTemp ?? '?'}°C / ${tomorrow?.maxTemp ?? '?'}°C
- 강수확률: ${tomorrow?.pop ?? 0}%
- 예상 강수량: ${tomorrow?.maxPcp ?? '강수없음'}
- 하늘 상태: ${getSkyText(tomorrow?.sky)}
- 강수형태: ${getPtyText(tomorrow?.pty)}

[성주군 월별 평균 기온 참고]
- 1월: -6~3°C, 2월: -4~6°C, 3월: 1~12°C, 4월: 7~19°C
- 5월: 13~25°C, 6월: 18~29°C, 7월: 22~31°C, 8월: 22~31°C
- 9월: 16~27°C, 10월: 8~21°C, 11월: 1~13°C, 12월: -5~4°C

[체감 온도 판단 기준 - 중요!]
- 기온을 해당 월 평균과 비교해서 판단하세요
- 평균보다 높으면 "포근", "따뜻", "활동하기 좋은" 등으로 표현
- 평균 수준이면 "평년 수준", "무난한" 등으로 표현
- 평균보다 낮을 때만 "쌀쌀", "추운" 등으로 표현
- 절대 기온이 낮더라도 해당 계절 평균 이상이면 절대 "춥다"고 하지 마세요
- 예: 2월에 최고 11°C면 평균(6°C)보다 훨씬 높으므로 "포근한 날씨"입니다

[비닐하우스 참외 재배 기준]
- 하우스 내 적정 온도: 낮 25~30°C, 밤 15~18°C
- 외기온 영하 또는 5°C 이하: 보온덮개, 난방 점검 필요
- 외기온 30°C 이상 또는 맑은 날: 하우스 내 고온 주의, 환기창 개방
- 습도 85% 이상: 병해 발생 위험 (역병, 탄저병), 환기로 습도 조절
- 강풍(5m/s 이상): 환기창 관리, 비닐 파손 주의
- 강수형태가 "눈" 또는 "비/눈"이면 반드시 눈 관련 내용 포함 (하늘이 맑아도 눈이 올 수 있음!)
  · 눈: 하우스 적설 하중 주의, 눈 쌓이면 제설 필요
  · 비/눈: 기온에 따라 비→눈 전환 가능성 언급
- 비 예보 시 강수량에 비례하여 조언 (중요!):
  · 강수없음/1.0mm 미만: 비 걱정 불필요, 가볍게 언급만
  · 1.0~29.9mm: 측창 점검 정도
  · 30.0mm 이상: 배수로 점검, 침수 주의 등 강한 조언
  · 소량 비에 배수로/침수 언급은 과도하므로 금지
- 흐린 날 지속: 일조량 부족, 생육 지연 가능

위 데이터로 비닐하우스 농가에게 보낼 날씨 브리핑을 작성해주세요.

규칙:
1. 50자 이내로 작성
2. 친근한 말투 (예: "~네요", "~세요", "~해요")
3. 이모지 사용 금지 (텍스트만)
4. 비닐하우스 관리 관점에서 실용적인 조언 포함
5. 체감 온도는 반드시 해당 월 평균 대비로 판단 (절대 기온으로 판단 금지)
6. 오늘과 내일 날씨를 자연스럽게 연결
7. JSON 형식으로만 반환: {"briefing": "브리핑 내용"}`;

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
        return this.generateFallbackBriefing(weather);
      }

      const result = await response.json();
      const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        return this.generateFallbackBriefing(weather);
      }

      // JSON 추출
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.briefing) {
          return parsed.briefing.trim();
        }
      }

      return this.generateFallbackBriefing(weather);
    } catch (error) {
      console.error('Gemini 날씨 브리핑 생성 오류:', error);
      return this.generateFallbackBriefing(weather);
    }
  },

  /**
   * 폴백 브리핑 (API 실패 시 규칙 기반)
   * @param {Object} weather - 날씨 데이터
   * @returns {string} 브리핑 텍스트
   */
  generateFallbackBriefing(weather) {
    const { current, daily } = weather || {};
    const today = daily?.[0];
    const tomorrow = daily?.[1];
    const todayMax = today?.maxTemp;
    const todayMin = today?.minTemp;
    const todayPop = today?.pop;
    const tomorrowMax = tomorrow?.maxTemp;
    const tomorrowMin = tomorrow?.minTemp;
    const tomorrowPop = tomorrow?.pop;
    const humidity = current?.humidity;

    // 오늘 + 내일 조합 브리핑 (비닐하우스 기준)
    let todayMsg = '오늘 하우스 관리 무난해요';
    let tomorrowMsg = '내일도 괜찮아요';

    const todayPty = current?.pty || today?.pty || 0;
    const tomorrowPty = tomorrow?.pty || 0;
    const todaySky = today?.sky;

    // 오늘 날씨 판단 (비닐하우스 관점)
    if (todayPty === 3) {
      todayMsg = '오늘 눈 와요, 적설 하중 주의하세요';
    } else if (todayPty === 2) {
      todayMsg = '오늘 비/눈 와요, 하우스 점검하세요';
    } else if (todayMin !== undefined && todayMin <= 5) {
      todayMsg = '오늘 밤 보온 점검하세요';
    } else if (todayMax !== undefined && todayMax >= 30) {
      todayMsg = '오늘 환기 신경 쓰세요';
    } else if (humidity !== undefined && humidity >= 85) {
      todayMsg = '오늘 습도 높아요, 환기하세요';
    } else if (todayPop !== undefined && todayPop >= 60) {
      todayMsg = '오늘 비 와요, 측창 확인하세요';
    } else if (todaySky === 4) {
      todayMsg = '오늘 흐려요, 일조량 부족할 수 있어요';
    } else if (todaySky === 3) {
      todayMsg = '오늘 구름 많아요, 하우스 관리 무난해요';
    }

    // 내일 날씨 판단 (비닐하우스 관점)
    if (tomorrowPty === 3) {
      tomorrowMsg = '내일 눈 대비하세요';
    } else if (tomorrowPty === 2) {
      tomorrowMsg = '내일 비/눈 대비하세요';
    } else if (tomorrowMin !== undefined && tomorrowMin <= 5) {
      tomorrowMsg = '내일 추워요, 보온 준비하세요';
    } else if (tomorrowMax !== undefined && tomorrowMax >= 30) {
      tomorrowMsg = '내일 환기 준비하세요';
    } else if (tomorrowPop !== undefined && tomorrowPop >= 60) {
      tomorrowMsg = '내일 비 대비하세요';
    } else if (tomorrowMax !== undefined && todayMax !== undefined) {
      if (tomorrowMax > todayMax + 3) {
        tomorrowMsg = '내일 더 더워져요';
      } else if (tomorrowMax < todayMax - 3) {
        tomorrowMsg = '내일 선선해져요';
      }
    }

    return `${todayMsg}, ${tomorrowMsg}`;
  }
};

export default weatherBriefingService;
