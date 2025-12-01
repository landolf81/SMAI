import React, { useState, useEffect } from 'react';
import { getDomainName } from '../utils/linkDetector';
import { fetchLinkPreviewWithCache } from '../services/linkPreviewService';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import LinkIcon from '@mui/icons-material/Link';

/**
 * 일반 링크 프리뷰 컴포넌트
 * YouTube가 아닌 일반 웹사이트 링크를 카드 형태로 표시
 * Open Graph 메타데이터를 가져와서 이미지, 제목, 설명 표시
 */
const LinkPreview = ({ url, className = '' }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const domain = getDomainName(url);
  const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;

  useEffect(() => {
    if (!url) return;

    const loadPreview = async () => {
      try {
        setLoading(true);
        const data = await fetchLinkPreviewWithCache(url);
        if (data) {
          setPreview(data);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('링크 미리보기 로드 실패:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadPreview();
  }, [url]);

  const handleClick = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  if (!url) return null;

  // 로딩 중
  if (loading) {
    return (
      <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 animate-pulse ${className}`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-16 h-16 bg-gray-200 rounded-lg"></div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  // 에러 또는 메타데이터 없음 - 간단한 링크 표시
  if (error || !preview) {
    return (
      <div
        onClick={handleClick}
        className={`bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 hover:border-orange-400 transition-all duration-200 cursor-pointer ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <LinkIcon className="text-orange-600" fontSize="medium" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {domain || 'External Link'}
              </span>
              <OpenInNewIcon fontSize="small" className="text-gray-400 flex-shrink-0" />
            </div>
            <div className="text-xs text-gray-500 truncate">{displayUrl}</div>
            <div className="text-xs text-orange-600 mt-2">클릭하여 링크 열기</div>
          </div>
        </div>
      </div>
    );
  }

  // 메타데이터가 있는 경우 - 풍부한 미리보기 표시
  return (
    <div
      onClick={handleClick}
      className={`bg-white border border-gray-200 rounded-lg overflow-hidden hover:border-orange-400 hover:shadow-md transition-all duration-200 cursor-pointer ${className}`}
    >
      {/* 이미지 섹션 */}
      {preview.image && (
        <div className="relative w-full bg-gray-100" style={{ aspectRatio: '2/1' }}>
          <img
            src={preview.image}
            alt={preview.title || domain}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* 정보 섹션 */}
      <div className="p-4">
        {/* 사이트명 및 도메인 */}
        <div className="flex items-center gap-2 mb-2">
          {preview.favicon && (
            <img
              src={preview.favicon}
              alt=""
              className="w-4 h-4"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          )}
          <span className="text-xs text-gray-500 truncate">
            {preview.siteName || domain}
          </span>
          <OpenInNewIcon fontSize="small" className="text-gray-400 flex-shrink-0 ml-auto" />
        </div>

        {/* 제목 */}
        {preview.title && (
          <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2">
            {preview.title}
          </h3>
        )}

        {/* 설명 */}
        {preview.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {preview.description}
          </p>
        )}

        {/* URL */}
        <div className="text-xs text-gray-400 truncate mt-2">
          {displayUrl}
        </div>
      </div>
    </div>
  );
};

export default LinkPreview;
