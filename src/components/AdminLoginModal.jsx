import { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

const AdminLoginModal = ({ onClose }) => {
  const [inputs, setInputs] = useState({
    username: '',
    password: '',
  });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login, logout, loginWithKakao } = useContext(AuthContext);

  const handleChange = (e) => {
    setInputs((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      const user = await login(inputs);

      if (user.role === 'admin' || user.role === 'super_admin') {
        window.location.href = '/admin';
      } else {
        setErr('관리자만 접근 가능합니다.');
        await logout();
        setLoading(false);
      }
    } catch (error) {
      const errorMessage = error.response?.data || error.message || '로그인에 실패했습니다.';
      setErr(errorMessage);
      setLoading(false);
    }
  };

  // 모달 배경 클릭 시 닫기
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-fade-in">
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 헤더 */}
        <div className="text-center mb-8">
          <div className="inline-block p-3 bg-gradient-to-br from-gray-700 to-gray-800 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">관리자 로그인</h2>
          <p className="text-gray-500 mt-1 text-sm">관리자 계정으로 로그인해주세요</p>
        </div>

        {/* 로그인 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사용자명
            </label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={inputs.username}
              onChange={handleChange}
              placeholder="아이디를 입력하세요"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:bg-white transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호
            </label>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={inputs.password}
              onChange={handleChange}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-400 focus:border-gray-400 focus:bg-white transition-all"
              required
            />
          </div>

          {err && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-r-xl text-sm">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-3" />
                로그인 중...
              </div>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        {/* 구분선 */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-400">또는</span>
          </div>
        </div>

        {/* 카카오 로그인 */}
        <button
          type="button"
          onClick={loginWithKakao}
          disabled={loading}
          className="w-full bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] font-bold py-3.5 px-6 rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.463 2 10.742c0 2.72 1.753 5.097 4.388 6.463-.17.598-.614 2.169-.702 2.505-.108.41.15.405.316.295.13-.087 2.07-1.366 2.903-1.92.689.1 1.401.152 2.095.152 5.523 0 10-3.463 10-7.742S17.523 3 12 3z"/>
          </svg>
          카카오톡으로 로그인
        </button>
      </div>
    </div>
  );
};

export default AdminLoginModal;
