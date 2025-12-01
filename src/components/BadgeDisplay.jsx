import React, { useState } from 'react';
import BadgeModal from './BadgeModal';
import { API_BASE_URL } from '../config/api';

const BadgeDisplay = ({ 
  badge, 
  size = 'sm', 
  showText = false, // 기본값을 false로 변경 (아이콘만 표시)
  className = '',
  clickable = true // 클릭 가능 여부
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  // 크기 설정
  const sizeClasses = {
    xs: { container: 'h-4', icon: 'w-3 h-3 text-xs', text: 'text-xs px-1 py-0.5' },
    sm: { container: 'h-6', icon: 'w-4 h-4 text-sm', text: 'text-xs px-2 py-1' },
    md: { container: 'h-8', icon: 'w-6 h-6 text-base', text: 'text-sm px-3 py-1' },
    lg: { container: 'h-10', icon: 'w-8 h-8 text-lg', text: 'text-base px-4 py-2' },
    xl: { container: 'h-12', icon: 'w-10 h-10 text-xl', text: 'text-lg px-5 py-2' }
  };

  const sizes = sizeClasses[size] || sizeClasses.sm;

  // 뱃지가 없으면 렌더링하지 않음
  if (!badge) return null;

  const renderIcon = () => {
    const iconType = badge.icon_type || 'color';
    const iconValue = badge.icon_value;
    const iconUrl = badge.icon_url;
    const iconBackground = badge.icon_background || badge.badge_color || badge.color || '#3B82F6';

    switch (iconType) {
      case 'image':
        // iconUrl 또는 iconValue에서 이미지 URL 가져오기
        const imgUrl = iconUrl || iconValue;
        if (imgUrl) {
          const imageUrl = imgUrl.startsWith('/uploads/') ? `${API_BASE_URL}${imgUrl}` : imgUrl;
          return (
            <img
              src={imageUrl}
              alt={badge.badge_name || badge.name}
              className={`${sizes.icon} rounded object-contain`}
              onError={(e) => {
                console.error('❌ 이미지 로드 실패:', imageUrl);
                // 이미지 로드 실패 시 기본 색상으로 대체
                e.target.style.display = 'none';
                if (e.target.nextSibling) {
                  e.target.nextSibling.style.display = 'block';
                }
              }}
            />
          );
        }
        break;
        
      case 'icon':
        if (iconValue) {
          return (
            <div 
              className={`${sizes.icon} rounded flex items-center justify-center font-medium`}
              style={{ backgroundColor: iconBackground, color: 'white' }}
            >
              <span className={sizes.icon.includes('text-') ? '' : 'text-sm'}>
                {iconValue}
              </span>
            </div>
          );
        }
        break;
        
      default: // 'color'
        return (
          <div 
            className={`${sizes.icon} rounded`}
            style={{ backgroundColor: iconBackground }}
          />
        );
    }

    // 기본 색상 원형
    return (
      <div 
        className={`${sizes.icon} rounded`}
        style={{ backgroundColor: iconBackground }}
      />
    );
  };

  // 아이콘만 표시하는 경우 (기본값)
  if (!showText) {
    return (
      <>
        <div 
          className={`inline-flex items-center ${className} ${clickable ? 'cursor-pointer hover:scale-110 transition-transform' : ''}`}
          onClick={clickable ? () => setModalOpen(true) : undefined}
          title={badge.badge_name || badge.name}
        >
          {renderIcon()}
        </div>
        
        {clickable && (
          <BadgeModal 
            badge={badge}
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {renderIcon()}
      <span 
        className={`${sizes.text} rounded font-medium text-white inline-flex items-center ${sizes.container}`}
        style={{ backgroundColor: badge.badge_color || badge.color || '#3B82F6' }}
      >
        {badge.badge_name || badge.name}
      </span>
    </div>
  );
};

// 여러 뱃지를 나열하는 컴포넌트
export const BadgeList = ({ badges, size = 'sm', maxDisplay = 3, className = '' }) => {
  if (!badges || badges.length === 0) return null;

  const displayBadges = badges.slice(0, maxDisplay);
  const remainingCount = badges.length - maxDisplay;

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {displayBadges.map((badge, index) => (
        <BadgeDisplay 
          key={badge.id || index} 
          badge={badge} 
          size={size} 
        />
      ))}
      {remainingCount > 0 && (
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
          +{remainingCount}
        </span>
      )}
    </div>
  );
};

export default BadgeDisplay;