// Vercel Cron Job - 날씨 캐시 자동 갱신
// 매시간 실행되어 기상청 API 데이터를 Supabase 캐시에 저장

import { createClient } from '@supabase/supabase-js';

const KMA_API_KEY = process.env.VITE_KMA_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 성주군 기상청 격자 좌표
const DEFAULT_LOCATION = {
  name: '성주',
  nx: 83,
  ny: 93,
  regIdLand: '11H10000',
  regIdTemp: '11H10701'
};

// 날짜 포맷
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const formatTime = (date) => {
  return String(date.getHours()).padStart(2, '0') + '00';
};

// 가장 최근 발표 시각 계산
const getLatestBaseTime = () => {
  const now = new Date();
  const hour = now.getHours();
  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];

  let baseTime = baseTimes[0];
  for (const time of baseTimes) {
    if (hour >= time + 1) {
      baseTime = time;
    }
  }

  if (hour < 3) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      baseDate: formatDate(yesterday),
      baseTime: '2300'
    };
  }

  return {
    baseDate: formatDate(now),
    baseTime: String(baseTime).padStart(2, '0') + '00'
  };
};

// 기상청 API URL 생성
const buildKmaUrl = (apiPath, params) => {
  const searchParams = new URLSearchParams(params);
  const encodedKey = encodeURIComponent(KMA_API_KEY);
  return `https://apis.data.go.kr${apiPath}?serviceKey=${encodedKey}&${searchParams.toString()}`;
};

// 초단기실황 API
const getUltraSrtNcst = async () => {
  const now = new Date();
  const baseDate = formatDate(now);
  let baseTime = formatTime(now);
  if (now.getMinutes() < 40) {
    const prevHour = new Date(now.getTime() - 60 * 60 * 1000);
    baseTime = formatTime(prevHour);
  }

  const url = buildKmaUrl('/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', {
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: DEFAULT_LOCATION.nx.toString(),
    ny: DEFAULT_LOCATION.ny.toString()
  });

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.response?.header?.resultCode !== '00') return null;

  const items = data.response.body.items.item;
  const result = {};
  items.forEach(item => {
    result[item.category] = item.obsrValue;
  });

  return {
    temp: result.T1H ? Math.round(parseFloat(result.T1H)) : null,
    humidity: result.REH ? parseInt(result.REH) : null,
    precipitation: result.RN1 || '0',
    pty: parseInt(result.PTY) || 0,
    windSpeed: result.WSD ? parseFloat(result.WSD) : null
  };
};

// 단기예보 API
const getVilageFcst = async () => {
  const { baseDate, baseTime } = getLatestBaseTime();

  const url = buildKmaUrl('/1360000/VilageFcstInfoService_2.0/getVilageFcst', {
    numOfRows: '1000',
    pageNo: '1',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: DEFAULT_LOCATION.nx.toString(),
    ny: DEFAULT_LOCATION.ny.toString()
  });

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.response?.header?.resultCode !== '00') return null;

  const items = data.response.body.items.item;
  const hourlyMap = {};
  const dailyMap = {};

  items.forEach(item => {
    const dateTime = `${item.fcstDate}_${item.fcstTime}`;
    const date = item.fcstDate;

    if (!hourlyMap[dateTime]) {
      hourlyMap[dateTime] = { date: item.fcstDate, time: item.fcstTime };
    }
    hourlyMap[dateTime][item.category] = item.fcstValue;

    if (!dailyMap[date]) {
      dailyMap[date] = { date, temps: [], skys: [], ptys: [], pops: [] };
    }

    if (item.category === 'TMP') dailyMap[date].temps.push(parseFloat(item.fcstValue));
    if (item.category === 'SKY') dailyMap[date].skys.push(parseInt(item.fcstValue));
    if (item.category === 'PTY') dailyMap[date].ptys.push(parseInt(item.fcstValue));
    if (item.category === 'POP') dailyMap[date].pops.push(parseInt(item.fcstValue));
  });

  const getMostFrequent = (arr) => {
    const counts = {};
    arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || arr[0];
  };

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
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const daily = Object.values(dailyMap)
    .map(d => ({
      date: d.date,
      minTemp: d.temps.length > 0 ? Math.min(...d.temps) : null,
      maxTemp: d.temps.length > 0 ? Math.max(...d.temps) : null,
      sky: d.skys.length > 0 ? getMostFrequent(d.skys) : 1,
      pty: d.ptys.some(p => p > 0) ? d.ptys.find(p => p > 0) : 0,
      pop: d.pops.length > 0 ? Math.max(...d.pops) : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { hourly, daily };
};

// 중기예보 API
const getMidFcst = async () => {
  const now = new Date();
  const hour = now.getHours();
  let tmFc;

  if (hour < 6) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    tmFc = formatDate(yesterday) + '1800';
  } else if (hour < 18) {
    tmFc = formatDate(now) + '0600';
  } else {
    tmFc = formatDate(now) + '1800';
  }

  const url = buildKmaUrl('/1360000/MidFcstInfoService/getMidLandFcst', {
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    regId: DEFAULT_LOCATION.regIdLand,
    tmFc: tmFc
  });

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.response?.header?.resultCode !== '00') return null;

  const item = data.response.body.items.item[0];
  const result = [];

  const getWeatherIcon = (weather) => {
    if (!weather) return '☀️';
    if (weather.includes('비')) return '🌧️';
    if (weather.includes('눈')) return '❄️';
    if (weather.includes('흐림')) return '☁️';
    if (weather.includes('구름')) return '⛅';
    return '☀️';
  };

  for (let i = 3; i <= 10; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + i);

    const weather = item[`wf${i}Am`] || item[`wf${i}Pm`] || item[`wf${i}`];
    const pop = Math.max(
      parseInt(item[`rnSt${i}Am`]) || 0,
      parseInt(item[`rnSt${i}Pm`]) || 0,
      parseInt(item[`rnSt${i}`]) || 0
    );

    if (weather) {
      result.push({
        date: formatDate(targetDate),
        dayOffset: i,
        weather,
        pop,
        icon: getWeatherIcon(weather)
      });
    }
  }

  return result;
};

// 중기기온예보 API
const getMidTa = async () => {
  const now = new Date();
  const hour = now.getHours();
  let tmFc;

  if (hour < 6) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    tmFc = formatDate(yesterday) + '1800';
  } else if (hour < 18) {
    tmFc = formatDate(now) + '0600';
  } else {
    tmFc = formatDate(now) + '1800';
  }

  const url = buildKmaUrl('/1360000/MidFcstInfoService/getMidTa', {
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    regId: DEFAULT_LOCATION.regIdTemp,
    tmFc: tmFc
  });

  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.response?.header?.resultCode !== '00') return null;

  const item = data.response.body.items.item[0];
  const result = {};

  for (let i = 3; i <= 10; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + i);
    result[formatDate(targetDate)] = {
      minTemp: item[`taMin${i}`],
      maxTemp: item[`taMax${i}`]
    };
  }

  return result;
};

export default async function handler(req, res) {
  // Cron job 인증 확인 (Vercel 제공)
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('Cron 인증 실패');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('날씨 캐시 업데이트 시작...');

  try {
    // Supabase 클라이언트 생성 (서비스 키 사용)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 모든 API 병렬 호출
    const [current, forecast, midForecast, midTemp] = await Promise.all([
      getUltraSrtNcst(),
      getVilageFcst(),
      getMidFcst(),
      getMidTa()
    ]);

    // 중기예보 데이터 병합
    const midForecastMap = {};
    (midForecast || []).forEach(day => {
      const temp = midTemp?.[day.date];
      midForecastMap[day.date] = {
        ...day,
        minTemp: temp?.minTemp ?? null,
        maxTemp: temp?.maxTemp ?? null
      };
    });

    // 단기 + 중기 병합
    const dailyDates = new Set();
    const dailyWithMid = (forecast?.daily || []).map(day => {
      dailyDates.add(day.date);
      const midData = midForecastMap[day.date];
      if (midData) {
        return {
          ...day,
          weather: midData.weather,
          icon: midData.icon,
          pop: midData.pop > 0 ? midData.pop : day.pop,
          minTemp: midData.minTemp ?? day.minTemp,
          maxTemp: midData.maxTemp ?? day.maxTemp
        };
      }
      return day;
    });

    const midTermOnly = Object.values(midForecastMap)
      .filter(day => !dailyDates.has(day.date));

    const weatherData = {
      location: DEFAULT_LOCATION.name,
      current,
      shortTerm: forecast?.hourly || [],
      daily: dailyWithMid,
      midTerm: midTermOnly,
      updatedAt: new Date().toISOString()
    };

    // Supabase에 캐시 저장
    const { error } = await supabase
      .from('weather_cache')
      .upsert({
        location_key: 'default',
        data: weatherData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'location_key'
      });

    if (error) {
      console.error('캐시 저장 실패:', error);
      return res.status(500).json({ error: 'Failed to update cache', details: error });
    }

    console.log('날씨 캐시 업데이트 완료');
    return res.status(200).json({
      success: true,
      message: 'Weather cache updated',
      updatedAt: weatherData.updatedAt
    });

  } catch (error) {
    console.error('날씨 업데이트 오류:', error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}
