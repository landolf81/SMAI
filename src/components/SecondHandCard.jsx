import React from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import 'moment/locale/ko';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { API_BASE_URL } from '../config/api';

moment.locale('ko');

const SecondHandCard = ({ post }) => {
  const navigate = useNavigate();

  // 판매 상태 확인 (sold = 판매완료)
  // tradeInfo.status 또는 trade_status 둘 다 지원
  const tradeStatus = post.tradeInfo?.status || post.trade_status || 'available';
  const isSold = tradeStatus === 'sold';

  // 제목에서 가격 추출 시도 (예: "트랙터 500만원", "경운기 150")
  const extractPrice = (title, desc) => {
    const text = title + ' ' + (desc || '');
    const pricePatterns = [
      /(\d{1,3}(?:,\d{3})*)\s*만원/,
      /(\d{1,3}(?:,\d{3})*)\s*만/,
      /(\d{1,3}(?:,\d{3})*)\s*원/,
    ];

    for (const pattern of pricePatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  };

  // 내용에서 지역 추출 시도
  const extractLocation = (desc) => {
    if (!desc) return null;

    const locationPatterns = [
      /📍\s*([가-힣]+(?:시|군|구)?\s*[가-힣]*)/,
      /위치[:\s]*([가-힣]+(?:시|군|구)?\s*[가-힣]*)/,
      /지역[:\s]*([가-힣]+(?:시|군|구)?\s*[가-힣]*)/,
      /(성주|고령|칠곡|구미|대구|김천|상주)(?:시|군)?/,
    ];

    for (const pattern of locationPatterns) {
      const match = desc.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }
    return null;
  };

  // 제목과 내용에서 가격/위치 정보 추출
  const title = post.title || post.name || '';
  const description = post.desc || post.description || '';

  const price = extractPrice(title, description);
  const location = extractLocation(description) || (post.username ? post.username.split(' ')[0] : null);

  // 이미지 URL 처리 (다중 이미지 지원)
  const getImageUrls = () => {
    if (!post.img) return [];

    // JSON 배열 파싱 시도
    try {
      const parsed = JSON.parse(post.img);
      if (Array.isArray(parsed)) {
        return parsed.map(url => url.startsWith('http') ? url : `${API_BASE_URL}${url}`);
      }
    } catch {
      // JSON이 아니면 단일 URL로 처리
      const url = post.img;
      return [url.startsWith('http') ? url : `${API_BASE_URL}${url}`];
    }
    return [];
  };

  const imageUrls = getImageUrls();
  const imageUrl = imageUrls[0] || null;  // 카드에는 첫 번째 이미지만 표시

  return (
    <div
      onClick={() => navigate(`/post/${post.id}`)}
      className={`bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border ${
        isSold
          ? 'border-gray-300 opacity-75'
          : 'border-gray-100 hover:border-orange-300'
      }`}
    >
      {/* 이미지 섹션 */}
      <div className={`relative aspect-square bg-gray-100 ${isSold ? 'grayscale' : ''}`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={post.name || post.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%239ca3af"%3E이미지 없음%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
            <div className="text-center text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs">사진 없음</span>
            </div>
          </div>
        )}

        {/* 좌측 상단 판매 상태 배지 */}
        <div className="absolute top-2 left-2">
          {isSold ? (
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
              <span className="text-xs font-bold text-white">판매완료</span>
            </div>
          ) : (
            <div className="bg-orange-500/90 backdrop-blur-sm rounded-full px-3 py-1 shadow-sm">
              <span className="text-xs font-bold text-white">판매중</span>
            </div>
          )}
        </div>

        {/* 우측 상단 배지들 */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
          {/* 이미지 개수 배지 */}
          {imageUrls.length > 1 && (
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1 shadow-sm">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-medium text-white">{imageUrls.length}</span>
            </div>
          )}
        </div>
      </div>

      {/* 정보 섹션 */}
      <div className="p-3">
        {/* 제목 */}
        {title && (
          <h3 className="text-gray-900 font-semibold text-base line-clamp-2 mb-2 min-h-[2.5rem]">
            {title}
          </h3>
        )}

        {/* 가격 */}
        {price && (
          <div className="text-orange-600 font-bold text-base mb-1">
            {price}
          </div>
        )}

        {/* 위치 및 시간 */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          {location && (
            <div className="flex items-center gap-1">
              <LocationOnIcon fontSize="inherit" />
              <span className="line-clamp-1">{location}</span>
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <AccessTimeIcon fontSize="inherit" />
            <span>{moment(post.createdAt).fromNow()}</span>
          </div>
        </div>

        {/* 조회수 */}
        {post.views > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <VisibilityIcon fontSize="inherit" />
            <span>{post.views}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SecondHandCard;
