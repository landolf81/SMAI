/* eslint-disable react/prop-types */
import React from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExternalLinkAlt, faNewspaper } from "@fortawesome/free-solid-svg-icons";
import { formatRelativeTime, getSourceIcon } from '../services/newsService';

/**
 * 뉴스 카드 컴포넌트
 * 커뮤니티 피드에 삽입되는 외부 뉴스 표시
 * 광고 카드와 유사한 인스타그램 스타일
 */
const NewsCard = ({ news }) => {
  if (!news) return null;

  const { title, link, pubDate, description, imageUrl, source } = news;

  const handleClick = () => {
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-full max-w-md mx-auto mb-6">
      {/* 인스타그램 스타일 뉴스 카드 */}
      <div
        className="bg-white rounded-xl overflow-hidden shadow-lg cursor-pointer"
        style={{
          boxShadow: '-4px 0 15px rgba(34, 197, 94, 0.3), 0 4px 15px rgba(0, 0, 0, 0.1)'
        }}
        onClick={handleClick}
      >
        {/* 뉴스 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faNewspaper} className="text-white text-xs" />
            </div>
            <span className="text-sm font-semibold text-gray-900">뉴스</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {getSourceIcon(source)} {source}
            </span>
          </div>
        </div>

        {/* 메인 이미지 (있으면) */}
        {imageUrl && (
          <div className="relative bg-gray-100 aspect-video">
            <img
              src={imageUrl}
              alt={title}
              className="w-full h-full object-cover"
              onError={(e) => {
                // 이미지 로드 실패 시 이미지 영역 숨김
                e.target.parentElement.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* 콘텐츠 영역 */}
        <div className="p-4">
          {/* 제목 */}
          <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 mb-2">
            {title}
          </h3>

          {/* 설명 */}
          {description && (
            <p className="text-sm text-gray-600 line-clamp-2 mb-3">
              {description}
            </p>
          )}

          {/* 하단: 시간 및 링크 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {formatRelativeTime(pubDate)}
            </span>
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              자세히 보기
              <FontAwesomeIcon icon={faExternalLinkAlt} className="text-xs" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsCard;
