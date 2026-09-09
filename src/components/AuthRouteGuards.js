import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthContext } from '../context/authState.js';

// 공개 화면은 즉시 렌더링하고, 인증이 필요한 라우트만 이 경계에서 대기시킨다.
const AuthPageLoader = () => React.createElement(
  'div',
  {
    className: 'flex items-center justify-center min-h-[50vh]',
    'aria-label': '로그인 상태 확인 중',
  },
  React.createElement('span', { className: 'loading loading-spinner loading-lg' }),
);

// eslint-disable-next-line react/prop-types
export const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useContext(AuthContext);

  if (loading) return React.createElement(AuthPageLoader);
  if (currentUser === null) return React.createElement(Navigate, { to: '/login' });
  return children;
};

// eslint-disable-next-line react/prop-types
export const BannedRestrictedRoute = ({ children }) => {
  const { currentUser, loading, isBanned } = useContext(AuthContext);

  if (loading) return React.createElement(AuthPageLoader);
  if (currentUser === null) return React.createElement(Navigate, { to: '/login' });
  if (isBanned) {
    return React.createElement(Navigate, { to: '/community', state: { banned: true } });
  }
  return children;
};

// eslint-disable-next-line react/prop-types
export const SecondHandGuard = ({ children }) => {
  const { loading, isBanned } = useContext(AuthContext);

  if (loading) return React.createElement(AuthPageLoader);
  if (isBanned) {
    return React.createElement(Navigate, { to: '/community', state: { banned: true } });
  }
  return children;
};
