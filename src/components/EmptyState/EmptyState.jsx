import React from 'react';
import SearchIcon from '@mui/icons-material/Search';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoIcon from '@mui/icons-material/Info';
import AssignmentIcon from '@mui/icons-material/Assignment';
import StoreIcon from '@mui/icons-material/Store';
import NotificationsIcon from '@mui/icons-material/Notifications';
import FavoriteIcon from '@mui/icons-material/Favorite';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

const EmptyState = ({
  type = 'default',
  title,
  description,
  actionText,
  onAction,
  secondaryActionText,
  onSecondaryAction,
  showImage = true,
  customIcon,
  size = 'md'
}) => {
  // 타입별 기본 설정
  const getTypeConfig = () => {
    switch (type) {
      case 'no-data':
        return {
          icon: <img src="/images/AS_110.png" alt="데이터 없음" className="mx-auto" style={{ width: size === 'lg' ? '120px' : '100px', height: 'auto' }} />,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          titleColor: 'text-gray-500',
          descColor: 'text-gray-400',
          defaultTitle: '데이터가 없습니다',
          defaultDesc: '현재 표시할 정보가 없습니다.'
        };
      
      case 'error':
        return {
          icon: <ErrorOutlineIcon className="text-red-300" style={{ fontSize: size === 'lg' ? '4rem' : '3rem' }} />,
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          titleColor: 'text-red-800',
          descColor: 'text-red-600',
          defaultTitle: '오류가 발생했습니다',
          defaultDesc: '데이터를 불러올 수 없습니다.'
        };
      
      case 'no-markets':
        return {
          icon: <StoreIcon className="text-yellow-300" style={{ fontSize: size === 'lg' ? '4rem' : '3rem' }} />,
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          titleColor: 'text-yellow-800',
          descColor: 'text-yellow-600',
          defaultTitle: '운영 중인 시장이 없습니다',
          defaultDesc: '선택한 날짜에 거래가 진행된 시장이 없습니다.'
        };
      
      case 'no-prices':
        return {
          icon: <img src="/images/AS_110.png" alt="경락가 정보 없음" className="mx-auto" style={{ width: size === 'lg' ? '120px' : '100px', height: 'auto' }} />,
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          titleColor: 'text-blue-800',
          descColor: 'text-blue-600',
          defaultTitle: '경락가 정보가 없습니다',
          defaultDesc: '선택한 조건의 가격 정보가 없습니다.'
        };
      
      case 'no-favorites':
        return {
          icon: <FavoriteIcon className="text-pink-300" style={{ fontSize: size === 'lg' ? '4rem' : '3rem' }} />,
          bgColor: 'bg-pink-50',
          borderColor: 'border-pink-200',
          titleColor: 'text-pink-800',
          descColor: 'text-pink-600',
          defaultTitle: '관심 목록이 비어있습니다',
          defaultDesc: '자주 확인하는 시장을 추가해보세요.'
        };
      
      case 'no-alerts':
        return {
          icon: <NotificationsIcon className="text-purple-300" style={{ fontSize: size === 'lg' ? '4rem' : '3rem' }} />,
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          titleColor: 'text-purple-800',
          descColor: 'text-purple-600',
          defaultTitle: '설정된 알림이 없습니다',
          defaultDesc: '가격 알림을 설정해보세요.'
        };
      
      case 'network-error':
        return {
          icon: <ErrorOutlineIcon className="text-orange-300" style={{ fontSize: size === 'lg' ? '4rem' : '3rem' }} />,
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          titleColor: 'text-orange-800',
          descColor: 'text-orange-600',
          defaultTitle: '네트워크 연결 오류',
          defaultDesc: '인터넷 연결을 확인해주세요.'
        };
      
      default:
        return {
          icon: <InfoIcon className="text-gray-300" style={{ fontSize: size === 'lg' ? '4rem' : '3rem' }} />,
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          titleColor: 'text-gray-500',
          descColor: 'text-gray-400',
          defaultTitle: '정보가 없습니다',
          defaultDesc: '현재 표시할 내용이 없습니다.'
        };
    }
  };

  const config = getTypeConfig();
  const containerSize = size === 'lg' ? 'py-16' : size === 'sm' ? 'py-8' : 'py-12';
  const maxWidth = size === 'lg' ? 'max-w-lg' : size === 'sm' ? 'max-w-sm' : 'max-w-md';

  return (
    <div className={`text-center ${containerSize}`}>
      <div className={`${config.bgColor} ${config.borderColor} border rounded-lg p-6 ${maxWidth} mx-auto`}>
        {/* 아이콘 또는 이미지 */}
        {showImage && (
          <div className="mb-4">
            {customIcon || config.icon}
          </div>
        )}
        
        {/* 제목 */}
        <h3 className={`text-lg font-semibold ${config.titleColor} mb-2`}>
          {title || config.defaultTitle}
        </h3>
        
        {/* 설명 */}
        <p className={`${config.descColor} text-sm mb-4`}>
          {description || config.defaultDesc}
        </p>
        
        {/* 액션 버튼들 */}
        {(actionText || secondaryActionText) && (
          <div className="space-y-2">
            {actionText && onAction && (
              <button 
                onClick={onAction}
                className="btn btn-primary w-full"
              >
                {actionText}
              </button>
            )}
            
            {secondaryActionText && onSecondaryAction && (
              <button 
                onClick={onSecondaryAction}
                className="btn btn-outline w-full"
              >
                {secondaryActionText}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState;