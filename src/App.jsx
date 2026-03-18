import React, { Suspense, lazy, useContext, useEffect, useState } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { Toaster } from 'react-hot-toast';
import './App.css';

// Components (항상 필요한 것들은 즉시 로드)
import Navbar from './components/Navbar';
import Leftbar from './components/Leftbar';
import MobileBottomNav from './components/MobileBottomNav';
import OnboardingTooltip from './components/OnboardingTooltip';
import MarketTrendTooltip from './components/MarketTrendTooltip';
import LoadingSpinner from './components/LoadingSpinner';
import { AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { isMobileDevice, isTabletDevice } from './utils/deviceDetector';
import { useScrollDirection } from './hooks/useScrollDirection';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

// 인라인 SVG 아이콘 (MUI vendor-ui 청크 초기 로드 방지)
const SearchIconSvg = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
);
const HelpOutlineIconSvg = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/>
  </svg>
);
const EditIconSvg = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
  </svg>
);
const PolicyIconSvg = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
    <path d="M21 5l-9-4-9 4v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5zm-9 4c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm4 8H8v-1c0-1.33 2.67-2 4-2s4 .67 4 2v1z"/>
  </svg>
);

// 로딩 컴포넌트
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <LoadingSpinner size="lg" />
  </div>
);

// Pages - Lazy Loading
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/register'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const Home = lazy(() => import('./pages/home'));
const Profile = lazy(() => import('./pages/profile'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PostEditor = lazy(() => import('./pages/PostEditor'));
const Translate = lazy(() => import('./pages/Translate'));
const Lounge = lazy(() => import('./pages/Lounge'));
const MarketLanding = lazy(() => import('./pages/MarketLanding'));
const MarketTrend = lazy(() => import('./pages/MarketTrend'));

// Admin Pages - Lazy Loading
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPosts = lazy(() => import('./pages/admin/AdminPosts'));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminAds = lazy(() => import('./pages/admin/AdminAds'));
const AdAnalytics = lazy(() => import('./pages/admin/AdAnalytics'));
const AdRevenue = lazy(() => import('./pages/admin/AdRevenue'));
const AdminTags = lazy(() => import('./pages/admin/AdminTags'));
const AdminTagGroups = lazy(() => import('./pages/admin/AdminTagGroups'));
const AdminBadgesNew = lazy(() => import('./pages/admin/AdminBadgesNew'));
const AdminReports = lazy(() => import('./pages/AdminReports'));
const AdminMarketSettings = lazy(() => import('./pages/admin/AdminMarketSettings'));
const AdminAuctionTimes = lazy(() => import('./pages/admin/AdminAuctionTimes'));
const AdminMarketInfo = lazy(() => import('./pages/admin/AdminMarketInfo'));
const AdminVerification = lazy(() => import('./pages/admin/AdminVerification'));
const AdminYouTube = lazy(() => import('./pages/admin/AdminYouTube'));
const AdminPushNotifications = lazy(() => import('./pages/admin/AdminPushNotifications'));
const AdminDM = lazy(() => import('./pages/admin/AdminDM'));

// Other Pages - Lazy Loading
const Prices = lazy(() => import('./pages/Prices'));
const FavoritePrices = lazy(() => import('./pages/FavoritePrices'));
const Community = lazy(() => import('./pages/Community'));
const Favorites = lazy(() => import('./pages/Favorites'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Settings = lazy(() => import('./pages/Settings'));
const QnA = lazy(() => import('./pages/QnA'));
const QnAEditor = lazy(() => import('./pages/QnAEditor'));
const QnADetail = lazy(() => import('./components/QnADetail'));
const SecondHand = lazy(() => import('./pages/SecondHand'));
const SecondHandEditor = lazy(() => import('./pages/SecondHandEditor'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Terms = lazy(() => import('./pages/Terms'));
const FAQ = lazy(() => import('./pages/FAQ'));
const TradingPolicy = lazy(() => import('./pages/TradingPolicy'));
const PCLanding = lazy(() => import('./pages/PCLanding'));
const DMChatPage = lazy(() => import('./pages/DMChatPage'));
const Notifications = lazy(() => import('./pages/Notifications'));

// QueryClient는 컴포넌트 외부에서 1회만 생성 (App 리렌더 시 캐시 유지)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5분 캐시
      gcTime: 10 * 60 * 1000,          // 10분 가비지 컬렉션
      refetchOnWindowFocus: false,     // 포커스 시 재조회 방지
      refetchOnMount: false,           // 마운트 시 불필요한 재조회 방지
      retry: 1,                        // 실패 시 1회만 재시도
    },
  },
});

/**
 * Layout - 모듈 스코프에 정의하여 App 리렌더 시 재생성 방지
 * AuthContext는 useContext로 직접 접근
 */
// 앱 셸 스켈레톤 (Auth 로딩 중 빠른 FCP 제공)
const AppSkeleton = () => (
  <div className="min-h-screen bg-base-200">
    {/* Navbar skeleton */}
    <div className="fixed top-0 left-0 right-0 z-50 h-16 bg-base-100 border-b border-base-300">
      <div className="flex items-center justify-between h-full px-4 max-w-screen-xl mx-auto">
        <div className="w-8 h-8 bg-base-300 rounded-full animate-pulse" />
        <div className="w-24 h-6 bg-base-300 rounded animate-pulse" />
        <div className="w-8 h-8 bg-base-300 rounded-full animate-pulse" />
      </div>
    </div>
    {/* Content skeleton */}
    <div className="pt-20 px-4 max-w-2xl mx-auto space-y-4">
      <div className="h-40 bg-base-300 rounded-2xl animate-pulse" />
      <div className="h-32 bg-base-300 rounded-2xl animate-pulse" />
      <div className="h-32 bg-base-300 rounded-2xl animate-pulse" />
    </div>
  </div>
);

const Layout = () => {
  const { currentUser, loading, isBanned } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scrollDirection = useScrollDirection();

  // 글쓰기 버튼 상태 (훅은 early return 전에 호출해야 함)
  const [isButtonSpinning, setIsButtonSpinning] = useState(false);
  const [showWriteMenu, setShowWriteMenu] = useState(false);

  // 커뮤니티 관련 페이지인지 확인
  const isCommunityPage = ['/community', '/qna', '/secondhand'].includes(location.pathname) ||
                          location.pathname.startsWith('/community/') ||
                          location.pathname.startsWith('/qna/') ||
                          location.pathname.startsWith('/secondhand/');

  // 현재 탭 가져오기
  const getCurrentTab = () => {
    if (location.pathname === '/community' || location.pathname.startsWith('/community/')) {
      return 'community';
    }
    if (location.pathname === '/qna' || location.pathname.startsWith('/qna/')) {
      return 'qna';
    }
    if (location.pathname === '/secondhand' || location.pathname.startsWith('/secondhand/')) {
      return 'secondhand';
    }
    return 'community';
  };

  const currentTab = getCurrentTab();

  // 탭별 색상 정의
  const tabColors = {
    community: {
      gradient: 'linear-gradient(135deg, #047857 0%, #06b6d4 100%)',
      shadow: '0 4px 15px rgba(4, 120, 87, 0.4), 0 8px 25px rgba(6, 182, 212, 0.3)'
    },
    qna: {
      gradient: 'linear-gradient(135deg, #FFCC00 0%, #06b6d4 100%)',
      shadow: '0 4px 15px rgba(255, 204, 0, 0.4), 0 8px 25px rgba(6, 182, 212, 0.3)'
    },
    secondhand: {
      gradient: 'linear-gradient(135deg, #f97316 0%, #06b6d4 100%)',
      shadow: '0 4px 15px rgba(249, 115, 22, 0.4), 0 8px 25px rgba(6, 182, 212, 0.3)'
    }
  };

  // 글쓰기 버튼 클릭 핸들러
  const handleWriteButtonClick = () => {
    setIsButtonSpinning(true);

    if (currentTab === 'community') {
      // 커뮤니티는 바로 글쓰기 페이지로 이동
      setTimeout(() => {
        navigate('/post/new');
        setIsButtonSpinning(false);
      }, 300);
    } else {
      // QnA, 사고팔고는 메뉴 모달 토글
      setTimeout(() => {
        setShowWriteMenu(prev => !prev);
        setIsButtonSpinning(false);
      }, 300);
    }
  };

  // 메뉴 모달 닫기
  const closeWriteMenu = () => {
    setShowWriteMenu(false);
  };

  // close-floating-menu 이벤트 리스너
  useEffect(() => {
    const handleCloseFloatingMenu = () => {
      setShowWriteMenu(false);
    };

    window.addEventListener('close-floating-menu', handleCloseFloatingMenu);
    return () => window.removeEventListener('close-floating-menu', handleCloseFloatingMenu);
  }, []);

  // 앱 포커스 시 PWA 뱃지 클리어
  useEffect(() => {
    const clearBadge = () => {
      if (document.visibilityState === 'visible') {
        navigator.clearAppBadge?.().catch(() => {});
      }
    };
    navigator.clearAppBadge?.().catch(() => {});
    document.addEventListener('visibilitychange', clearBadge);
    return () => document.removeEventListener('visibilitychange', clearBadge);
  }, []);

  // --- 모든 훅 호출 완료 후 early return ---

  // Auth 로딩 중에는 스켈레톤 표시 (빈 화면 방지)
  if (loading) {
    return <AppSkeleton />;
  }

  const isAdminPage = location.pathname.startsWith('/admin');
  const isDMPage = location.pathname.startsWith('/dm/');

  // DM 페이지는 전체 화면으로 렌더링 (Navbar, Leftbar, BottomNav 숨김)
  if (isDMPage) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* 상단 Navbar - 반투명 레이어 */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-150 will-change-transform ${
        scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'
      }`}>
        <Navbar />
      </div>

      <div className="flex">
        {/* PC 좌측 사이드바 - 로그인 상태에서만 표시 */}
        {currentUser && (
          <div className="hidden lg:block w-80 flex-shrink-0 pt-16">
            <Leftbar />
          </div>
        )}

        {/* 메인 콘텐츠 - 전체 화면 (pt-0) */}
        <div className="flex-1 min-w-0">
          <div className="max-w-none mx-auto">
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </div>

      </div>

      {/* 플로팅 글쓰기 버튼 + 팝업 메뉴 */}
      {isCommunityPage && currentUser && !isBanned && (isMobileDevice() || isTabletDevice() || window.innerWidth <= 768) && (
        <div className={`fixed right-4 z-40 transition-all duration-300 ${
          scrollDirection === 'down' ? 'bottom-4' : 'bottom-20'
        }`}>
          {/* 팝업 메뉴 (버튼 위에 표시) */}
          {showWriteMenu && (
            <>
              {/* 배경 오버레이 */}
              <div
                className="fixed inset-0 bg-black/30 -z-10"
                onClick={closeWriteMenu}
              />

              {/* 메뉴 아이템들 */}
              <div className="absolute bottom-20 right-0 flex flex-col items-end gap-3 mb-2">
                {currentTab === 'qna' ? (
                  <>
                    {/* 질문하기 */}
                    <button
                      onClick={() => {
                        closeWriteMenu();
                        navigate('/qna/ask');
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-base-100 rounded-full shadow-lg border border-base-300 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.1s' }}
                    >
                      <span className="text-sm font-medium text-base-content whitespace-nowrap">질문하기</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                        <EditIconSvg className="text-white w-5 h-5" />
                      </div>
                    </button>

                    {/* FAQ */}
                    <button
                      onClick={() => {
                        closeWriteMenu();
                        navigate('/faq');
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-base-100 rounded-full shadow-lg border border-base-300 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.05s' }}
                    >
                      <span className="text-sm font-medium text-base-content whitespace-nowrap">FAQ</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 flex items-center justify-center">
                        <HelpOutlineIconSvg className="text-amber-600 w-5 h-5" />
                      </div>
                    </button>

                    {/* 검색 */}
                    <button
                      onClick={() => {
                        // QnAList로 검색 모드 진입 이벤트 발송 (메뉴는 검색창 확장 후 자동으로 닫힘)
                        window.dispatchEvent(new CustomEvent('qna-search-open'));
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-base-100 rounded-full shadow-lg border border-base-300 hover:scale-105 transition-transform animate-fade-in-up"
                    >
                      <span className="text-sm font-medium text-base-content whitespace-nowrap">검색</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-cyan-200 flex items-center justify-center">
                        <SearchIconSvg className="text-blue-600 w-5 h-5" />
                      </div>
                    </button>
                  </>
                ) : (
                  <>
                    {/* 글쓰기 (인증된 사용자만) */}
                    <button
                      onClick={() => {
                        closeWriteMenu();
                        if (currentUser?.is_verified || currentUser?.verified) {
                          navigate('/secondhand/new');
                        } else {
                          alert('인증된 사용자만 사고팔고 게시글을 작성할 수 있습니다.');
                        }
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-base-100 rounded-full shadow-lg border border-base-300 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.1s' }}
                    >
                      <span className="text-sm font-medium text-base-content whitespace-nowrap">글쓰기</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                        <EditIconSvg className="text-white w-5 h-5" />
                      </div>
                    </button>

                    {/* 검색 */}
                    <button
                      onClick={() => {
                        // SecondHand 페이지로 검색 모드 진입 이벤트 발송 (메뉴는 검색창 확장 후 자동으로 닫힘)
                        window.dispatchEvent(new CustomEvent('secondhand-search-open'));
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-base-100 rounded-full shadow-lg border border-base-300 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.05s' }}
                    >
                      <span className="text-sm font-medium text-base-content whitespace-nowrap">검색</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-cyan-200 flex items-center justify-center">
                        <SearchIconSvg className="text-blue-600 w-5 h-5" />
                      </div>
                    </button>

                    {/* 거래 정책 */}
                    <button
                      onClick={() => {
                        closeWriteMenu();
                        navigate('/trading-policy');
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-base-100 rounded-full shadow-lg border border-base-300 hover:scale-105 transition-transform animate-fade-in-up"
                    >
                      <span className="text-sm font-medium text-base-content whitespace-nowrap">거래 정책</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-violet-200 flex items-center justify-center">
                        <PolicyIconSvg className="text-purple-600 w-5 h-5" />
                      </div>
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* 메인 플로팅 버튼 */}
          <button
            onClick={handleWriteButtonClick}
            className={`w-14 h-14 text-white rounded-full transition-all duration-300 flex items-center justify-center border-2 border-white shadow-lg ${
              showWriteMenu ? 'scale-110' : 'scale-100'
            }`}
            style={{
              background: tabColors[currentTab]?.gradient || tabColors.community.gradient,
              boxShadow: tabColors[currentTab]?.shadow || tabColors.community.shadow
            }}
            title="글쓰기"
          >
            <svg
              className="w-7 h-7 transition-transform duration-300"
              style={{ transform: showWriteMenu ? 'rotate(45deg)' : (isButtonSpinning ? 'rotate(180deg)' : 'rotate(0deg)') }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>
        </div>
      )}

      {/* 모바일/태블릿용 하단 네비게이션 - 스크롤 방향에 따라 숨김/표시 */}
      {(isMobileDevice() || isTabletDevice() || window.innerWidth <= 768) && (
        <MobileBottomNav scrollDirection={scrollDirection} />
      )}

      {/* 최초 접속자 안내 툴팁 */}
      <OnboardingTooltip />
      <MarketTrendTooltip />
    </div>
  );
};

/**
 * ProtectedRoute - 로그인 필요 라우트 가드
 * 모듈 스코프 정의 (App 리렌더 시 재생성 방지)
 */
// eslint-disable-next-line react/prop-types
const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useContext(AuthContext);
  if (loading) return <PageLoader />;
  if (currentUser === null) {
    return <Navigate to="/login" />;
  }
  return children;
};

/**
 * BannedRestrictedRoute - 차단된 사용자 접근 제한 (글쓰기, 사고팔고 등)
 * 모듈 스코프 정의 (App 리렌더 시 재생성 방지)
 */
// eslint-disable-next-line react/prop-types
const BannedRestrictedRoute = ({ children }) => {
  const { currentUser, loading, isBanned } = useContext(AuthContext);
  if (loading) return <PageLoader />;
  if (currentUser === null) {
    return <Navigate to="/login" />;
  }
  if (isBanned) {
    return <Navigate to="/community" state={{ banned: true }} />;
  }
  return children;
};

/**
 * SecondHandGuard - 사고팔고 페이지 차단 사용자 리다이렉트
 * isBanned 체크를 라우트 정의가 아닌 컴포넌트 내부에서 수행
 */
const SecondHandGuard = () => {
  const { isBanned } = useContext(AuthContext);
  if (isBanned) {
    return <Navigate to="/community" state={{ banned: true }} />;
  }
  return <SecondHand />;
};

/**
 * Router - 모듈 스코프에서 1회만 생성
 * App 리렌더 시에도 라우트 트리가 유지되어 컴포넌트 remount 방지
 */
const router = createBrowserRouter(
  [
  {
    path: '/',
    element: <Layout />,
    children: [
      // 공개 페이지들 (로그인 불필요 - 누구나 볼 수 있음)
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/prices',
        element: <Prices />,
      },
      {
        path: '/favorite-prices',
        element: <ProtectedRoute><FavoritePrices /></ProtectedRoute>,
      },
      {
        path: '/market-landing',
        element: <MarketLanding />,
      },
      {
        path: '/market-trend',
        element: <MarketTrend />,
      },
      {
        path: '/translate',
        element: <Translate />,
      },
      {
        path: '/lounge',
        element: <Lounge />,
      },
      // 게시판 페이지들 (읽기는 누구나, 글쓰기/댓글은 각 페이지에서 로그인 체크)
      {
        path: '/community',
        element: <Community />,
      },
      {
        path: '/qna',
        element: <QnA />,
      },
      {
        path: '/faq',
        element: <FAQ />,
      },
      {
        path: '/trading-policy',
        element: <TradingPolicy />,
      },
      {
        path: '/secondhand',
        element: <SecondHandGuard />,
      },
      {
        path: '/secondhand/new',
        element: <BannedRestrictedRoute><SecondHandEditor /></BannedRestrictedRoute>,
      },
      {
        path: '/secondhand/edit/:id',
        element: <BannedRestrictedRoute><SecondHandEditor /></BannedRestrictedRoute>,
      },
      {
        path: '/qna/questions/:questionId',
        element: <QnADetail />,
      },
      {
        path: '/post/:postId',
        element: <PostDetail />,
      },
      {
        path: '/privacy',
        element: <PrivacyPolicy />,
      },
      {
        path: '/terms',
        element: <Terms />,
      },
      // 보호된 페이지들 (로그인 필요)
      {
        path: '/profile/:id',
        element: <ProtectedRoute><Profile /></ProtectedRoute>,
      },
      {
        path: '/post/new',
        element: <BannedRestrictedRoute><PostEditor /></BannedRestrictedRoute>,
      },
      {
        path: '/post/edit/:id',
        element: <BannedRestrictedRoute><PostEditor /></BannedRestrictedRoute>,
      },
      {
        path: '/qna/ask',
        element: <BannedRestrictedRoute><QnAEditor /></BannedRestrictedRoute>,
      },
      {
        path: '/favorites',
        element: <ProtectedRoute><Favorites /></ProtectedRoute>,
      },
      {
        path: '/alerts',
        element: <ProtectedRoute><Alerts /></ProtectedRoute>,
      },
      {
        path: '/notifications',
        element: <ProtectedRoute><Notifications /></ProtectedRoute>,
      },
      {
        path: '/settings',
        element: <ProtectedRoute><Settings /></ProtectedRoute>,
      },
      {
        path: '/dm/:userId',
        element: <ProtectedRoute><DMChatPage /></ProtectedRoute>,
      },
      // 관리자 페이지들 (로그인 필요)
      {
        path: '/admin',
        element: <ProtectedRoute><AdminPage /></ProtectedRoute>,
      },
      {
        path: '/admin/users',
        element: <ProtectedRoute><AdminUsers /></ProtectedRoute>,
      },
      {
        path: '/admin/posts',
        element: <ProtectedRoute><AdminPosts /></ProtectedRoute>,
      },
      {
        path: '/admin/analytics',
        element: <ProtectedRoute><AdminAnalytics /></ProtectedRoute>,
      },
      {
        path: '/admin/ads',
        element: <ProtectedRoute><AdminAds /></ProtectedRoute>,
      },
      {
        path: '/admin/ads/analytics',
        element: <ProtectedRoute><AdAnalytics /></ProtectedRoute>,
      },
      {
        path: '/admin/ads/revenue',
        element: <ProtectedRoute><AdRevenue /></ProtectedRoute>,
      },
      {
        path: '/admin/tags',
        element: <ProtectedRoute><AdminTags /></ProtectedRoute>,
      },
      {
        path: '/admin/tag-groups',
        element: <ProtectedRoute><AdminTagGroups /></ProtectedRoute>,
      },
      {
        path: '/admin/badges',
        element: <ProtectedRoute><AdminBadgesNew /></ProtectedRoute>,
      },
      {
        path: '/admin/reports',
        element: <ProtectedRoute><AdminReports /></ProtectedRoute>,
      },
      {
        path: '/admin/market-settings',
        element: <ProtectedRoute><AdminMarketSettings /></ProtectedRoute>,
      },
      {
        path: '/admin/auction-times',
        element: <ProtectedRoute><AdminAuctionTimes /></ProtectedRoute>,
      },
      {
        path: '/admin/market-info',
        element: <ProtectedRoute><AdminMarketInfo /></ProtectedRoute>,
      },
      {
        path: '/admin/verification',
        element: <ProtectedRoute><AdminVerification /></ProtectedRoute>,
      },
      {
        path: '/admin/youtube',
        element: <ProtectedRoute><AdminYouTube /></ProtectedRoute>,
      },
      {
        path: '/admin/push',
        element: <ProtectedRoute><AdminPushNotifications /></ProtectedRoute>,
      },
      {
        path: '/admin/dm',
        element: <ProtectedRoute><AdminDM /></ProtectedRoute>,
      },
    ],
  },
  {
    path: '/login',
    element: <Suspense fallback={<PageLoader />}><Login /></Suspense>,
  },
  {
    path: '/register',
    element: <Suspense fallback={<PageLoader />}><Register /></Suspense>,
  },
  {
    path: '/auth/callback',
    element: <Suspense fallback={<PageLoader />}><AuthCallback /></Suspense>,
  },
  {
    path: '/landing',
    element: <Suspense fallback={<PageLoader />}><PCLanding /></Suspense>,
  },
], {
  future: {
    v7_startTransition: true,
  },
});

/**
 * App - 최소한의 Provider 관리만 담당
 * Layout, Router, QueryClient 모두 모듈 스코프에 정의하여
 * AuthContext 업데이트로 인한 리렌더 시에도 라우트 트리 재생성 방지
 */
function App() {
  // 브라우저 기본 스크롤 복원 비활성화
  useEffect(() => {
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2000,
            style: {
              fontSize: '16px',
              fontWeight: '600',
              padding: '16px 24px',
              borderRadius: '12px',
              maxWidth: '90vw',
            },
          }}
        />
        <Analytics />
        <SpeedInsights />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
