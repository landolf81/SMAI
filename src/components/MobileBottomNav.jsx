import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AuthContext } from '../context/AuthContext';
import { dmService, postService } from '../services';
import loungeService from '../services/loungeService';

// 인라인 SVG 아이콘 (MUI vendor-ui 청크 초기 로드 방지)
const GroupsIcon = ({ fontSize, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24}>
    <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85-.85-.37-1.79-.58-2.78-.58-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
  </svg>
);
const ForumIcon = ({ fontSize, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24}>
    <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z"/>
  </svg>
);
const HelpOutlineIcon = ({ fontSize, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24}>
    <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
  </svg>
);
const ShoppingBagIcon = ({ fontSize, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24}>
    <path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z"/>
  </svg>
);
const PersonIcon = ({ fontSize, className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width={fontSize === 'small' ? 20 : 24} height={fontSize === 'small' ? 20 : 24}>
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

// 커스텀 홈 아이콘 (참외이야기 로고)
const HomeIcon = ({ className, isActive }) => (
  <svg
    viewBox="0 0 603 603"
    className={className}
    style={{ width: '1.5em', height: '1.5em' }}
  >
    <path
      fill={isActive ? '#FFC600' : 'currentColor'}
      d="M244.290436,75.239487 C252.886993,63.511154 262.616913,53.377750 274.065704,44.989346 C279.606689,40.929539 285.361969,37.150543 291.134369,33.421131 C299.447601,28.050156 308.217834,28.916512 315.645630,34.267563 C328.032593,43.191265 340.660553,52.185947 351.346313,62.973999 C368.960571,80.756836 381.545166,101.980858 389.455475,126.052498 C394.490234,141.373611 397.028259,156.778534 396.095703,172.763504 C395.231476,187.577011 389.499084,200.692047 380.910919,212.576630 C364.679504,235.038239 342.611816,250.268478 318.562439,263.251465 C305.849579,270.114471 294.252808,268.267670 282.917542,260.994415 C271.769653,253.841431 260.484619,246.781708 250.050949,238.664108 C233.991821,226.169785 221.109085,210.654541 213.808121,191.525757 C210.489624,182.831146 208.974976,173.130722 208.469955,163.787735 C208.114609,157.213928 210.821640,150.469101 212.198181,143.808273 C215.532028,127.676514 221.087082,112.310135 229.194016,98.004791 C233.615173,90.203339 239.055939,82.979713 244.290436,75.239487 z"
    />
    <path
      fill={isActive ? '#FFC600' : 'currentColor'}
      d="M283.558685,380.711365 C289.228638,397.095398 291.630981,413.668915 293.312683,430.530609 C296.384247,461.327240 287.493042,488.332733 268.997955,512.402649 C255.954742,529.377441 239.506073,542.363953 220.455734,552.431641 C201.964172,562.204102 182.674225,568.820557 161.922501,570.808350 C152.187561,571.740784 142.221069,572.692505 132.584213,571.618713 C119.425156,570.152466 114.163429,566.377625 110.326286,549.999573 C108.022087,540.164551 107.230362,529.942993 106.213890,519.849243 C105.469513,512.457520 104.804214,504.951111 105.252472,497.565521 C106.729553,473.228821 111.042572,449.342773 122.523460,427.609833 C127.899689,417.432831 135.211792,408.125427 142.567627,399.181427 C155.057587,383.994781 171.827286,374.707001 189.859604,367.627991 C194.394943,365.847504 199.228394,364.808380 203.951981,363.528778 C219.956039,359.193329 236.203842,358.875671 252.543365,360.881287 C257.872620,361.535461 263.310699,362.126648 268.402374,363.704071 C276.486542,366.208588 280.227905,373.140869 283.558685,380.711365 z"
    />
    <path
      fill={isActive ? '#FFC600' : 'currentColor'}
      d="M324.497742,490.615265 C313.962677,470.503998 311.452301,449.153412 313.354309,427.421417 C314.686035,412.204773 316.689270,396.993561 321.790070,382.264862 C326.381927,369.005615 334.929047,362.406494 348.548035,360.819061 C369.791229,358.342926 390.737518,360.066132 411.062286,366.107086 C428.010498,371.144470 443.236420,379.906952 456.665649,391.735138 C472.867310,406.005249 484.039856,423.614105 490.862549,443.770569 C494.443085,454.348663 496.602295,465.585876 497.932434,476.701447 C499.498291,489.787109 500.382446,503.097900 499.885712,516.247742 C499.356964,530.245300 497.897308,544.307556 492.851959,557.716614 C489.227081,567.350586 481.961334,571.207642 472.468719,571.859497 C443.171448,573.871338 415.467285,567.541931 389.273193,554.760986 C375.493683,548.037598 363.128326,539.103699 351.996155,528.356079 C341.141296,517.876160 332.430817,505.965790 325.251282,492.815857 C324.945892,492.256531 324.887451,491.562378 324.497742,490.615265 z"
    />
    <path
      fill={isActive ? '#FFC600' : 'currentColor'}
      d="M538.031616,193.884827 C553.526428,199.285187 568.767029,204.260757 583.605896,210.234283 C590.989014,213.206406 597.691589,218.511917 597.921265,227.393417 C598.100952,234.340118 597.013184,241.512772 595.294861,248.282028 C587.757019,277.976288 570.895996,302.069855 548.270325,322.034576 C528.341309,339.619812 505.234100,351.764404 479.171295,357.863861 C465.899414,360.969910 452.817871,359.489685 439.973969,355.734619 C413.547272,348.008514 388.346436,337.529236 365.426514,321.971283 C358.667816,317.383453 353.330566,311.993744 351.578644,303.721375 C349.979980,296.172852 352.827942,289.424561 355.750122,282.886505 C363.663940,265.180145 373.291992,248.345840 384.942413,232.886322 C396.975616,216.918900 412.768982,205.391754 431.825592,198.969986 C443.079163,195.177734 454.455811,190.783707 466.104736,189.381012 C480.106689,187.694992 494.492004,188.275330 508.644135,189.070221 C518.359253,189.615906 527.959900,192.199295 538.031616,193.884827 z"
    />
    <path
      fill={isActive ? '#FFC600' : 'currentColor'}
      d="M154.851532,191.915527 C167.904556,195.590240 180.223236,199.963211 191.511734,206.917313 C206.962433,216.435486 219.203293,229.077820 228.477188,244.598785 C234.787506,255.159821 241.225403,265.671051 246.918457,276.564026 C250.060135,282.575256 253.036942,289.170013 253.870605,295.781311 C255.368286,307.658447 248.386948,315.569153 238.971909,322.076752 C223.220383,332.964081 206.462616,341.810028 188.440903,348.129517 C177.863480,351.838654 167.090424,355.089233 156.232376,357.870789 C145.289047,360.674286 134.145218,359.116913 123.473885,356.394257 C104.966400,351.672424 87.478317,344.355865 71.773438,333.153656 C41.130760,311.296326 20.263838,282.571808 10.407367,246.115982 C9.218539,241.718903 8.503045,237.116058 8.220072,232.568024 C7.627115,223.037857 12.021523,216.149414 20.452303,211.845642 C39.637691,202.051880 59.738914,194.760269 80.957870,190.994492 C91.212608,189.174545 101.645798,187.729355 112.032433,187.466263 C121.806419,187.218658 131.638931,188.609177 141.418488,189.559219 C145.790863,189.983978 150.096680,191.094101 154.851532,191.915527 z"
    />
  </svg>
);

const MobileBottomNav = ({ scrollDirection }) => {
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isDMOpen, setIsDMOpen] = useState(false);

  // 읽지 않은 DM 수 조회
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => dmService.getUnreadCount(),
    enabled: !!currentUser,
    refetchInterval: 10000, // 10초마다 새로고침
  });

  // 광장 새 글 여부 (30초 폴링)
  const { data: hasNewLounge = false } = useQuery({
    queryKey: ['loungeBadge'],
    queryFn: () => {
      const lastVisited = localStorage.getItem('lounge_last_visited');
      if (!lastVisited) return false;
      return loungeService.hasNewMessagesSince(lastVisited);
    },
    enabled: !!currentUser,
    refetchInterval: 30000,
    staleTime: 25000,
  });

  // 커뮤 새 글 여부 (30초 폴링)
  const { data: hasNewCommunity = false } = useQuery({
    queryKey: ['communityBadge'],
    queryFn: () => {
      const lastVisited = localStorage.getItem('community_last_visited');
      if (!lastVisited) return false;
      return postService.hasNewPostsSince(lastVisited);
    },
    enabled: !!currentUser,
    refetchInterval: 30000,
    staleTime: 25000,
  });

  // 첫 접속 사용자: 방문 시각 초기화 (뱃지 안 뜨게)
  useEffect(() => {
    if (!currentUser) return;
    if (!localStorage.getItem('lounge_last_visited')) {
      localStorage.setItem('lounge_last_visited', new Date().toISOString());
    }
    if (!localStorage.getItem('community_last_visited')) {
      localStorage.setItem('community_last_visited', new Date().toISOString());
    }
  }, [currentUser]);

  // 현재 해당 페이지에 있으면 방문 시각 자동 갱신 + 뱃지 제거
  useEffect(() => {
    if (!currentUser) return;
    if (location.pathname === '/lounge') {
      localStorage.setItem('lounge_last_visited', new Date().toISOString());
      queryClient.setQueryData(['loungeBadge'], false);
    } else if (location.pathname === '/community') {
      localStorage.setItem('community_last_visited', new Date().toISOString());
      queryClient.setQueryData(['communityBadge'], false);
    }
  }, [location.pathname, currentUser, queryClient]);

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

  // 메뉴 버튼 구성 (5개, 아이콘+한글명)
  // 노랑 → 청색 그라데이션 단색 배치
  const buttons = [
    {
      id: 'home',
      path: '/',
      label: '홈',
      icon: HomeIcon,
      showLabel: true,
      activeColor: 'text-[#FFC600]' // 노랑
    },
    {
      id: 'lounge',
      path: '/lounge',
      label: '광장',
      icon: GroupsIcon,
      showLabel: true,
      activeColor: 'text-[#FF7043]', // 주황
      hasNewContent: hasNewLounge,
      hideIndicator: true
    },
    {
      id: 'community',
      path: '/community',
      label: '커뮤',
      icon: ForumIcon,
      showLabel: true,
      activeColor: 'text-[#26A69A]', // 청록
      hasNewContent: hasNewCommunity
    },
    {
      id: 'qna',
      path: '/qna',
      label: '정보',
      icon: HelpOutlineIcon,
      showLabel: true,
      activeColor: 'text-[#42A5F5]', // 하늘
      hideIndicator: true
    },
    {
      id: 'profile',
      path: currentUser ? `/profile/${currentUser.id}` : '/login',
      label: currentUser ? '프로필' : '로그인',
      icon: PersonIcon,
      showLabel: true,
      isProfile: true,
      activeColor: 'text-[#1976D2]' // 청색
    }
  ];

  // 사고팔고 메뉴 (비활성화 - 차후 적용)
  // {
  //   id: 'secondhand',
  //   path: '/secondhand',
  //   label: '사고팔고',
  //   icon: ShoppingBagIcon,
  //   showLabel: true,
  //   activeColor: 'text-green-600'
  // },

  // 버튼 클릭 핸들러
  const handleButtonClick = (button) => {
    // 광장/커뮤 탭 클릭 시 방문 시각 갱신 + 뱃지 즉시 제거
    if (button.id === 'lounge') {
      localStorage.setItem('lounge_last_visited', new Date().toISOString());
      queryClient.setQueryData(['loungeBadge'], false);
    } else if (button.id === 'community') {
      localStorage.setItem('community_last_visited', new Date().toISOString());
      queryClient.setQueryData(['communityBadge'], false);
    }
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
    // 번역 페이지는 정보 탭으로 이동했으므로 정보 탭 active 처리
    if (button.id === 'qna') {
      return location.pathname.startsWith('/qna') || location.pathname === '/translate';
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
      <div className="bg-base-100/90 backdrop-blur-md border-t border-base-300 safe-area-bottom">
        <div className="flex items-center justify-around h-20 max-w-screen-xl mx-auto px-2">
          {buttons.map((button) => {
            const IconComponent = button.icon;
            const isActive = isActiveButton(button);

            return (
              <button
                key={button.id}
                data-onboarding={button.id === 'lounge' ? 'lounge' : undefined}
                onClick={() => handleButtonClick(button)}
                className={`flex flex-col items-center justify-center transition-colors duration-200 ${
                  button.showLabel ? 'px-3 py-2 flex-1' : 'px-4 py-2'
                } ${
                  isActive
                    ? `${button.activeColor} -translate-y-1`
                    : 'text-base-content/60 hover:text-base-content'
                }`}
                aria-label={button.label}
              >
                <div className={`relative p-2 rounded-full transition-colors duration-200 ${
                  isActive ? 'bg-base-content/5' : ''
                }`}>
                  {button.id === 'home' ? (
                    <IconComponent
                      className={isActive ? 'text-lg' : 'text-base'}
                      isActive={isActive}
                    />
                  ) : (
                    <IconComponent
                      fontSize={button.showLabel ? 'small' : 'medium'}
                      className={isActive ? 'text-lg' : 'text-base'}
                    />
                  )}

                  {/* 프로필 아이콘에 읽지 않은 DM 뱃지 */}
                  {button.isProfile && unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}

                  {/* 광장/커뮤 새 콘텐츠 점 뱃지 */}
                  {button.hasNewContent && !isActive && (
                    <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full" />
                  )}
                </div>

                {/* 텍스트 라벨 (showLabel이 true일 때만) */}
                {button.showLabel && (
                  <span className={`text-xs mt-1 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {button.label}
                  </span>
                )}

                {/* 활성 인디케이터 */}
                {isActive && !button.hideIndicator && (
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
