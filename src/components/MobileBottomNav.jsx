import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { dmService } from '../services';

// Material UI Icons
import HomeIcon from '@mui/icons-material/Home';
import TranslateIcon from '@mui/icons-material/Translate';
import ForumIcon from '@mui/icons-material/Forum';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import PersonIcon from '@mui/icons-material/Person';

const MobileBottomNav = ({ scrollDirection }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [isDMOpen, setIsDMOpen] = useState(false);

  // 읽지 않은 DM 수 조회
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => dmService.getUnreadCount(),
    enabled: !!currentUser,
    refetchInterval: 10000, // 10초마다 새로고침
  });

  // DM 창 열림 상태 감지
  useEffect(() => {
    const checkDMOpen = () => {
      setIsDMOpen(document.body.hasAttribute('data-dm-open'));
    };

    // 초기 체크
    checkDMOpen();

    // MutationObserver로 body 속성 변경 감지
    const observer = new MutationObserver(checkDMOpen);
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-dm-open'] });

    return () => observer.disconnect();
  }, []);

  // 커뮤니티 모드 감지
  const isCommunityMode = ['/community', '/qna', '/secondhand'].includes(location.pathname);

  // 일반 모드 버튼 구성 (4개, 텍스트+아이콘)
  const normalModeButtons = [
    {
      id: 'home',
      path: '/',
      label: '홈',
      icon: HomeIcon,
      showLabel: true,
      activeColor: 'text-market-600'
    },
    {
      id: 'translate',
      path: '/translate',
      label: '번역',
      icon: TranslateIcon,
      showLabel: true,
      activeColor: 'text-indigo-600'
    },
    {
      id: 'community',
      path: '/community',
      label: '커뮤니티',
      icon: ForumIcon,
      showLabel: true,
      activeColor: 'text-[#FFC425]'
    },
    {
      id: 'profile',
      path: currentUser ? `/profile/${currentUser.id}` : '/login',
      label: currentUser ? '프로필' : '로그인',
      icon: PersonIcon,
      showLabel: true,
      isProfile: true,
      activeColor: 'text-purple-600'
    }
  ];

  // 커뮤니티 모드 버튼 구성 (5개, 홈/프로필만 아이콘)
  const communityModeButtons = [
    {
      id: 'home',
      path: '/',
      label: '홈',
      icon: HomeIcon,
      showLabel: false,  // 아이콘만 표시
      activeColor: 'text-market-600'
    },
    {
      id: 'community',
      path: '/community',
      label: '커뮤니티',
      icon: ForumIcon,
      showLabel: true,
      activeColor: 'text-[#FFC425]'
    },
    {
      id: 'qna',
      path: '/qna',
      label: 'Q&A',
      icon: HelpOutlineIcon,
      showLabel: true,
      activeColor: 'text-blue-600'
    },
    {
      id: 'secondhand',
      path: '/secondhand',
      label: '사고팔고',
      icon: ShoppingBagIcon,
      showLabel: true,
      activeColor: 'text-green-600'
    },
    {
      id: 'profile',
      path: currentUser ? `/profile/${currentUser.id}` : '/login',
      label: currentUser ? '프로필' : '로그인',
      icon: PersonIcon,
      showLabel: false,  // 아이콘만 표시
      isProfile: true,
      activeColor: 'text-purple-600'
    }
  ];

  // 현재 모드에 맞는 버튼 선택
  const buttons = isCommunityMode ? communityModeButtons : normalModeButtons;

  // 버튼 클릭 핸들러
  const handleButtonClick = (button) => {
    navigate(button.path);
  };

  // 활성 버튼 감지
  const isActiveButton = (button) => {
    if (button.id === 'home') {
      return location.pathname === '/';
    }
    if (button.isProfile) {
      return location.pathname.startsWith('/profile');
    }
    return location.pathname === button.path;
  };

  // DM이 열려있으면 하단 메뉴 숨기기
  if (isDMOpen) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-150 will-change-transform lg:hidden ${
        scrollDirection === 'down' ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div className="bg-white/90 backdrop-blur-md border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16 max-w-screen-xl mx-auto px-2">
          {buttons.map((button) => {
            const IconComponent = button.icon;
            const isActive = isActiveButton(button);

            return (
              <button
                key={button.id}
                onClick={() => handleButtonClick(button)}
                className={`flex flex-col items-center justify-center transition-all duration-200 ${
                  button.showLabel ? 'px-3 py-2 flex-1' : 'px-4 py-2'
                } ${
                  isActive
                    ? `${button.activeColor} transform -translate-y-1`
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                aria-label={button.label}
              >
                <div className={`relative p-2 rounded-full transition-all duration-200 ${
                  isActive ? 'bg-gray-100 shadow-sm' : ''
                }`}>
                  <IconComponent
                    fontSize={button.showLabel ? 'small' : 'medium'}
                    className={isActive ? 'text-lg' : 'text-base'}
                  />

                  {/* 프로필 아이콘에 읽지 않은 DM 뱃지 */}
                  {button.isProfile && unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </div>

                {/* 텍스트 라벨 (showLabel이 true일 때만) */}
                {button.showLabel && (
                  <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {button.label}
                  </span>
                )}

                {/* 활성 인디케이터 */}
                {isActive && (
                  <div className={`w-1 h-1 rounded-full mt-1 ${button.activeColor.replace('text-', 'bg-')}`}></div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MobileBottomNav;
