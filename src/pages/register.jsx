import { useState, useContext, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MobileBottomNav from '../components/MobileBottomNav';
import { isMobileDevice, isTabletDevice } from '../utils/deviceDetector';
import { generateRandomId, generateRandomNickname } from '../utils/randomGenerator';

const Register = () => {
  const { register: registerUser, loginWithKakao } = useContext(AuthContext);
  const [inputs, setInputs] = useState({
    email: "",
    password: "",
  });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();

  // 스크롤 애니메이션을 위한 ref
  const section1Ref = useRef(null);
  const section2Ref = useRef(null);
  const section3Ref = useRef(null);
  const section4Ref = useRef(null);

  // 디바이스 감지
  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(isMobileDevice() || isTabletDevice() || window.innerWidth <= 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);

    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  // 페이지 진입 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 회원가입 성공 시 커뮤니티로 이동
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        window.location.href = "/community";
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Intersection Observer로 스크롤 애니메이션
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.15
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
          entry.target.classList.remove('opacity-0', 'translate-y-16');
        }
      });
    }, observerOptions);

    const sections = [section1Ref, section2Ref, section3Ref, section4Ref];
    sections.forEach(ref => {
      if (ref.current) {
        observer.observe(ref.current);
      }
    });

    return () => observer.disconnect();
  }, []);

  const handleChange = (e) => {
    setInputs((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      // 랜덤 ID와 별명 생성
      const username = generateRandomId();
      const name = generateRandomNickname();

      await registerUser({ ...inputs, username, name });
      setSuccess(true);
    } catch (error) {
      console.error('회원가입 오류:', error);
      // 에러 메시지 한글화
      let errorMessage = "회원가입 중 오류가 발생했습니다.";
      if (error.message?.includes('already registered') || error.message?.includes('already exists')) {
        errorMessage = "이미 가입된 이메일입니다. 탈퇴한 계정의 이메일로는 재가입이 불가능하니, 다른 이메일을 사용해주세요.";
      } else if (error.message?.includes('invalid email') || error.message?.includes('Invalid email')) {
        errorMessage = "올바른 이메일 형식을 입력해주세요.";
      } else if (error.message?.includes('password') && error.message?.includes('6')) {
        errorMessage = "비밀번호는 최소 6자 이상이어야 합니다.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      setErr(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircleIcon className="text-6xl text-green-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">회원가입 완료!</h2>
          <p className="text-gray-600 mb-4">성주참외 경락정보에 오신 것을 환영합니다.</p>
          <p className="text-sm text-gray-500">잠시 후 커뮤니티 화면으로 이동됩니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-white to-green-50">
      {/* 커스텀 애니메이션 스타일 */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(60px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
      `}</style>

      {/* 섹션 1: 히어로 - 상단 30% 정도에서 시작 */}
      <section
        ref={section1Ref}
        className="min-h-[70vh] flex flex-col items-center justify-start pt-[15vh] px-6 pb-20 opacity-0 translate-y-16 transition-all duration-700"
      >
        <div className="text-center max-w-3xl mx-auto">
          {/* 로고 이미지 */}
          <img
            src="https://pub-1d5977ce7cec48079bcd6f847b2f3dd1.r2.dev/logos/logo-512.png"
            alt="성주참외 로고"
            className="h-24 md:h-32 mx-auto mb-8 object-contain"
          />
          <p className="text-xl md:text-2xl text-gray-600 font-light">
            성주 참외 시세를 쉽게 확인하는 페이지
          </p>
        </div>

        {/* 스크롤 안내 */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 border-2 border-gray-400 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-gray-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* 섹션 2: 소개 */}
      <section
        ref={section2Ref}
        className="min-h-screen flex flex-col items-center justify-center px-6 py-20 opacity-0 translate-y-16 transition-all duration-700"
      >
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-2xl md:text-3xl text-gray-700 leading-relaxed font-light">
            이 페이지는 <span className="font-semibold text-yellow-600">성주 지역 공판장</span>에서
            거래된 참외 경락 가격을 편하게 확인할 수 있도록 만들어졌습니다.
          </p>
          <div className="mt-12 h-px w-24 bg-yellow-400 mx-auto"></div>
          <p className="mt-12 text-xl md:text-2xl text-gray-600 leading-relaxed font-light">
            참외 재배 농가와 구매자가 참고할 수 있는<br />
            <span className="font-medium">기본적인 시세 정보</span>를 제공합니다.
          </p>
        </div>
      </section>

      {/* 섹션 3: 기능 소개 */}
      <section
        ref={section3Ref}
        className="min-h-screen flex flex-col items-center justify-center px-6 py-20 opacity-0 translate-y-16 transition-all duration-700"
      >
        <div className="max-w-4xl mx-auto w-full">
          {/* 참외 경락 정보 */}
          <div className="mb-20 text-center">
            <div className="text-5xl mb-6">📊</div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              참외 경락 정보
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed font-light max-w-xl mx-auto">
              성주 공판장에서 나온<br />
              <span className="font-medium">일자별 · 등급별 · 중량별</span><br />
              참외 가격을 확인할 수 있습니다.
            </p>
            <p className="mt-8 text-lg text-gray-500">
              참외 시세만 간단하게 볼 수 있도록 구성했습니다.
            </p>
          </div>

          {/* 구분선 */}
          <div className="h-px w-32 bg-green-300 mx-auto mb-20"></div>

          {/* 농업 커뮤니티 */}
          <div className="text-center">
            <div className="text-5xl mb-6">👨‍🌾</div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              농업 커뮤니티
            </h2>
            <p className="text-xl md:text-2xl text-gray-600 leading-relaxed font-light max-w-xl mx-auto">
              참외 농사와 관련된 이야기나 정보를<br />
              가볍게 나눌 수 있는 공간입니다.
            </p>
            <p className="mt-8 text-lg text-gray-500">
              누구나 자유롭게 소통할 수 있습니다.
            </p>
          </div>
        </div>
      </section>

      {/* 섹션 4: 회원가입 폼 */}
      <section
        ref={section4Ref}
        className="min-h-screen flex flex-col items-center justify-center px-6 py-20 opacity-0 translate-y-16 transition-all duration-700"
      >
        <div className="max-w-md mx-auto w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              회원가입 안내
            </h2>
            <p className="text-xl text-gray-600 font-light">
              아직 계정이 없으신가요?
            </p>
            <p className="text-lg text-gray-500 mt-2">
              회원가입 후 시세 조회와 커뮤니티 이용이 가능합니다.
            </p>
          </div>

          {/* 회원가입 폼 */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이메일
                </label>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={inputs.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-lg"
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
                  autoComplete="new-password"
                  value={inputs.password}
                  onChange={handleChange}
                  placeholder="8자 이상"
                  className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition-all text-lg"
                  required
                  minLength={8}
                />
              </div>

              {/* 이용약관 동의 */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    className="w-5 h-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                  />
                  <span className="text-sm text-gray-600">
                    <span className="font-medium text-gray-800">[필수]</span> 이용약관 동의
                    <Link to="/terms" target="_blank" className="text-yellow-600 hover:text-yellow-700 ml-1 underline">보기</Link>
                  </span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    className="w-5 h-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                  />
                  <span className="text-sm text-gray-600">
                    <span className="font-medium text-gray-800">[필수]</span> 개인정보 처리방침 동의
                    <Link to="/privacy" target="_blank" className="text-yellow-600 hover:text-yellow-700 ml-1 underline">보기</Link>
                  </span>
                </label>
              </div>

              {err && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {err}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white font-bold py-4 px-4 rounded-xl transition-all text-lg shadow-lg shadow-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    가입 중...
                  </div>
                ) : (
                  '회원가입'
                )}
              </button>
            </form>

            {/* 소셜 회원가입 (카카오톡) */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-500">또는</span>
                </div>
              </div>
              <button
                type="button"
                onClick={loginWithKakao}
                disabled={loading}
                className="mt-4 w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-4 px-4 rounded-xl transition-all text-lg shadow-lg shadow-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.463 2 10.742c0 2.72 1.753 5.097 4.388 6.463-.17.598-.614 2.169-.702 2.505-.108.41.15.405.316.295.13-.087 2.07-1.366 2.903-1.92.689.1 1.401.152 2.095.152 5.523 0 10-3.463 10-7.742S17.523 3 12 3z"/>
                </svg>
                카카오톡으로 시작하기
              </button>
            </div>

            {/* 로그인 링크 */}
            <div className="mt-6 text-center">
              <p className="text-gray-500">
                이미 계정이 있으신가요?
                <Link to="/login" className="text-yellow-600 hover:text-yellow-700 font-semibold ml-2">
                  로그인 →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 푸터 여백 */}
      <div className="h-20"></div>

      {/* 모바일에서만 하단 네비게이션 표시 */}
      {isMobile && <MobileBottomNav />}
    </div>
  );
};

export default Register;
