import React, { Suspense, lazy, useContext, useEffect } from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import './App.css';

// Components (항상 필요한 것들은 즉시 로드)
import Navbar from './components/Navbar';
import Leftbar from './components/Leftbar';
import MobileBottomNav from './components/MobileBottomNav';
import { AuthContext } from './context/AuthContext';
import { isMobileDevice } from './utils/deviceDetector';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';

// 로딩 컴포넌트
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="loading loading-spinner loading-lg text-orange-500"></div>
  </div>
);

// Pages - Lazy Loading
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/register'));
const Home = lazy(() => import('./pages/home'));
const Profile = lazy(() => import('./pages/profile'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const PostEditor = lazy(() => import('./pages/PostEditor'));

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

function App() {

const { currentUser, isBanned } = useContext(AuthContext);

const queryClient = new QueryClient()

// 브라우저 기본 스크롤 복원 비활성화
useEffect(() => {
  if ('scrollRestoration' in history) {
    history.scrollRestoration = 'manual';
  }
}, []);


  const Layout = () => {
    const location = useLocation();
    const isAdminPage = location.pathname.startsWith('/admin');

    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex">
          {/* PC 좌측 사이드바 - 로그인 상태에서만 표시 */}
          {currentUser && (
            <div className="hidden lg:block w-80 flex-shrink-0">
              <Leftbar />
            </div>
          )}

          {/* 메인 콘텐츠 */}
          <div className="flex-1 min-w-0">
            <div className="max-w-none mx-auto pb-20 lg:pb-4">
              <Suspense fallback={<PageLoader />}>
                <Outlet />
              </Suspense>
            </div>
          </div>

        </div>

        {/* 모바일용 하단 네비게이션 - 항상 표시 */}
        {(isMobileDevice() || window.innerWidth <= 768) && <MobileBottomNav />}
      </div>
    );
  };

  // eslint-disable-next-line react/prop-types
  const ProtectedRoute = ({ children }) => {
    if (currentUser===null) {
      return <Navigate to="/login" />;
    }
    return children;
  };

  // 차단된 사용자 접근 제한 (글쓰기, 사고팔고 등)
  // eslint-disable-next-line react/prop-types
  const BannedRestrictedRoute = ({ children }) => {
    if (currentUser === null) {
      return <Navigate to="/login" />;
    }
    if (isBanned) {
      return <Navigate to="/community" state={{ banned: true }} />;
    }
    return children;
  };

  

  const router = createBrowserRouter([
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
        // 게시판 페이지들 (읽기는 누구나, 글쓰기/댓글은 각 페이지에서 로그인 체크)
        {
          path: '/community',
          element: <Community />,
        },
        {
          path: '/secondhand',
          element: isBanned ? <Navigate to="/community" state={{ banned: true }} /> : <SecondHand />,
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
          path: '/qna',
          element: <QnA />,
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
  ], {
    future: {
      v7_startTransition: true,
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
