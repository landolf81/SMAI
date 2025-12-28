import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MobileBottomNav from '../components/MobileBottomNav';
import LoadingSpinner from '../components/LoadingSpinner';
import { isMobileDevice, isTabletDevice } from '../utils/deviceDetector';

const Login = () => {
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isMobile, setIsMobile] = useState(true);

  const navigate = useNavigate();
  const { currentUser, loginWithKakao } = useContext(AuthContext);

  // 페이지 진입 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // PC 접근 시 랜딩페이지로 리다이렉트
  useEffect(() => {
    const checkDevice = () => {
      const mobile = isMobileDevice() || isTabletDevice();
      setIsMobile(mobile);

      if (!mobile) {
        navigate('/landing');
      }
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => window.removeEventListener('resize', checkDevice);
  }, [navigate]);

  // 로그인 상태일 때 자동 리다이렉트
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

  const handleKakaoLogin = async () => {
    setLoading(true);
    setErr(null);

    try {
      // rememberMe 상태를 localStorage에 저장 (카카오 콜백에서 사용)
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMe');
      }

      await loginWithKakao();
    } catch (error) {
      console.error('카카오 로그인 에러:', error);
      setErr('카카오 로그인에 실패했습니다.');
      setLoading(false);
    }
  };

  // PC에서는 렌더링하지 않음 (리다이렉트 됨)
  if (!isMobile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-50 flex flex-col">
      {/* 상단 헤더 */}
      <Navbar />

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        {/* 로고 */}
        <img
          src="/logo.svg"
          alt="참외 이야기"
          className="w-24 h-24 mb-6 object-contain"
        />

        {/* 타이틀 */}
        <h1 className="text-2xl font-bold text-gray-800 mb-2">참외 이야기</h1>
        <p className="text-gray-500 mb-8 text-center leading-relaxed">
          참외가 자라기 전의 이야기<br />
          농부의 이야기 밭의 이야기
        </p>

        {/* 로그인 카드 */}
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl border border-gray-200/50 p-6">
          {/* 에러 메시지 */}
          {err && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-xl text-sm mb-4">
              {err}
            </div>
          )}

          {/* 카카오 로그인 버튼 */}
          <button
            type="button"
            onClick={handleKakaoLogin}
            disabled={loading}
            className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] font-bold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-3" />
                로그인 중...
              </div>
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.463 2 10.742c0 2.72 1.753 5.097 4.388 6.463-.17.598-.614 2.169-.702 2.505-.108.41.15.405.316.295.13-.087 2.07-1.366 2.903-1.92.689.1 1.401.152 2.095.152 5.523 0 10-3.463 10-7.742S17.523 3 12 3z"/>
                </svg>
                카카오톡으로 로그인
              </>
            )}
          </button>

          {/* 로그인 유지 옵션 */}
          <div className="mt-4 flex items-center justify-center">
            <label className="flex items-center cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 transition-all"
              />
              <span className="ml-2 text-gray-600 text-sm group-hover:text-gray-800 transition-colors">
                로그인 상태 유지
              </span>
            </label>
          </div>

          {/* 회원가입 안내 */}
          <div className="mt-6 pt-6 border-t border-gray-100 text-center">
            <p className="text-gray-500 text-sm mb-2">처음이신가요?</p>
            <Link
              to="/register"
              className="inline-flex items-center gap-1 text-yellow-600 hover:text-yellow-700 font-medium text-sm transition-colors"
            >
              서비스 둘러보기
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {/* 하단 네비게이션 */}
      <MobileBottomNav />
    </div>
  );
};

export default Login;
