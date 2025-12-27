// 기상청 API 날씨 서비스
// 공공데이터포털 단기예보/중기예보 API 사용
// Supabase 캐시를 통한 빠른 로딩 지원

import { supabase } from '../config/supabase';

// 기상청 API 키 (이미 인코딩된 형태로 사용)
const KMA_API_KEY_RAW = import.meta.env.VITE_KMA_API_KEY;

// 캐시 설정
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1시간

// API 베이스 URL 생성 (serviceKey는 수동으로 추가해야 함 - 이중 인코딩 방지)
const buildKmaUrl = (apiPath, params) => {
  const isDev = import.meta.env.DEV;
  const baseUrl = isDev ? '/api/kma' : '';

  // serviceKey를 제외한 파라미터만 URLSearchParams로 처리
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (key !== 'serviceKey') {
      searchParams.append(key, value);
    }
  });

  // serviceKey는 이미 인코딩된 값을 직접 추가
  const encodedKey = encodeURIComponent(KMA_API_KEY_RAW);
  const queryString = `serviceKey=${encodedKey}&${searchParams.toString()}`;

  if (isDev) {
    return `${baseUrl}${apiPath}?${queryString}`;
  }
  // 프로덕션: Vercel serverless function
  const endpoint = `${apiPath}?${queryString}`;
  return `/api/weather?endpoint=${encodeURIComponent(endpoint)}`;
};

// 성주군 기상청 격자 좌표 (성주군 삼산리 측정지점 기준)
const DEFAULT_LOCATION = {
  name: '성주',
  nx: 83,  // 격자 X
  ny: 93,  // 격자 Y
  lat: 35.87,
  lng: 128.35,
  regIdLand: '11H10000', // 중기육상예보 지역코드 (경상북도)
  regIdTemp: '11H10701' // 중기기온 지역코드 (성주)
};

// 날씨 코드 → 아이콘/설명 매핑
const SKY_CODES = {
  1: { icon: '☀️', text: '맑음' },
  3: { icon: '⛅', text: '구름많음' },
  4: { icon: '☁️', text: '흐림' }
};

const PTY_CODES = {
  0: null, // 없음
  1: { icon: '🌧️', text: '비' },
  2: { icon: '🌨️', text: '비/눈' },
  3: { icon: '❄️', text: '눈' },
  4: { icon: '🌧️', text: '소나기' }
};

// 날짜 포맷 함수
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const formatTime = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  return `${hours}00`;
};

// 가장 최근 발표 시각 계산 (단기예보: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300)
const getLatestBaseTime = () => {
  const now = new Date();
  const hour = now.getHours();
  const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];

  // 현재 시각보다 이전의 가장 최근 발표 시각 찾기
  let baseTime = baseTimes[0];
  for (const time of baseTimes) {
    if (hour >= time + 1) { // 발표 후 1시간 여유
      baseTime = time;
    }
  }

  // 만약 00-02시 사이면 전날 23시 발표 사용
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

// 초단기실황 API 호출
const getUltraSrtNcst = async (nx = DEFAULT_LOCATION.nx, ny = DEFAULT_LOCATION.ny) => {
  const now = new Date();
  const baseDate = formatDate(now);
  // 초단기실황은 매시간 정각 발표, 40분 후 조회 가능
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
    nx: nx.toString(),
    ny: ny.toString()
  });

  try {
    const response = await fetch(url);

    // HTTP 에러 체크
    if (!response.ok) {
      console.warn('초단기실황 API 오류 (HTTP', response.status, ')');
      return null;
    }

    const data = await response.json();

    if (data.response?.header?.resultCode === '00') {
      return parseUltraSrtNcst(data.response.body.items.item);
    }
    console.warn('초단기실황 API 오류:', data.response?.header?.resultMsg);
    return null;
  } catch (error) {
    console.warn('초단기실황 API 호출 실패:', error.message);
    return null;
  }
};

// 초단기실황 데이터 파싱
const parseUltraSrtNcst = (items) => {
  const result = {};
  items.forEach(item => {
    result[item.category] = item.obsrValue;
  });

  return {
    temp: result.T1H ? Math.round(parseFloat(result.T1H)) : null, // 기온
    humidity: result.REH ? parseInt(result.REH) : null, // 습도
    precipitation: result.RN1 || '0', // 1시간 강수량
    pty: parseInt(result.PTY) || 0, // 강수형태
    windSpeed: result.WSD ? parseFloat(result.WSD) : null, // 풍속
    windDirection: result.VEC ? parseInt(result.VEC) : null // 풍향
  };
};

// TMN/TMX 전용 API 호출 (02시 발표 기준 - 오늘 최저/최고 기온 포함)
const getTodayMinMax = async (nx = DEFAULT_LOCATION.nx, ny = DEFAULT_LOCATION.ny) => {
  const now = new Date();
  const today = formatDate(now);

  const url = buildKmaUrl('/1360000/VilageFcstInfoService_2.0/getVilageFcst', {
    numOfRows: '300',
    pageNo: '1',
    dataType: 'JSON',
    base_date: today,
    base_time: '0200',
    nx: nx.toString(),
    ny: ny.toString()
  });

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.response?.header?.resultCode !== '00') return null;

    const items = data.response.body.items.item;
    const result = {};

    items.forEach(item => {
      const date = item.fcstDate;
      if (!result[date]) {
        result[date] = { tmn: null, tmx: null };
      }
      if (item.category === 'TMN') result[date].tmn = parseFloat(item.fcstValue);
      if (item.category === 'TMX') result[date].tmx = parseFloat(item.fcstValue);
    });

    return result;
  } catch {
    return null;
  }
};

// 단기예보 API 호출
const getVilageFcst = async (nx = DEFAULT_LOCATION.nx, ny = DEFAULT_LOCATION.ny) => {
  const { baseDate, baseTime } = getLatestBaseTime();

  const url = buildKmaUrl('/1360000/VilageFcstInfoService_2.0/getVilageFcst', {
    numOfRows: '1000',
    pageNo: '1',
    dataType: 'JSON',
    base_date: baseDate,
    base_time: baseTime,
    nx: nx.toString(),
    ny: ny.toString()
  });

  try {
    const response = await fetch(url);

    // HTTP 에러 체크
    if (!response.ok) {
      console.warn('단기예보 API 오류 (HTTP', response.status, ')');
      return null;
    }

    const data = await response.json();

    if (data.response?.header?.resultCode === '00') {
      // 02시 발표 기준 TMN/TMX 가져오기
      const minMaxData = await getTodayMinMax(nx, ny);
      return parseVilageFcst(data.response.body.items.item, minMaxData);
    }
    console.warn('단기예보 API 오류:', data.response?.header?.resultMsg);
    return null;
  } catch (error) {
    console.warn('단기예보 API 호출 실패:', error.message);
    return null;
  }
};

// 단기예보 데이터 파싱 (시간별/일별 정리)
const parseVilageFcst = (items, minMaxData = null) => {
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
      // 02시 발표 기준 TMN/TMX로 초기화
      const minMax = minMaxData?.[date];
      dailyMap[date] = {
        date,
        temps: [],
        skys: [],
        ptys: [],
        pops: [],
        tmn: minMax?.tmn ?? null,
        tmx: minMax?.tmx ?? null
      };
    }

    if (item.category === 'TMP') {
      dailyMap[date].temps.push(parseFloat(item.fcstValue));
    }
    if (item.category === 'SKY') {
      dailyMap[date].skys.push(parseInt(item.fcstValue));
    }
    if (item.category === 'PTY') {
      dailyMap[date].ptys.push(parseInt(item.fcstValue));
    }
    if (item.category === 'POP') {
      dailyMap[date].pops.push(parseInt(item.fcstValue));
    }
    // 현재 발표에 TMN/TMX가 있으면 덮어쓰기
    if (item.category === 'TMN') {
      dailyMap[date].tmn = parseFloat(item.fcstValue);
    }
    if (item.category === 'TMX') {
      dailyMap[date].tmx = parseFloat(item.fcstValue);
    }
  });

  // 시간별 예보 정리
  const hourly = Object.values(hourlyMap)
    .map(h => ({
      date: h.date,
      time: h.time,
      temp: h.TMP ? Math.round(parseFloat(h.TMP)) : null,
      sky: parseInt(h.SKY) || 1,
      pty: parseInt(h.PTY) || 0,
      pop: h.POP ? parseInt(h.POP) : 0, // 강수확률
      humidity: h.REH ? parseInt(h.REH) : null,
      windSpeed: h.WSD ? parseFloat(h.WSD) : null
    }))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  // 일별 예보 정리
  // TMN/TMX가 있으면 우선 사용, 없으면 시간별 기온에서 계산
  const daily = Object.values(dailyMap)
    .map(d => ({
      date: d.date,
      minTemp: d.tmn !== null ? Math.round(d.tmn) : (d.temps.length > 0 ? Math.round(Math.min(...d.temps)) : null),
      maxTemp: d.tmx !== null ? Math.round(d.tmx) : (d.temps.length > 0 ? Math.round(Math.max(...d.temps)) : null),
      // 가장 빈도 높은 하늘상태
      sky: d.skys.length > 0 ? getMostFrequent(d.skys) : 1,
      // 강수가 있으면 강수형태 우선
      pty: d.ptys.some(p => p > 0) ? d.ptys.find(p => p > 0) : 0,
      // 하루 중 최대 강수확률
      pop: d.pops.length > 0 ? Math.max(...d.pops) : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { hourly, daily };
};

// 가장 빈도 높은 값 찾기
const getMostFrequent = (arr) => {
  const counts = {};
  arr.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || arr[0];
};

// 중기예보 API 호출 (4-10일)
// 참고: 공공데이터포털에서 '기상청_중기예보 조회서비스' 활용신청 필요
const getMidFcst = async (regIdLand = DEFAULT_LOCATION.regIdLand) => {
  // 중기예보는 06시, 18시 발표
  const now = new Date();
  const hour = now.getHours();
  let tmFc;

  if (hour < 6) {
    // 전날 18시 발표
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    tmFc = formatDate(yesterday) + '1800';
  } else if (hour < 18) {
    // 오늘 06시 발표
    tmFc = formatDate(now) + '0600';
  } else {
    // 오늘 18시 발표
    tmFc = formatDate(now) + '1800';
  }

  const url = buildKmaUrl('/1360000/MidFcstInfoService/getMidLandFcst', {
    numOfRows: '10',
    pageNo: '1',
    dataType: 'JSON',
    regId: regIdLand,
    tmFc: tmFc
  });

  try {
    const response = await fetch(url);

    // 403 에러 등 HTTP 에러 체크
    if (!response.ok) {
      console.warn('중기예보 API 미승인 또는 오류 (공공데이터포털에서 활용신청 필요)');
      return null;
    }

    const data = await response.json();

    if (data.response?.header?.resultCode === '00') {
      return parseMidFcst(data.response.body.items.item[0]);
    }
    console.warn('중기예보 API 오류:', data.response?.header?.resultMsg);
    return null;
  } catch (error) {
    // 조용히 실패 처리 (단기예보만으로도 동작 가능)
    console.warn('중기예보 API 호출 실패 (활용신청 필요):', error.message);
    return null;
  }
};

// 중기예보 데이터 파싱
const parseMidFcst = (item) => {
  const result = [];
  const now = new Date();

  for (let i = 3; i <= 10; i++) {  // 3일 후부터 (단기예보와 병합)
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + i);

    const dayStr = `${i}`;
    const amKey = `wf${dayStr}Am`;
    const pmKey = `wf${dayStr}Pm`;
    const rnAmKey = `rnSt${dayStr}Am`;
    const rnPmKey = `rnSt${dayStr}Pm`;

    const weather = item[amKey] || item[pmKey] || item[`wf${dayStr}`];
    const pop = Math.max(
      parseInt(item[rnAmKey]) || 0,
      parseInt(item[rnPmKey]) || 0,
      parseInt(item[`rnSt${dayStr}`]) || 0
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

// 중기기온예보 API 호출
const getMidTa = async (regIdTemp = DEFAULT_LOCATION.regIdTemp) => {
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
    regId: regIdTemp,
    tmFc: tmFc
  });

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('중기기온 API 오류');
      return null;
    }
    const data = await response.json();
    if (data.response?.header?.resultCode === '00') {
      return parseMidTa(data.response.body.items.item[0]);
    }
    return null;
  } catch (error) {
    console.warn('중기기온 API 호출 실패:', error.message);
    return null;
  }
};

// 중기기온 데이터 파싱
const parseMidTa = (item) => {
  const result = {};
  const now = new Date();

  for (let i = 3; i <= 10; i++) {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + i);
    const dateStr = formatDate(targetDate);

    result[dateStr] = {
      minTemp: item[`taMin${i}`],
      maxTemp: item[`taMax${i}`]
    };
  }

  return result;
};

// 날씨 텍스트에서 아이콘 추출
const getWeatherIcon = (weatherText) => {
  if (!weatherText) return '☀️';
  if (weatherText.includes('비')) return '🌧️';
  if (weatherText.includes('눈')) return '❄️';
  if (weatherText.includes('흐림')) return '☁️';
  if (weatherText.includes('구름')) return '⛅';
  return '☀️';
};

// 날씨 아이콘 가져오기 (하늘상태 + 강수형태)
const getWeatherIconFromCode = (sky, pty) => {
  if (pty > 0 && PTY_CODES[pty]) {
    return PTY_CODES[pty];
  }
  return SKY_CODES[sky] || SKY_CODES[1];
};

// 위도/경도 → 격자 좌표 변환
const convertToGrid = (lat, lng) => {
  const RE = 6371.00877; // 지구 반경(km)
  const GRID = 5.0; // 격자 간격(km)
  const SLAT1 = 30.0; // 투영 위도1(degree)
  const SLAT2 = 60.0; // 투영 위도2(degree)
  const OLON = 126.0; // 기준점 경도(degree)
  const OLAT = 38.0; // 기준점 위도(degree)
  const XO = 43; // 기준점 X좌표(GRID)
  const YO = 136; // 기준점 Y좌표(GRID)

  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = re * sf / Math.pow(ro, sn);

  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = re * sf / Math.pow(ra, sn);
  let theta = lng * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);

  return { nx, ny };
};

// 현재 위치 가져오기
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation을 지원하지 않는 브라우저입니다.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const grid = convertToGrid(latitude, longitude);
        resolve({
          lat: latitude,
          lng: longitude,
          nx: grid.nx,
          ny: grid.ny
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000 // 5분 캐시
      }
    );
  });
};

// 로컬 스토리지에 위치 저장/불러오기
const saveLocation = (location) => {
  try {
    localStorage.setItem('weather_location', JSON.stringify({
      ...location,
      savedAt: Date.now()
    }));
  } catch (e) {
    console.warn('위치 저장 실패:', e);
  }
};

const getSavedLocation = () => {
  try {
    const saved = localStorage.getItem('weather_location');
    if (saved) {
      const data = JSON.parse(saved);
      // 24시간 이내 저장된 위치만 유효
      if (Date.now() - data.savedAt < 24 * 60 * 60 * 1000) {
        return data;
      }
    }
  } catch (e) {
    console.warn('저장된 위치 불러오기 실패:', e);
  }
  return null;
};

// 캐시에서 날씨 데이터 가져오기
const getCachedWeather = async (locationKey) => {
  try {
    const { data, error } = await supabase
      .from('weather_cache')
      .select('data, updated_at')
      .eq('location_key', locationKey)
      .single();

    if (error || !data) return null;

    // 캐시 유효성 검사 (1시간 이내)
    const updatedAt = new Date(data.updated_at);
    const now = new Date();
    if (now - updatedAt > CACHE_DURATION_MS) {
      return null; // 캐시 만료
    }

    return data.data;
  } catch (e) {
    console.warn('캐시 조회 실패:', e);
    return null;
  }
};

// 캐시에 날씨 데이터 저장
const setCachedWeather = async (locationKey, weatherData) => {
  try {
    const { error } = await supabase
      .from('weather_cache')
      .upsert({
        location_key: locationKey,
        data: weatherData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'location_key'
      });

    if (error) {
      console.warn('캐시 저장 실패:', error);
    }
  } catch (e) {
    console.warn('캐시 저장 중 오류:', e);
  }
};

// 기상청 API에서 직접 날씨 데이터 가져오기 (캐시 우회)
const fetchWeatherFromApi = async (location) => {
  const [current, forecast, midForecast, midTemp] = await Promise.all([
    getUltraSrtNcst(location.nx, location.ny),
    getVilageFcst(location.nx, location.ny),
    getMidFcst(),
    getMidTa()
  ]);

  // 중기예보 데이터를 날짜별 맵으로 변환
  const midForecastMap = {};
  (midForecast || []).forEach(day => {
    const temp = midTemp?.[day.date];
    midForecastMap[day.date] = {
      ...day,
      minTemp: temp?.minTemp ?? null,
      maxTemp: temp?.maxTemp ?? null
    };
  });

  // 단기예보에 중기예보 정보 병합 (겹치는 날짜는 중기 정보 우선)
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

  // 중기예보 중 단기예보에 없는 날짜만 추가
  const midTermOnly = Object.values(midForecastMap)
    .filter(day => !dailyDates.has(day.date));

  return {
    location: location.name || '현재 위치',
    current,
    shortTerm: forecast?.hourly || [],
    daily: dailyWithMid,
    midTerm: midTermOnly,
    updatedAt: new Date().toISOString()
  };
};

// 통합 날씨 데이터 가져오기 (캐시 우선)
const getWeatherData = async () => {
  const locationKey = 'default';

  // 1. 캐시에서 먼저 조회
  const cachedData = await getCachedWeather(locationKey);
  if (cachedData) {
    console.log('캐시된 날씨 데이터 사용');
    return cachedData;
  }

  // 2. 캐시가 없거나 만료된 경우 API 호출
  console.log('기상청 API에서 날씨 데이터 가져오는 중...');
  const weatherData = await fetchWeatherFromApi(DEFAULT_LOCATION);

  // 3. 결과를 캐시에 저장 (백그라운드)
  setCachedWeather(locationKey, weatherData);

  return weatherData;
};

export const weatherService = {
  getWeatherData,
  getWeatherIconFromCode,
  DEFAULT_LOCATION,
  SKY_CODES,
  PTY_CODES
};

export default weatherService;
