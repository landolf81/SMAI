import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AdminLoginModal from '../components/AdminLoginModal';

const PCLanding = () => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const { currentUser } = useContext(AuthContext);
  const navigate = useNavigate();

  // 이미 로그인된 관리자는 /admin으로 리다이렉트
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
        navigate('/admin');
      }
    }
  }, [currentUser, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-white to-green-50 flex flex-col items-center justify-center relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-orange-100 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
        {/* 로고 */}
        <img
          src="/logo.svg"
          alt="선남 참외 이야기"
          className="w-32 h-32 mx-auto mb-8 object-contain"
        />

        {/* 타이틀 */}
        <h1 className="text-5xl font-bold bg-gradient-to-r from-yellow-500 to-green-500 bg-clip-text text-transparent mb-4">
          선남 참외 이야기
        </h1>

        <p className="text-xl text-gray-600 mb-12">
          성주 지역의 농산물 거래와 소통을 위한<br />
          커뮤니티 플랫폼
        </p>

        {/* 모바일 안내 카드 */}
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-xl border border-gray-200/50 p-8 mb-8">
          <div className="text-6xl mb-4">📱</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            모바일에서 이용해주세요
          </h2>
          <p className="text-gray-600 leading-relaxed">
            선남 참외 이야기는 모바일에 최적화된 서비스입니다.<br />
            스마트폰으로 접속하시면 더 편리하게 이용하실 수 있습니다.
          </p>

          {/* QR 코드 영역 (추후 실제 QR 추가 가능) */}
          <div className="mt-6 p-4 bg-gray-50 rounded-xl inline-block">
            <div className="w-32 h-32 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <span className="text-gray-400 text-sm">QR Code</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">스마트폰으로 스캔하세요</p>
          </div>
        </div>

        {/* 주요 기능 안내 */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-yellow-200">
            <div className="text-3xl mb-2">📊</div>
            <div className="font-semibold text-gray-800 text-sm">참외 시세</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-green-200">
            <div className="text-3xl mb-2">💬</div>
            <div className="font-semibold text-gray-800 text-sm">커뮤니티</div>
          </div>
          <div className="bg-white/60 backdrop-blur-sm p-4 rounded-xl border border-orange-200">
            <div className="text-3xl mb-2">🛒</div>
            <div className="font-semibold text-gray-800 text-sm">중고거래</div>
          </div>
        </div>

        {/* 관리자 로그인 버튼 */}
        <button
          onClick={() => setShowAdminModal(true)}
          className="text-gray-400 hover:text-gray-600 text-sm transition-colors underline"
        >
          관리자 로그인
        </button>
      </div>

      {/* 푸터 */}
      <div className="absolute bottom-6 text-center text-gray-400 text-sm">
        <p>선남 참외 이야기 &copy; 2024</p>
      </div>

      {/* 관리자 로그인 모달 */}
      {showAdminModal && (
        <AdminLoginModal onClose={() => setShowAdminModal(false)} />
      )}
    </div>
  );
};

export default PCLanding;
