import { useState, useContext, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import MobileBottomNav from '../components/MobileBottomNav';
import { isMobileDevice, isTabletDevice } from '../utils/deviceDetector';

const Register = () => {
  const { loginWithKakao, currentUser } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const navigate = useNavigate();

  // 스크롤 애니메이션을 위한 ref
  const section1Ref = useRef(null);
  const section2Ref = useRef(null);
  const section3Ref = useRef(null);
  const section4Ref = useRef(null);

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

  // 페이지 진입 시 스크롤 최상단으로 이동
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 이미 로그인된 경우 홈으로 리다이렉트
  useEffect(() => {
    if (currentUser) {
      navigate('/');
    }
  }, [currentUser, navigate]);

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

  const handleKakaoLogin = async () => {
    setLoading(true);
    try {
      await loginWithKakao();
    } catch (error) {
      console.error('카카오 로그인 에러:', error);
      setLoading(false);
    }
  };

  // PC에서는 렌더링하지 않음 (리다이렉트 됨)
  if (!isMobile) {
    return null;
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
            src="/logo.svg"
            alt="선남 참외 이야기 로고"
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

      {/* 섹션 4: 시작하기 */}
      <section
        ref={section4Ref}
        className="min-h-screen flex flex-col items-center justify-center px-6 py-20 opacity-0 translate-y-16 transition-all duration-700"
      >
        <div className="max-w-md mx-auto w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              지금 시작하세요
            </h2>
            <p className="text-xl text-gray-600 font-light">
              카카오톡으로 간편하게 가입하고
            </p>
            <p className="text-lg text-gray-500 mt-2">
              시세 조회와 커뮤니티를 이용해보세요.
            </p>
          </div>

          {/* 카카오 로그인 카드 */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
            {/* 카카오 로그인 버튼 */}
            <button
              type="button"
              onClick={handleKakaoLogin}
              disabled={loading}
              className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] font-bold py-4 px-4 rounded-xl transition-all text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-gray-800 border-t-transparent rounded-full animate-spin mr-2"></div>
                  로그인 중...
                </div>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3C6.477 3 2 6.463 2 10.742c0 2.72 1.753 5.097 4.388 6.463-.17.598-.614 2.169-.702 2.505-.108.41.15.405.316.295.13-.087 2.07-1.366 2.903-1.92.689.1 1.401.152 2.095.152 5.523 0 10-3.463 10-7.742S17.523 3 12 3z"/>
                  </svg>
                  카카오톡으로 시작하기
                </>
              )}
            </button>

            {/* 약관 안내 */}
            <p className="mt-4 text-center text-xs text-gray-400">
              시작하기를 누르면{' '}
              <Link to="/terms" className="underline">이용약관</Link> 및{' '}
              <Link to="/privacy" className="underline">개인정보처리방침</Link>에 동의하게 됩니다.
            </p>

            {/* 로그인 링크 */}
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <p className="text-gray-500 text-sm">
                이미 계정이 있으신가요?
                <Link to="/login" className="text-yellow-600 hover:text-yellow-700 font-semibold ml-2">
                  로그인
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
