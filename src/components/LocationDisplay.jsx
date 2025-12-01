// 위치 정보 표시 컴포넌트
import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMapMarkerAlt, faEye, faEyeSlash, faCopy, faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
// import { formatGPSCoordinates } from '../utils/gpsExtractor';

// 임시로 함수를 직접 구현 (import 문제 해결용)
const formatGPSCoordinates = (gpsData) => {
  if (!gpsData || typeof gpsData.latitude !== 'number' || typeof gpsData.longitude !== 'number') {
    return '위치 정보 없음';
  }
  return `${gpsData.latitude.toFixed(6)}, ${gpsData.longitude.toFixed(6)}`;
};

const LocationDisplay = ({ post, showMap = true, compact = false }) => {
  const [showDetails, setShowDetails] = useState(false);
  
  // GPS 데이터 존재 여부 확인
  const hasLocation = post?.latitude && post?.longitude;
  
  if (!hasLocation) {
    return null;
  }

  const gpsData = {
    latitude: post.latitude,
    longitude: post.longitude,
    accuracy: post.location_accuracy,
    timestamp: post.location_timestamp,
    source: post.location_source
  };

  // 좌표를 클립보드에 복사
  const copyCoordinates = async () => {
    const coords = formatGPSCoordinates(gpsData);
    try {
      await navigator.clipboard.writeText(coords);
      // 간단한 피드백 (토스트 메시지는 별도 구현)
      console.log('좌표가 클립보드에 복사됨:', coords);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  };

  // 구글 맵에서 열기
  const openInGoogleMaps = () => {
    const url = `https://www.google.com/maps?q=${post.latitude},${post.longitude}`;
    window.open(url, '_blank');
  };

  // 네이버 지도에서 열기
  const openInNaverMaps = () => {
    const url = `https://map.naver.com/v5/search/${post.latitude},${post.longitude}`;
    window.open(url, '_blank');
  };

  // 카카오맵에서 열기
  const openInKakaoMaps = () => {
    const url = `https://map.kakao.com/link/map/${post.latitude},${post.longitude}`;
    window.open(url, '_blank');
  };

  if (compact) {
    // 간단한 버전 (게시물 목록용)
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center text-sm text-gray-600 hover:text-blue-600 transition-colors"
        title="위치 정보 보기"
      >
        <FontAwesomeIcon icon={faMapMarkerAlt} className="w-3 h-3 mr-1" />
        <span className="text-xs">위치</span>
        {showDetails && (
          <div className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-3 mt-2 min-w-48">
            <div className="text-xs text-gray-600 mb-2">
              📍 {formatGPSCoordinates(gpsData)}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={(e) => { e.stopPropagation(); openInGoogleMaps(); }}
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
              >
                구글맵
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); copyCoordinates(); }}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
              >
                복사
              </button>
            </div>
          </div>
        )}
      </button>
    );
  }

  // 상세 버전 (게시물 상세보기용)
  return (
    <div className="bg-gray-50 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <FontAwesomeIcon icon={faMapMarkerAlt} className="text-blue-500 w-5 h-5 mr-2" />
          <h4 className="font-semibold text-gray-800">위치 정보</h4>
        </div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-gray-500 hover:text-gray-700 transition-colors"
          title={showDetails ? "세부정보 숨기기" : "세부정보 보기"}
        >
          <FontAwesomeIcon icon={showDetails ? faEyeSlash : faEye} className="w-4 h-4" />
        </button>
      </div>

      <div className="text-sm text-gray-600 mb-3">
        📍 {formatGPSCoordinates(gpsData)}
        <button
          onClick={copyCoordinates}
          className="ml-2 text-blue-500 hover:text-blue-700 transition-colors"
          title="좌표 복사"
        >
          <FontAwesomeIcon icon={faCopy} className="w-3 h-3" />
        </button>
      </div>

      {showDetails && (
        <div className="space-y-3">
          {/* 상세 정보 */}
          <div className="text-xs text-gray-500 space-y-1">
            {gpsData.accuracy && (
              <div>정확도: ±{Math.round(gpsData.accuracy)}m</div>
            )}
            {gpsData.source && (
              <div>출처: {gpsData.source === 'exif' ? '사진 EXIF' : '브라우저 위치'}</div>
            )}
            {gpsData.timestamp && (
              <div>
                위치 기록: {new Date(gpsData.timestamp).toLocaleString('ko-KR')}
              </div>
            )}
          </div>

          {/* 지도 서비스 링크 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openInGoogleMaps}
              className="flex items-center text-xs bg-blue-500 text-white px-3 py-2 rounded-lg hover:bg-blue-600 transition-colors"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} className="w-3 h-3 mr-1" />
              구글맵
            </button>
            <button
              onClick={openInNaverMaps}
              className="flex items-center text-xs bg-green-500 text-white px-3 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} className="w-3 h-3 mr-1" />
              네이버지도
            </button>
            <button
              onClick={openInKakaoMaps}
              className="flex items-center text-xs bg-yellow-500 text-white px-3 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <FontAwesomeIcon icon={faExternalLinkAlt} className="w-3 h-3 mr-1" />
              카카오맵
            </button>
          </div>

          {/* 간단한 지도 표시 (옵션) */}
          {showMap && (
            <div className="mt-3">
              <div className="w-full h-48 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="w-8 h-8 mb-2" />
                  <div className="text-sm">지도 API 연동 예정</div>
                  <div className="text-xs">현재 위치: {formatGPSCoordinates(gpsData)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LocationDisplay;