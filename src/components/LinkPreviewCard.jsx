import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt, faTimes, faLink, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { getDomainName } from '../utils/linkDetector';
import { fetchLinkPreviewWithCache } from '../services/linkPreviewService';

/**
 * 일반 링크 미리보기 카드 컴포넌트
 * OG 태그를 파싱하여 제목, 설명, 이미지를 표시합니다.
 */
const LinkPreviewCard = ({
  url,
  previewData = null,  // 이미 가져온 OG 데이터 (있으면 fetch 안 함)
  onRemove = null,     // 제거 버튼 클릭 핸들러 (편집 모드)
  className = '',
  compact = false,     // 컴팩트 모드 (피드에서 사용)
}) => {
  const [preview, setPreview] = useState(previewData);
  const [loading, setLoading] = useState(!previewData && !!url);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (previewData) {
      setPreview(previewData);
      setLoading(false);
      return;
    }

    if (!url) {
      setPreview(null);
      setLoading(false);
      return;
    }

    const loadPreview = async () => {
      setLoading(true);
      setError(false);

      try {
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
  }, [url, previewData]);

  // 로딩 중
  if (loading) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 border border-gray-200 ${className}`}>
        <div className="flex items-center gap-3 text-gray-500">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
          <span className="text-sm">링크 미리보기 로딩 중...</span>
        </div>
      </div>
    );
  }

  // 에러 또는 미리보기 없음 - 간단한 링크만 표시
  if (error || !preview) {
    if (!url) return null;

    return (
      <div className={`bg-gray-50 rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 hover:bg-gray-100 transition-colors"
        >
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <FontAwesomeIcon icon={faLink} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-blue-600 truncate">{url}</p>
            <p className="text-xs text-gray-500">{getDomainName(url)}</p>
          </div>
          <FontAwesomeIcon icon={faExternalLinkAlt} className="text-gray-400 text-sm" />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-2 right-2 w-6 h-6 bg-gray-800/60 hover:bg-gray-800/80 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} className="text-xs" />
          </button>
        )}
      </div>
    );
  }

  const domain = preview.siteName || getDomainName(url);

  // 컴팩트 모드 (피드용)
  if (compact) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`block bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:bg-gray-100 transition-colors ${className}`}
      >
        <div className="flex">
          {preview.image && (
            <div className="w-24 h-24 flex-shrink-0">
              <img
                src={preview.image}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="flex-1 p-3 min-w-0">
            <p className="text-xs text-gray-500 mb-1">{domain}</p>
            {preview.title && (
              <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                {preview.title}
              </p>
            )}
            {preview.description && (
              <p className="text-xs text-gray-600 line-clamp-2">
                {preview.description}
              </p>
            )}
          </div>
        </div>
      </a>
    );
  }

  // 일반 모드 (에디터용)
  return (
    <div className={`relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm ${className}`}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block hover:bg-gray-50 transition-colors"
      >
        {preview.image && (
          <div className="w-full h-40 bg-gray-100">
            <img
              src={preview.image}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.parentElement.style.display = 'none';
              }}
            />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 uppercase tracking-wide">{domain}</span>
            <FontAwesomeIcon icon={faExternalLinkAlt} className="text-gray-400 text-xs" />
          </div>
          {preview.title && (
            <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">
              {preview.title}
            </h3>
          )}
          {preview.description && (
            <p className="text-sm text-gray-600 line-clamp-3">
              {preview.description}
            </p>
          )}
        </div>
      </a>

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 w-7 h-7 bg-gray-800/60 hover:bg-gray-800/80 rounded-full flex items-center justify-center text-white transition-colors z-10"
        >
          <FontAwesomeIcon icon={faTimes} className="text-sm" />
        </button>
      )}
    </div>
  );
};

LinkPreviewCard.propTypes = {
  url: PropTypes.string,
  previewData: PropTypes.shape({
    title: PropTypes.string,
    description: PropTypes.string,
    image: PropTypes.string,
    siteName: PropTypes.string,
    url: PropTypes.string,
  }),
  onRemove: PropTypes.func,
  className: PropTypes.string,
  compact: PropTypes.bool,
};

export default LinkPreviewCard;
