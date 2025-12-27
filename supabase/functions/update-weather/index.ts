// Supabase Edge Function - 날씨 캐시 자동 갱신
// pg_cron으로 매시간 호출

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const KMA_API_KEY = Deno.env.get('KMA_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// 성주군 기상청 격자 좌표 (성주읍 삼산리 기준)
const DEFAULT_LOCATION = {
  name: '성주',
  nx: 83,
  ny: 91,
  regIdLand: '11H10000',
  regIdTemp: '11H10701'
}

// 한국 시간 가져오기 (UTC+9)
const getKoreanTime = (): Date => {
  const now = new Date()
  // UTC 시간에 9시간 추가
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
}

// 날짜 포맷 (KST 기준)
const formatDate = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

const formatTime = (date: Date): string => {
  return String(date.getUTCHours()).padStart(2, '0') + '00'
}

// 가장 최근 발표 시각 계산 (KST 기준)
const getLatestBaseTime = (): { baseDate: string; baseTime: string } => {
  const now = getKoreanTime()
  const hour = now.getUTCHours()
  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23]

  let baseTime = baseTimes[0]
  for (const time of baseTimes) {
    if (hour >= time + 1) {
      baseTime = time
    }
  }

  if (hour < 3) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    return {
      baseDate: formatDate(yesterday),
      baseTime: '2300'
    }
  }

  return {
    baseDate: formatDate(now),
    baseTime: String(baseTime).padStart(2, '0') + '00'
  }
}

// 기상청 API URL 생성
const buildKmaUrl = (apiPath: string, params: Record<string, string>): string => {
  const searchParams = new URLSearchParams(params)
  const encodedKey = encodeURIComponent(KMA_API_KEY)
  return `https://apis.data.go.kr${apiPath}?serviceKey=${encodedKey}&${searchParams.toString()}`
}

// 초단기실황 API (KST 기준)
const getUltraSrtNcst = async () => {
  const now = getKoreanTime()
  let baseDateTime = now

  // 40분 이전이면 이전 시간 사용 (날짜도 함께 조정)
  if (now.getUTCMinutes() < 40) {
    baseDateTime = new Date(now.getTime() - 60 * 60 * 1000)
  }

  const baseDate = formatDate(baseDateTime)
  const baseTime = formatTime(baseDateTime)

  const url = buildKmaUrl('/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', {
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: DEFAULT_LOCATION.nx.toString(),
    ny: DEFAULT_LOCATION.ny.toString()
  })

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  if (data.response?.header?.resultCode !== '00') return null

  const items = data.response.body.items.item
  const result: Record<string, string> = {}
  items.forEach((item: { category: string; obsrValue: string }) => {
    result[item.category] = item.obsrValue
  })

  return {
    temp: result.T1H ? Math.round(parseFloat(result.T1H)) : null,
    humidity: result.REH ? parseInt(result.REH) : null,
    precipitation: result.RN1 || '0',
    pty: parseInt(result.PTY) || 0,
    windSpeed: result.WSD ? parseFloat(result.WSD) : null
  }
}

// TMN/TMX 전용 API 호출 (02시 발표 기준 - 오늘 최저/최고 기온 포함, KST)
const getTodayMinMax = async () => {
  const now = getKoreanTime()
  const today = formatDate(now)

  // 02시 발표 데이터 조회 (TMN/TMX 포함)
  const url = buildKmaUrl('/1360000/VilageFcstInfoService_2.0/getVilageFcst', {
    numOfRows: '300',
    pageNo: '1',
    dataType: 'JSON',
    base_date: today,
    base_time: '0200',
    nx: DEFAULT_LOCATION.nx.toString(),
    ny: DEFAULT_LOCATION.ny.toString()
  })

  try {
    const response = await fetch(url)
    if (!response.ok) return null

    const data = await response.json()
    if (data.response?.header?.resultCode !== '00') return null

    const items = data.response.body.items.item
    const result: Record<string, { tmn: number | null; tmx: number | null }> = {}

    items.forEach((item: { fcstDate: string; category: string; fcstValue: string }) => {
      const date = item.fcstDate
      if (!result[date]) {
        result[date] = { tmn: null, tmx: null }
      }
      if (item.category === 'TMN') result[date].tmn = parseFloat(item.fcstValue)
      if (item.category === 'TMX') result[date].tmx = parseFloat(item.fcstValue)
    })

    return result
  } catch {
    return null
  }
}

// 단기예보 API
const getVilageFcst = async () => {
  const { baseDate, baseTime } = getLatestBaseTime()

  const url = buildKmaUrl('/1360000/VilageFcstInfoService_2.0/getVilageFcst', {
    numOfRows: '1000',
    pageNo: '1',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: DEFAULT_LOCATION.nx.toString(),
    ny: DEFAULT_LOCATION.ny.toString()
  })

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  if (data.response?.header?.resultCode !== '00') return null

  // 02시 발표 기준 TMN/TMX 가져오기
  const minMaxData = await getTodayMinMax()

  const items = data.response.body.items.item
  const hourlyMap: Record<string, Record<string, string>> = {}
  const dailyMap: Record<string, { date: string; temps: number[]; skys: number[]; ptys: number[]; pops: number[]; tmn: number | null; tmx: number | null }> = {}

  items.forEach((item: { fcstDate: string; fcstTime: string; category: string; fcstValue: string }) => {
    const dateTime = `${item.fcstDate}_${item.fcstTime}`
    const date = item.fcstDate

    if (!hourlyMap[dateTime]) {
      hourlyMap[dateTime] = { date: item.fcstDate, time: item.fcstTime }
    }
    hourlyMap[dateTime][item.category] = item.fcstValue

    if (!dailyMap[date]) {
      // 02시 발표 기준 TMN/TMX로 초기화
      const minMax = minMaxData?.[date]
      dailyMap[date] = {
        date,
        temps: [],
        skys: [],
        ptys: [],
        pops: [],
        tmn: minMax?.tmn ?? null,
        tmx: minMax?.tmx ?? null
      }
    }

    if (item.category === 'TMP') dailyMap[date].temps.push(parseFloat(item.fcstValue))
    if (item.category === 'SKY') dailyMap[date].skys.push(parseInt(item.fcstValue))
    if (item.category === 'PTY') dailyMap[date].ptys.push(parseInt(item.fcstValue))
    if (item.category === 'POP') dailyMap[date].pops.push(parseInt(item.fcstValue))
    // TMN/TMX: 현재 발표에 값이 있으면 최신 값으로 업데이트
    if (item.category === 'TMN') dailyMap[date].tmn = parseFloat(item.fcstValue)
    if (item.category === 'TMX') dailyMap[date].tmx = parseFloat(item.fcstValue)
  })

  const getMostFrequent = (arr: number[]): number => {
    const counts: Record<number, number> = {}
    arr.forEach(v => { counts[v] = (counts[v] || 0) + 1 })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    return sorted[0] ? parseInt(sorted[0][0]) : arr[0]
  }

  const hourly = Object.values(hourlyMap)
    .map(h => ({
      date: h.date,
      time: h.time,
      temp: h.TMP ? Math.round(parseFloat(h.TMP)) : null,
      sky: parseInt(h.SKY) || 1,
      pty: parseInt(h.PTY) || 0,
      pop: h.POP ? parseInt(h.POP) : 0,
      humidity: h.REH ? parseInt(h.REH) : null,
      windSpeed: h.WSD ? parseFloat(h.WSD) : null
    }))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))

  // TMN/TMX가 있으면 우선 사용, 없으면 시간별 기온에서 계산
  const daily = Object.values(dailyMap)
    .map(d => ({
      date: d.date,
      minTemp: d.tmn !== null ? Math.round(d.tmn) : (d.temps.length > 0 ? Math.round(Math.min(...d.temps)) : null),
      maxTemp: d.tmx !== null ? Math.round(d.tmx) : (d.temps.length > 0 ? Math.round(Math.max(...d.temps)) : null),
      sky: d.skys.length > 0 ? getMostFrequent(d.skys) : 1,
      pty: d.ptys.some(p => p > 0) ? d.ptys.find(p => p > 0) : 0,
      pop: d.pops.length > 0 ? Math.max(...d.pops) : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return { hourly, daily }
}

// 중기예보 API (KST 기준)
const getMidFcst = async () => {
  const now = getKoreanTime()
  const hour = now.getUTCHours()
  let tmFc: string

  if (hour < 6) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    tmFc = formatDate(yesterday) + '1800'
  } else if (hour < 18) {
    tmFc = formatDate(now) + '0600'
  } else {
    tmFc = formatDate(now) + '1800'
  }

  const url = buildKmaUrl('/1360000/MidFcstInfoService/getMidLandFcst', {
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    regId: DEFAULT_LOCATION.regIdLand,
    tmFc: tmFc
  })

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  if (data.response?.header?.resultCode !== '00') return null

  const item = data.response.body.items.item[0]
  const result: { date: string; dayOffset: number; weather: string; pop: number; icon: string }[] = []

  const getWeatherIcon = (weather: string): string => {
    if (!weather) return '☀️'
    if (weather.includes('비')) return '🌧️'
    if (weather.includes('눈')) return '❄️'
    if (weather.includes('흐림')) return '☁️'
    if (weather.includes('구름')) return '⛅'
    return '☀️'
  }

  for (let i = 3; i <= 10; i++) {
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + i)

    const weather = item[`wf${i}Am`] || item[`wf${i}Pm`] || item[`wf${i}`]
    const pop = Math.max(
      parseInt(item[`rnSt${i}Am`]) || 0,
      parseInt(item[`rnSt${i}Pm`]) || 0,
      parseInt(item[`rnSt${i}`]) || 0
    )

    if (weather) {
      result.push({
        date: formatDate(targetDate),
        dayOffset: i,
        weather,
        pop,
        icon: getWeatherIcon(weather)
      })
    }
  }

  return result
}

// 중기기온예보 API (KST 기준)
const getMidTa = async () => {
  const now = getKoreanTime()
  const hour = now.getUTCHours()
  let tmFc: string

  if (hour < 6) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    tmFc = formatDate(yesterday) + '1800'
  } else if (hour < 18) {
    tmFc = formatDate(now) + '0600'
  } else {
    tmFc = formatDate(now) + '1800'
  }

  const url = buildKmaUrl('/1360000/MidFcstInfoService/getMidTa', {
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    regId: DEFAULT_LOCATION.regIdTemp,
    tmFc: tmFc
  })

  const response = await fetch(url)
  if (!response.ok) return null

  const data = await response.json()
  if (data.response?.header?.resultCode !== '00') return null

  const item = data.response.body.items.item[0]
  const result: Record<string, { minTemp: number; maxTemp: number }> = {}

  for (let i = 3; i <= 10; i++) {
    const targetDate = new Date(now)
    targetDate.setDate(targetDate.getDate() + i)
    result[formatDate(targetDate)] = {
      minTemp: item[`taMin${i}`],
      maxTemp: item[`taMax${i}`]
    }
  }

  return result
}

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    })
  }

  console.log('날씨 캐시 업데이트 시작...')

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 모든 API 병렬 호출
    const [current, forecast, midForecast, midTemp] = await Promise.all([
      getUltraSrtNcst(),
      getVilageFcst(),
      getMidFcst(),
      getMidTa()
    ])

    // 중기예보 데이터 병합
    const midForecastMap: Record<string, { date: string; weather: string; icon: string; pop: number; minTemp: number | null; maxTemp: number | null }> = {}
    ;(midForecast || []).forEach(day => {
      const temp = midTemp?.[day.date]
      midForecastMap[day.date] = {
        ...day,
        minTemp: temp?.minTemp ?? null,
        maxTemp: temp?.maxTemp ?? null
      }
    })

    // 단기 + 중기 병합
    const dailyDates = new Set<string>()
    const dailyWithMid = (forecast?.daily || []).map(day => {
      dailyDates.add(day.date)
      const midData = midForecastMap[day.date]

      // 우선순위: 새 API TMN/TMX > 중기예보
      let minTemp = day.minTemp ?? midData?.minTemp ?? null
      let maxTemp = day.maxTemp ?? midData?.maxTemp ?? null

      if (midData) {
        return {
          ...day,
          weather: midData.weather,
          icon: midData.icon,
          pop: midData.pop > 0 ? midData.pop : day.pop,
          minTemp,
          maxTemp
        }
      }
      return { ...day, minTemp, maxTemp }
    })

    const midTermOnly = Object.values(midForecastMap)
      .filter(day => !dailyDates.has(day.date))

    const weatherData = {
      location: DEFAULT_LOCATION.name,
      current,
      shortTerm: forecast?.hourly || [],
      daily: dailyWithMid,
      midTerm: midTermOnly,
      updatedAt: new Date().toISOString()
    }

    // Supabase에 캐시 저장
    const { error } = await supabase
      .from('weather_cache')
      .upsert({
        location_key: 'default',
        data: weatherData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'location_key'
      })

    if (error) {
      console.error('캐시 저장 실패:', error)
      return new Response(JSON.stringify({ error: 'Failed to update cache', details: error }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    console.log('날씨 캐시 업데이트 완료')
    return new Response(JSON.stringify({
      success: true,
      message: 'Weather cache updated',
      updatedAt: weatherData.updatedAt
    }), {
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('날씨 업데이트 오류:', error)
    return new Response(JSON.stringify({ error: 'Internal server error', message: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
