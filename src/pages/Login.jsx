import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import MobileBottomNav from '../components/MobileBottomNav';
import { isMobileDevice, isTabletDevice } from '../utils/deviceDetector';

const Login = () => {
  const [inputs, setInputs] = useState({
    username: "",
    password: "",
  });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 페이지 진입 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 디바이스 감지
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(isMobileDevice() || isTabletDevice());
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  const navigate = useNavigate();
  const { currentUser, login, logout, loginWithKakao } = useContext(AuthContext);

  // 로그인 상태일 때 자동 리다이렉트
  useEffect(() => {
    if (currentUser) {
      const isPC = !isMobileDevice() && !isTabletDevice();

      if (isPC) {
        // PC에서는 관리자만 admin으로, 일반 사용자는 안내 메시지
        if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
          navigate('/admin');
        } else {
          // 일반 사용자는 PC 접근 제한 안내
          setErr('PC에서는 관리자만 접근 가능합니다. 모바일 기기에서 접속해주세요.');
        }
      } else {
        // 모바일/태블릿에서는 홈으로
        navigate('/');
      }
    }
  }, [currentUser, navigate]);

  const handleChange = (e) => {
    setInputs((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr(null); // 에러 초기화

    try {
      console.log('🔐 로그인 시도...');
      const user = await login(inputs);
      console.log('✅ 로그인 성공!', user);
      console.log('🔑 사용자 역할:', user.role);
      console.log('👤 사용자 전체 정보:', JSON.stringify(user, null, 2));

      const isPC = !isMobileDevice() && !isTabletDevice();
      console.log('💻 디바이스 타입:', isPC ? 'PC' : '모바일/태블릿');

      // 로그인 성공 후 리다이렉트
      if (isPC) {
        // PC에서는 관리자만 admin으로
        console.log('🔍 역할 체크:', user.role, '=== admin?', user.role === 'admin', '=== super_admin?', user.role === 'super_admin');

        if (user.role === 'admin' || user.role === 'super_admin') {
          console.log('✅ 관리자 권한 확인! /admin으로 이동');
          window.location.href = "/admin";
        } else {
          // 일반 사용자는 모바일 접속 안내
          console.log('❌ 관리자 권한 없음, 로그아웃 처리');
          setErr('PC에서는 관리자만 접근 가능합니다. 모바일 기기에서 접속해주세요.');
          await logout(); // 로그아웃 처리
          setLoading(false);
        }
      } else {
        // 모바일/태블릿에서는 홈으로
        console.log('📱 모바일/태블릿 → 홈으로 이동');
        window.location.href = "/";
      }
    } catch (err) {
      console.error('❌ 로그인 에러:', err);
      // fetch API와 axios API 모두 대응
      const errorMessage = err.response?.data || err.message || '로그인에 실패했습니다.';
      setErr(errorMessage);
      setLoading(false); // 에러 발생시에만 로딩 해제
    }
  };

  // 로그아웃 버튼 렌더링
  const LogoutButton = () => (
    <button
      onClick={logout}
      className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 z-50"
    >
      로그아웃
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-50 flex flex-col items-center justify-start relative overflow-hidden">
      {/* 배경 장식 요소 */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>

      {/* 모바일에서만 상단 헤더 표시 */}
      {isMobile && <Navbar />}

      {currentUser && <LogoutButton />}

      <div className="w-full p-4 pb-20 relative z-10">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mt-8">
        {/* 환영 섹션 (PC에서만) */}
        {!isMobile && (
          <div className="space-y-6">
            <div className="space-y-4">
              <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-500 to-green-500 bg-clip-text text-transparent">
                성주마이에<br />오신 것을 환영합니다
              </h1>
              <p className="text-xl text-gray-600">
                성주 지역의 농산물 거래와 소통을 위한<br />
                커뮤니티 플랫폼
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-yellow-200">
                <div className="text-3xl mb-2">🌾</div>
                <div className="font-semibold text-gray-800">신선한 농산물</div>
                <div className="text-sm text-gray-600">실시간 시세 정보</div>
              </div>
              <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-green-200">
                <div className="text-3xl mb-2">💬</div>
                <div className="font-semibold text-gray-800">커뮤니티</div>
                <div className="text-sm text-gray-600">지역 소통 공간</div>
              </div>
            </div>
          </div>
        )}

        {/* 로그인 폼 */}
        <div className={`w-full max-w-md mx-auto ${isMobile ? 'order-1' : 'order-2'}`}>
          <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl border border-gray-200/50 p-8 lg:p-10">
            <div className="text-center mb-8">
              <div className="inline-block p-3 bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-2xl mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-3xl font-bold text-gray-800">로그인</h3>
              <p className="text-gray-500 mt-2">반가워요! 다시 만나서 기쁩니다</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  사용자명
                </label>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={inputs.username}
                  onChange={handleChange}
                  placeholder="아이디를 입력하세요"
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 focus:bg-white transition-all duration-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  비밀번호
                </label>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={inputs.password}
                  onChange={handleChange}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 focus:bg-white transition-all duration-200"
                  required
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400 transition-all"
                  />
                  <span className="ml-2 text-gray-600 group-hover:text-gray-800 transition-colors">로그인 상태 유지</span>
                </label>
                <a href="#" className="text-yellow-600 hover:text-yellow-700 font-medium transition-colors">
                  비밀번호 찾기
                </a>
              </div>
              {err && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-xl text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span>{err}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    로그인 중...
                  </div>
                ) : (
                  '로그인'
                )}
              </button>
            </form>
            {/* 소셜 로그인 (카카오톡) */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-400 font-medium">또는</span>
                </div>
              </div>
              <button
                type="button"
                onClick={loginWithKakao}
                disabled={loading}
                className="mt-6 w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] font-bold py-4 px-6 rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.463 2 10.742c0 2.72 1.753 5.097 4.388 6.463-.17.598-.614 2.169-.702 2.505-.108.41.15.405.316.295.13-.087 2.07-1.366 2.903-1.92.689.1 1.401.152 2.095.152 5.523 0 10-3.463 10-7.742S17.523 3 12 3z"/>
                </svg>
                카카오톡으로 로그인
              </button>
            </div>

            {/* 회원가입 링크 */}
            <div className="text-center mt-8 pt-6 border-t border-gray-100">
              <p className="text-gray-600 text-sm mb-2">아직 계정이 없으신가요?</p>
              <Link
                to="/register"
                className="inline-flex items-center gap-1 text-yellow-600 hover:text-yellow-700 font-bold text-base transition-colors group"
              >
                회원가입하기
                <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* 모바일에서만 하단 네비게이션 표시 */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};

export default Login;
