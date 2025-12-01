import React from 'react';
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
  useLocation,
} from 'react-router-dom';
import './App.css';


// Pages
import Login from './pages/Login';
import Register from './pages/register';
import Home from './pages/home';
import Profile from './pages/profile';
import AdminPage from './pages/AdminPage';
import PostEditor from './pages/PostEditor';

// Admin Pages
import AdminUsers from './pages/admin/AdminUsers';
import AdminPosts from './pages/admin/AdminPosts';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAds from './pages/admin/AdminAds';
import AdAnalytics from './pages/admin/AdAnalytics';
import AdRevenue from './pages/admin/AdRevenue';
import AdminTags from './pages/admin/AdminTags';
import AdminTagGroups from './pages/admin/AdminTagGroups';
import AdminBadgesNew from './pages/admin/AdminBadgesNew';
import AdminReports from './pages/AdminReports';

import Prices from './pages/Prices';
import Community from './pages/Community';
import Favorites from './pages/Favorites';
import Alerts from './pages/Alerts';
import Settings from './pages/Settings';
import QnA from './pages/QnA';
import QnAEditor from './pages/QnAEditor';
import QnADetail from './components/QnADetail';
import SecondHand from './pages/SecondHand';
import PostDetail from './pages/PostDetail';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';

// Components
import Navbar from './components/Navbar';
import Leftbar from './components/Leftbar';
import MobileBottomNav from './components/MobileBottomNav';
import { useContext, useEffect } from 'react';
import { AuthContext } from './context/AuthContext';
import { isMobileDevice } from './utils/deviceDetector';
import {
  QueryClient,
  QueryClientProvider,
  
} from '@tanstack/react-query';

function App() {

const { currentUser } = useContext(AuthContext);

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
              <Outlet />
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
          element: <SecondHand />,
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
          element: <ProtectedRoute><PostEditor /></ProtectedRoute>,
        },
        {
          path: '/post/edit/:id',
          element: <ProtectedRoute><PostEditor /></ProtectedRoute>,
        },
        {
          path: '/qna/ask',
          element: <ProtectedRoute><QnAEditor /></ProtectedRoute>,
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
      ],
    },
    {
      path: '/login',
      element: <Login />,
    },
    {
      path: '/register',
      element: <Register />,
    },
  ]);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
