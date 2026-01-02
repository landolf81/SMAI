// Supabase Edge Function - AI 브리핑 생성
// Cron으로 매일 15:00 (KST) 호출

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// 한국 시간 가져오기 (UTC+9)
const getKoreanTime = (): Date => {
  const now = new Date()
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
}

// 날짜 포맷 (YYYY-MM-DD)
const formatDate = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ISO 주차 번호 계산
function getWeekNumber(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

// 작년 동일 주차 같은 요일 날짜 계산
function getLastYearSameWeekDay(dateStr: string): string {
  const d = new Date(dateStr)
  const dayOfWeek = d.getDay()
  const weekNum = getWeekNumber(d)
  const lastYear = new Date(d.getFullYear() - 1, 0, 1)
  const lastYearFirstDay = lastYear.getDay()
  const daysToAdd = (weekNum - 1) * 7 + (1 - lastYearFirstDay)
  lastYear.setDate(lastYear.getDate() + daysToAdd)
  const targetDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  lastYear.setDate(lastYear.getDate() + targetDay)
  return lastYear.toISOString().split('T')[0]
}

// 추세 분석
interface MarketData {
  date: string
  boxes: number
  avgPrice: number
  minPrice: number
  maxPrice: number
}

interface TrendData {
  priceTrend: string
  volumeTrend: string
  dailyChange: number | null
  weeklyChange: number | null
  yearlyChange: number | null
  volumeChange: number | null
  volumeDiff: number | null
}

function analyzeTrend(data: {
  today: MarketData | null
  d1: MarketData | null
  d2: MarketData | null
  d7: MarketData | null
  lastYear: MarketData | null
}): TrendData {
  const { today, d1, d2, d7, lastYear } = data

  let priceTrend = '보합'
  if (today && d1 && d2) {
    const change1 = ((today.avgPrice - d1.avgPrice) / d1.avgPrice) * 100
    const change2 = ((d1.avgPrice - d2.avgPrice) / d2.avgPrice) * 100

    if (change1 > 2 && change2 > 2) priceTrend = '연속상승'
    else if (change1 < -2 && change2 < -2) priceTrend = '연속하락'
    else if (change1 > 2 && change2 < -2) priceTrend = '반등'
    else if (change1 < -2 && change2 > 2) priceTrend = '꺾임'
    else if (change1 > 2) priceTrend = '상승'
    else if (change1 < -2) priceTrend = '하락'
  }

  let volumeTrend = '유지'
  let volumeChange: number | null = null
  let volumeDiff: number | null = null
  if (today && d1) {
    volumeChange = Math.round(((today.boxes - d1.boxes) / d1.boxes) * 1000) / 10
    volumeDiff = today.boxes - d1.boxes
    if (volumeChange > 10) volumeTrend = '증가'
    else if (volumeChange < -10) volumeTrend = '감소'
  }

  const dailyChange = today && d1
    ? Math.round(((today.avgPrice - d1.avgPrice) / d1.avgPrice) * 1000) / 10
    : null

  const weeklyChange = today && d7
    ? Math.round(((today.avgPrice - d7.avgPrice) / d7.avgPrice) * 1000) / 10
    : null

  const yearlyChange = today && lastYear
    ? Math.round(((today.avgPrice - lastYear.avgPrice) / lastYear.avgPrice) * 1000) / 10
    : null

  return { priceTrend, volumeTrend, dailyChange, weeklyChange, yearlyChange, volumeChange, volumeDiff }
}

// 시장명 축약
function getShortName(marketName: string): string {
  return marketName
    .replace('공판장', '')
    .replace('원예농협', '')
    .replace('농협', '')
    .replace('성주', '')
}

// Gemini로 브리핑 생성
async function generateBriefingText(
  marketName: string,
  data: { today: MarketData; d1: MarketData | null; d2: MarketData | null; d3: MarketData | null; d7: MarketData | null; lastYear: MarketData | null },
  trend: TrendData
): Promise<string> {
  const shortName = getShortName(marketName)

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
물량 전일대비: ${trend.volumeDiff !== null ? `${trend.volumeDiff > 0 ? '+' : ''}${trend.volumeDiff.toLocaleString()}상자 (${trend.volumeChange! > 0 ? '+' : ''}${trend.volumeChange}%)` : '없음'}
주간대비: ${trend.weeklyChange !== null ? `${trend.weeklyChange > 0 ? '+' : ''}${trend.weeklyChange}%` : '없음'}
작년대비: ${trend.yearlyChange !== null ? `${trend.yearlyChange > 0 ? '+' : ''}${trend.yearlyChange}%` : '없음'}

위 데이터로 농가에게 보낼 한 줄 브리핑을 작성해주세요.

규칙:
1. 50자 이내로 작성
2. 카카오톡으로 보내는 친근한 말투 (예: "~네요", "~같아요", "~입니다", "~해요")
3. 절대 금지 단어: 폭등, 폭락, 급등, 급락, 대박, 위기, 최악, 최고, 폭발, 붕괴
4. 이모지 사용 금지 (텍스트만 사용)
5. 구체적인 숫자보다는 흐름/분위기 중심으로 표현
6. 시장명을 짧게 포함 (예: "${shortName} 오늘은...")
7. 물량 변동 표현 기준 (절대량 우선):
   - ±1,000상자 미만: "물량은 비슷해요"
   - 1,000~3,000상자 증감: "물량이 늘었어요/줄었어요"
   - 3,000상자 이상 증감: "물량이 크게 늘었어요/줄었어요"
   - 단, 비율이 30% 이상이면 "많이" 수식어 추가 (예: "물량이 많이 늘었어요")
8. JSON 형식으로만 반환: {"briefing": "브리핑 내용"}`

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    })

    if (!response.ok) {
      console.error('Gemini API 오류:', response.status)
      return generateFallbackBriefing(shortName, trend)
    }

    const result = await response.json()
    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) {
      return generateFallbackBriefing(shortName, trend)
    }

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.briefing) {
        // 금지 단어 필터링
        const forbidden = ['폭등', '폭락', '급등', '급락', '대박', '위기', '최악', '최고', '폭발', '붕괴']
        let briefing = parsed.briefing
        forbidden.forEach(word => {
          briefing = briefing.replace(new RegExp(word, 'g'), '')
        })
        return briefing.trim()
      }
    }

    return generateFallbackBriefing(shortName, trend)
  } catch (error) {
    console.error('Gemini 브리핑 생성 오류:', error)
    return generateFallbackBriefing(shortName, trend)
  }
}

// 폴백 브리핑
function generateFallbackBriefing(shortName: string, trend: TrendData): string {
  const trendMessages: Record<string, string> = {
    '연속상승': '며칠째 좋은 흐름이에요',
    '연속하락': '조금씩 내려가는 분위기예요',
    '반등': '반등 기미가 보여요',
    '꺾임': '오름세가 주춤해졌어요',
    '상승': '어제보다 올랐어요',
    '하락': '어제보다 내렸어요',
    '보합': '큰 변동 없이 유지 중이에요'
  }

  const volumeMessages: Record<string, string> = {
    '증가': ', 물량은 늘었어요',
    '감소': ', 물량은 줄었어요',
    '유지': ''
  }

  return `${shortName} ${trendMessages[trend.priceTrend] || '오늘도 무난해요'}${volumeMessages[trend.volumeTrend] || ''}`
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const kst = getKoreanTime()
    const targetDate = formatDate(kst)

    console.log(`🚀 브리핑 생성 시작: ${targetDate}`)

    // 1. 대상 시장 목록 (선남농협만)
    const TARGET_MARKETS = ['선남농협']

    // 오늘 날짜에 데이터가 있는지 확인
    const { data: marketsData, error: marketsError } = await supabase
      .from('market_summary')
      .select('market_name')
      .eq('market_date', targetDate)
      .in('market_name', TARGET_MARKETS)

    if (marketsError) {
      throw new Error(`시장 목록 조회 오류: ${marketsError.message}`)
    }

    const markets = [...new Set(marketsData?.map(m => m.market_name) || [])]
    console.log(`📋 대상 시장: ${markets.length}개 - ${markets.join(', ')}`)

    if (markets.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: '오늘 경락 데이터가 없습니다',
        date: targetDate
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // 2. 각 시장별 브리핑 생성
    const results: { market: string; briefing: string; success: boolean }[] = []

    for (const marketName of markets) {
      try {
        // 최근 4개 경매일 조회
        const { data: recentData } = await supabase
          .from('market_summary')
          .select('*')
          .eq('market_name', marketName)
          .lte('market_date', targetDate)
          .order('market_date', { ascending: false })
          .limit(4)

        // 7일 전 데이터
        const d7Date = new Date(new Date(targetDate).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const { data: d7Data } = await supabase
          .from('market_summary')
          .select('*')
          .eq('market_name', marketName)
          .lte('market_date', d7Date)
          .order('market_date', { ascending: false })
          .limit(1)

        // 작년 동주차 데이터
        const lastYearDate = getLastYearSameWeekDay(targetDate)
        const { data: lastYearData } = await supabase
          .from('market_summary')
          .select('*')
          .eq('market_name', marketName)
          .gte('market_date', new Date(new Date(lastYearDate).getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .lte('market_date', new Date(new Date(lastYearDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
          .order('market_date', { ascending: false })
          .limit(1)

        const formatData = (row: any): MarketData | null => row ? {
          date: row.market_date,
          boxes: parseInt(row.total_boxes) || 0,
          avgPrice: parseInt(row.avg_price) || 0,
          minPrice: parseInt(row.min_price) || 0,
          maxPrice: parseInt(row.max_price) || 0
        } : null

        const data = {
          today: formatData(recentData?.[0]),
          d1: formatData(recentData?.[1]),
          d2: formatData(recentData?.[2]),
          d3: formatData(recentData?.[3]),
          d7: formatData(d7Data?.[0]),
          lastYear: formatData(lastYearData?.[0])
        }

        if (!data.today) {
          console.log(`⚠️ ${marketName}: 오늘 데이터 없음`)
          continue
        }

        const trend = analyzeTrend(data)
        const briefing = await generateBriefingText(marketName, data as any, trend)

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
          })

        if (upsertError) {
          console.error(`❌ ${marketName} 저장 오류:`, upsertError)
          results.push({ market: marketName, briefing: '', success: false })
        } else {
          console.log(`✅ ${marketName}: ${briefing}`)
          results.push({ market: marketName, briefing, success: true })
        }

      } catch (error) {
        console.error(`❌ ${marketName} 처리 오류:`, error)
        results.push({ market: marketName, briefing: '', success: false })
      }
    }

    const successCount = results.filter(r => r.success).length
    console.log(`🎉 브리핑 생성 완료: ${successCount}/${markets.length}`)

    return new Response(JSON.stringify({
      success: true,
      date: targetDate,
      total: markets.length,
      generated: successCount,
      results
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('브리핑 생성 오류:', error)
    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
