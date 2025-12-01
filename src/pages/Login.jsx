import { useContext, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import StoreIcon from '@mui/icons-material/Store';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
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
  const { currentUser, login, logout } = useContext(AuthContext);

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
    <div className="min-h-screen bg-gradient-to-br from-market-50 via-white to-produce-50 flex flex-col items-center justify-start relative">
      {/* 모바일에서만 상단 헤더 표시 */}
      {isMobile && <Navbar />}

      {currentUser && <LogoutButton />}

      <div className="w-full p-4 pb-20">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center mt-8">
        {/* 모바일에서는 로그인 폼을 먼저 표시 */}
        <div className={`w-full max-w-md mx-auto ${isMobile ? 'order-1' : 'order-2'}`}>
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-gray-800">로그인</h3>
              <p className="text-gray-600 mt-2">계정에 로그인하여 서비스를 이용하세요</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사용자명
                </label>
                <input
                  type="text"
                  name="username"
                  value={inputs.username}
                  onChange={handleChange}
                  placeholder="사용자명을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-market-500 focus:border-market-500 transition-colors"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호
                </label>
                <input
                  type="password"
                  name="password"
                  value={inputs.password}
                  onChange={handleChange}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-market-500 focus:border-market-500 transition-colors"
                  required
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input type="checkbox" className="rounded border-gray-300 text-market-600 focus:ring-market-500" />
                  <span className="ml-2 text-sm text-gray-600">로그인 상태 유지</span>
                </label>
                <a href="#" className="text-sm text-market-600 hover:text-market-700">
                  비밀번호 찾기
                </a>
              </div>
              {err && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {err}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-market-500 hover:bg-market-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="loading-spinner mr-2"></div>
                    로그인 중...
                  </div>
                ) : (
                  '로그인'
                )}
              </button>
            </form>
            {/* 소셜 로그인 (카카오톡) */}
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">또는</span>
                </div>
              </div>
              <button className="mt-4 w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold py-3 px-4 rounded-lg transition-colors">
                카카오톡으로 로그인 (준비중)
              </button>
            </div>
          </div>
          {/* 추가 링크 */}
          <div className="text-center mt-6 text-sm text-gray-600">
            <p>
              처음 방문하시나요? 
              <Link to="/register" className="text-market-600 hover:text-market-700 font-medium ml-1">
                회원가입
              </Link>
            </p>
          </div>
        </div>

        {/* 브랜딩/소개 섹션 */}
        <div className={`text-center lg:text-left space-y-6 ${isMobile ? 'order-2' : 'order-1'}`}>
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
            <AgricultureIcon className="text-4xl text-market-500" />
            <h1 className="text-4xl font-bold text-gray-800">성주참외 경락정보</h1>
          </div>
          <div className="space-y-4">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">
              실시간 농산물 가격 정보를
              <span className="text-market-600"> 한눈에</span>
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              성주 지역 참외 경락가격을 실시간으로 확인하고, 
              농민과 구매자를 위한 투명한 거래 정보를 제공합니다.
            </p>
          </div>
          {/* 특징 카드들 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-white rounded-lg p-4 shadow-md border border-market-100">
              <TrendingUpIcon className="text-market-500 mb-2" />
              <h3 className="font-semibold text-gray-800">실시간 가격</h3>
              <p className="text-sm text-gray-600">최신 경락가격 정보</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-md border border-produce-100">
              <StoreIcon className="text-produce-500 mb-2" />
              <h3 className="font-semibold text-gray-800">시장 정보</h3>
              <p className="text-sm text-gray-600">다양한 공판장 데이터</p>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-md border border-fresh-100">
              <AgricultureIcon className="text-fresh-500 mb-2" />
              <h3 className="font-semibold text-gray-800">농업 커뮤니티</h3>
              <p className="text-sm text-gray-600">정보 공유 및 소통</p>
            </div>
          </div>
          {/* 계정이 없는 경우 안내 */}
          <div className="mt-8 p-4 bg-market-50 rounded-lg border border-market-200">
            <p className="text-market-800 text-center lg:text-left">
              아직 계정이 없으신가요?
              <Link to="/register" className="font-semibold text-market-600 hover:text-market-700 ml-2">
                회원가입하기 →
              </Link>
            </p>
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
