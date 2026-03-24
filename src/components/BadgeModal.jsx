/**
 * BadgeModal.jsx
 * 역할: 뱃지 상세 정보 모달 (클릭 시 표시)
 * 다크모드 지원, created_at 기반 인증일 표시
 */
import React, { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import { API_BASE_URL } from '../config/api';
import { badgeService } from '../services/badgeService';

const BadgeModal = ({ badge, isOpen, onClose }) => {
  const [badgeTypeInfo, setBadgeTypeInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  // badge_type을 기반으로 badge_types 테이블에서 상세 정보 조회
  useEffect(() => {
    const fetchBadgeTypeInfo = async () => {
      if (!isOpen || !badge) return;

      const badgeType = badge.badge_type || badge.type;
      if (!badgeType) return;

      setLoading(true);
      try {
        const typeInfo = await badgeService.getBadgeTypeInfo(badgeType);
        setBadgeTypeInfo(typeInfo);
      } catch (error) {
        console.error('뱃지 타입 정보 조회 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBadgeTypeInfo();
  }, [isOpen, badge]);

  if (!isOpen || !badge) return null;

  // badge_types 테이블에서 가져온 정보 우선 사용
  const displayData = {
    name: badgeTypeInfo?.name || badge.badge_name || badge.name,
    type: badgeTypeInfo?.type || badge.badge_type || badge.type,
    description: badgeTypeInfo?.description || badge.description,
    color: badgeTypeInfo?.color || badge.badge_color || badge.color || '#3B82F6',
    icon_type: badgeTypeInfo?.icon_type || badge.icon_type || 'color',
    icon_value: badgeTypeInfo?.icon_value || badge.icon_value,
    icon_url: badgeTypeInfo?.icon_url || badge.icon_url,
    icon_background: badgeTypeInfo?.icon_background || badge.icon_background || '#3B82F6'
  };

  // 인증일: verified_at → created_at 순서로 fallback
  const badgeDate = badge.verified_at || badge.created_at;

  const renderBadgeIcon = (size = 'large') => {
    const sizeClass = size === 'large' ? 'w-16 h-16 text-2xl' : 'w-8 h-8 text-base';

    switch (displayData.icon_type) {
      case 'image':
        const imgUrl = displayData.icon_url || displayData.icon_value;
        if (imgUrl) {
          const imageUrl = imgUrl.startsWith('/uploads/') ? `${API_BASE_URL}${imgUrl}` : imgUrl;
          return (
            <img
              src={imageUrl}
              alt={displayData.name}
              className={`${sizeClass} rounded object-contain`}
              onError={(e) => {
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
        if (displayData.icon_value) {
          return (
            <div
              className={`${sizeClass} rounded flex items-center justify-center font-medium`}
              style={{ backgroundColor: displayData.icon_background, color: 'white' }}
            >
              <span className="text-2xl">
                {displayData.icon_value}
              </span>
            </div>
          );
        }
        break;

      default: // 'color'
        return (
          <div
            className={`${sizeClass} rounded`}
            style={{ backgroundColor: displayData.color }}
          />
        );
    }

    // 기본 색상 원형
    return (
      <div
        className={`${sizeClass} rounded`}
        style={{ backgroundColor: displayData.color }}
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-base-100 rounded-lg max-w-md w-full p-6 relative animate-fade-in shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-base-content/40 hover:text-base-content/70 transition-colors"
        >
          <CloseIcon />
        </button>

        {/* 뱃지 정보 */}
        <div className="text-center">
          {/* 큰 아이콘 */}
          <div className="flex justify-center mb-4">
            {loading ? (
              <div className="w-16 h-16 rounded bg-base-300 animate-pulse" />
            ) : (
              renderBadgeIcon('large')
            )}
          </div>

          {/* 뱃지 이름 */}
          <h3 className="text-xl font-bold text-base-content mb-2">
            {displayData.name}
          </h3>

          {/* 추가 정보 */}
          <div className="bg-base-200/50 rounded-lg p-4 text-left">
            <div className="space-y-3 text-sm">
              {/* 타입 ID */}
              <div className="flex justify-between">
                <span className="text-base-content/50">타입:</span>
                <span className="font-medium text-primary">
                  {displayData.type || '-'}
                </span>
              </div>

              {/* 설명 */}
              <div className="pt-2 border-t border-base-300">
                <span className="text-base-content/50 block mb-1">설명:</span>
                <p className="text-base-content/70 leading-relaxed">
                  {displayData.description || '-'}
                </p>
              </div>

              {/* 인증일 (verified_at 또는 created_at) */}
              {badgeDate && (
                <div className="flex justify-between pt-2 border-t border-base-300">
                  <span className="text-base-content/50">인증일:</span>
                  <span className="font-medium text-base-content">
                    {new Date(badgeDate).toLocaleDateString('ko-KR')}
                  </span>
                </div>
              )}

              {badge.verified_by_name && (
                <div className="flex justify-between">
                  <span className="text-base-content/50">인증자:</span>
                  <span className="font-medium text-base-content">{badge.verified_by_name}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 확인 버튼 */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary text-primary-content rounded-lg hover:bg-primary-focus transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default BadgeModal;
