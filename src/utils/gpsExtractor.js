// GPS 정보 추출 유틸리티 (exifr 라이브러리 사용)
import exifr from 'exifr';

/**
 * 이미지 파일에서 GPS 정보를 추출합니다
 * @param {File} file - 이미지 파일
 * @returns {Promise<Object|null>} GPS 정보 객체 또는 null
 */
export const extractGPSFromImage = async (file) => {
  try {
    if (!file) {
      console.log('GPS 추출: 파일이 없음');
      return null;
    }

    // 이미지 파일 타입 확인 (HEIC 포함)
    const isImage = file.type.startsWith('image/') ||
                    file.name.toLowerCase().endsWith('.heic') ||
                    file.name.toLowerCase().endsWith('.heif');

    if (!isImage) {
      console.log('GPS 추출: 이미지 파일이 아님');
      return null;
    }

    // exifr로 GPS 정보 추출
    const gps = await exifr.gps(file);

    if (!gps || gps.latitude === undefined || gps.longitude === undefined) {
      console.log('GPS 정보 없음');
      return null;
    }

    // 추가 EXIF 정보 추출 (촬영 시간 등)
    let dateTime = null;
    try {
      const exifData = await exifr.parse(file, ['DateTimeOriginal', 'DateTime', 'GPSAltitude', 'GPSAltitudeRef']);
      dateTime = exifData?.DateTimeOriginal || exifData?.DateTime;
    } catch (e) {
      console.warn('추가 EXIF 정보 추출 실패:', e);
    }

    const gpsData = {
      latitude: gps.latitude,
      longitude: gps.longitude,
      accuracy: null, // EXIF에서는 정확도 정보가 제한적
      timestamp: dateTime ? dateTime.toISOString() : new Date().toISOString(),
      source: 'exif'
    };

    // 고도 정보가 있으면 추가
    if (gps.altitude !== undefined) {
      gpsData.altitude = gps.altitude;
    }

    console.log('📍 GPS 정보 추출 성공:', gpsData);
    return gpsData;

  } catch (error) {
    console.error('GPS 정보 추출 에러:', error);
    return null;
  }
};

/**
 * 브라우저의 Geolocation API를 사용하여 현재 위치 가져오기
 * @returns {Promise<Object|null>} GPS 정보 객체 또는 null
 */
export const getCurrentLocation = () => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.log('Geolocation API 지원되지 않음');
      resolve(null);
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000 // 5분
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp: new Date().toISOString(),
          source: 'geolocation'
        };

        console.log('현재 위치 정보:', gpsData);
        resolve(gpsData);
      },
      (error) => {
        console.error('위치 정보 가져오기 실패:', error);
        resolve(null);
      },
      options
    );
  });
};

/**
 * GPS 좌표가 유효한지 검증
 * @param {Object} gpsData - GPS 데이터 객체
 * @returns {boolean} 유효성 여부
 */
export const isValidGPS = (gpsData) => {
  if (!gpsData || typeof gpsData !== 'object') {
    return false;
  }

  const { latitude, longitude } = gpsData;

  // 위도는 -90 ~ 90, 경도는 -180 ~ 180 범위
  const isValidLat = typeof latitude === 'number' && latitude >= -90 && latitude <= 90;
  const isValidLon = typeof longitude === 'number' && longitude >= -180 && longitude <= 180;

  return isValidLat && isValidLon;
};

/**
 * GPS 좌표를 읽기 쉬운 문자열로 변환
 * @param {Object} gpsData - GPS 데이터 객체
 * @returns {string} 포맷된 좌표 문자열
 */
export const formatGPSCoordinates = (gpsData) => {
  if (!isValidGPS(gpsData)) {
    return '위치 정보 없음';
  }

  const { latitude, longitude } = gpsData;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
};

/**
 * 두 GPS 좌표 간의 거리 계산 (하버사인 공식)
 * @param {Object} coord1 - 첫 번째 좌표
 * @param {Object} coord2 - 두 번째 좌표
 * @returns {number} 거리 (킬로미터)
 */
export const calculateDistance = (coord1, coord2) => {
  if (!isValidGPS(coord1) || !isValidGPS(coord2)) {
    return null;
  }

  const R = 6371; // 지구 반지름 (킬로미터)
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(coord1.latitude)) * Math.cos(toRad(coord2.latitude)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance;
};

const toRad = (value) => {
  return value * Math.PI / 180;
};

export default {
  extractGPSFromImage,
  getCurrentLocation,
  isValidGPS,
  formatGPSCoordinates,
  calculateDistance
};
