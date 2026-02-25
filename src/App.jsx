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
import './App.css';

// Components (항상 필요한 것들은 즉시 로드)
import Navbar from './components/Navbar';
import Leftbar from './components/Leftbar';
import MobileBottomNav from './components/MobileBottomNav';
import LoadingSpinner from './components/LoadingSpinner';
import { AuthContext } from './context/AuthContext';
import { isMobileDevice, isTabletDevice } from './utils/deviceDetector';
import { useScrollDirection } from './hooks/useScrollDirection';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

// 아이콘
import SearchIcon from '@mui/icons-material/Search';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import EditIcon from '@mui/icons-material/Edit';
import PolicyIcon from '@mui/icons-material/Policy';

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
const AdminVerification = lazy(() => import('./pages/admin/AdminVerification'));
const AdminYouTube = lazy(() => import('./pages/admin/AdminYouTube'));
const AdminPushNotifications = lazy(() => import('./pages/admin/AdminPushNotifications'));

// Other Pages - Lazy Loading
const Prices = lazy(() => import('./pages/Prices'));
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
const Layout = () => {
  const { currentUser, isBanned } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdminPage = location.pathname.startsWith('/admin');
  const isDMPage = location.pathname.startsWith('/dm/');
  const scrollDirection = useScrollDirection();

  // 글쓰기 버튼 상태
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

  // DM 페이지는 전체 화면으로 렌더링 (Navbar, Leftbar, BottomNav 숨김)
  if (isDMPage) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.1s' }}
                    >
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">질문하기</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
                        <EditIcon className="text-white" fontSize="small" />
                      </div>
                    </button>

                    {/* FAQ */}
                    <button
                      onClick={() => {
                        closeWriteMenu();
                        navigate('/faq');
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.05s' }}
                    >
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">FAQ</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 flex items-center justify-center">
                        <HelpOutlineIcon className="text-amber-600" fontSize="small" />
                      </div>
                    </button>

                    {/* 검색 */}
                    <button
                      onClick={() => {
                        // QnAList로 검색 모드 진입 이벤트 발송 (메뉴는 검색창 확장 후 자동으로 닫힘)
                        window.dispatchEvent(new CustomEvent('qna-search-open'));
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-105 transition-transform animate-fade-in-up"
                    >
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">검색</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-cyan-200 flex items-center justify-center">
                        <SearchIcon className="text-blue-600" fontSize="small" />
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
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.1s' }}
                    >
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">글쓰기</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                        <EditIcon className="text-white" fontSize="small" />
                      </div>
                    </button>

                    {/* 검색 */}
                    <button
                      onClick={() => {
                        // SecondHand 페이지로 검색 모드 진입 이벤트 발송 (메뉴는 검색창 확장 후 자동으로 닫힘)
                        window.dispatchEvent(new CustomEvent('secondhand-search-open'));
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-105 transition-transform animate-fade-in-up"
                      style={{ animationDelay: '0.05s' }}
                    >
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">검색</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-cyan-200 flex items-center justify-center">
                        <SearchIcon className="text-blue-600" fontSize="small" />
                      </div>
                    </button>

                    {/* 거래 정책 */}
                    <button
                      onClick={() => {
                        closeWriteMenu();
                        navigate('/trading-policy');
                      }}
                      className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white rounded-full shadow-lg border border-gray-100 hover:scale-105 transition-transform animate-fade-in-up"
                    >
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">거래 정책</span>
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-100 to-violet-200 flex items-center justify-center">
                        <PolicyIcon className="text-purple-600" fontSize="small" />
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
    </div>
  );
};

/**
 * ProtectedRoute - 로그인 필요 라우트 가드
 * 모듈 스코프 정의 (App 리렌더 시 재생성 방지)
 */
// eslint-disable-next-line react/prop-types
const ProtectedRoute = ({ children }) => {
  const { currentUser } = useContext(AuthContext);
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
  const { currentUser, isBanned } = useContext(AuthContext);
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
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Analytics />
    </QueryClientProvider>
  );
}

export default App;
