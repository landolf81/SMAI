import React from 'react';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';

const ErrorBoundary = ({ error, resetError, children }) => {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <ErrorIcon className="text-6xl text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-4">문제가 발생했습니다</h2>
          <p className="text-gray-600 mb-6">
            일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
          </p>
          
          {process.env.NODE_ENV === 'development' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-red-800 mb-2">개발자 정보:</h3>
              <pre className="text-xs text-red-700 overflow-auto">
                {error.message}
              </pre>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={resetError}
              className="w-full flex items-center justify-center gap-2 bg-market-500 hover:bg-market-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              <RefreshIcon fontSize="small" />
              다시 시도
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="w-full border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors"
            >
              홈으로 이동
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            문제가 계속 발생하면 관리자에게 문의하세요.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

// 로딩 컴포넌트
export const LoadingSpinner = ({ size = 'medium', message = '로딩 중...' }) => {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-8 h-8',
    large: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className={`${sizeClasses[size]} border-4 border-market-200 border-t-market-500 rounded-full animate-spin`}></div>
      {message && (
        <p className="mt-3 text-gray-600 text-sm">{message}</p>
      )}
    </div>
  );
};

// 빈 상태 컴포넌트
export const EmptyState = ({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      {Icon && <Icon className="text-6xl text-gray-300 mb-4" />}
      <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
      {description && (
        <p className="text-gray-600 mb-6 max-w-md">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="button-market"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

// 네트워크 에러 감지
export const NetworkErrorHandler = ({ children }) => {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 w-full h-full bg-white flex items-center justify-center z-50">
        <div className="text-center">
          <div className="text-6xl mb-4">📡</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">인터넷 연결 없음</h2>
          <p className="text-gray-600">
            인터넷 연결을 확인하고 다시 시도해주세요.
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default ErrorBoundary;
