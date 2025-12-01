import { useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import AgricultureIcon from '@mui/icons-material/Agriculture';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const Register = () => {
  const { register: registerUser } = useContext(AuthContext);
  const [inputs, setInputs] = useState({
    username: "",
    email: "",
    password: "",
    name: "",
  });
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setInputs((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);

    try {
      // AuthContext의 register 함수를 통해 Supabase Auth 사용
      await registerUser(inputs);
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      console.error('회원가입 오류:', error);
      // Supabase 에러 메시지 처리
      const errorMessage = error.message || "회원가입 중 오류가 발생했습니다.";
      setErr(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-market-50 via-white to-produce-50 flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircleIcon className="text-6xl text-market-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">회원가입 완료!</h2>
          <p className="text-gray-600 mb-4">성주참외 경락정보에 오신 것을 환영합니다.</p>
          <p className="text-sm text-gray-500">잠시 후 로그인 페이지로 이동됩니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-market-50 via-white to-produce-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        
        {/* 좌측 브랜딩 섹션 */}
        <div className="text-center lg:text-left space-y-6">
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-8">
            <AgricultureIcon className="text-4xl text-market-500" />
            <h1 className="text-4xl font-bold text-gray-800">성주참외 경락정보</h1>
          </div>
          
          <div className="space-y-4">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-800">
              <span className="text-market-600">무료 회원가입</span>하고
              <br />다양한 서비스를 이용하세요
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              성주 참외 경락가격 정보부터 농업 커뮤니티까지, 
              농민과 구매자를 위한 모든 서비스를 제공합니다.
            </p>
          </div>

          {/* 혜택 목록 */}
          <div className="space-y-4 mt-8">
            <h3 className="font-semibold text-gray-800 mb-4">회원 혜택</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="text-market-500 mt-0.5" fontSize="small" />
                <div>
                  <div className="font-medium text-gray-800">실시간 가격 알림</div>
                  <div className="text-sm text-gray-600">관심 품목의 가격 변동을 즉시 알려드립니다</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="text-market-500 mt-0.5" fontSize="small" />
                <div>
                  <div className="font-medium text-gray-800">시장 정보 즐겨찾기</div>
                  <div className="text-sm text-gray-600">자주 확인하는 시장을 저장하고 빠르게 접근</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="text-market-500 mt-0.5" fontSize="small" />
                <div>
                  <div className="font-medium text-gray-800">커뮤니티 참여</div>
                  <div className="text-sm text-gray-600">농업 정보 공유 및 직거래 게시판 이용</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircleIcon className="text-market-500 mt-0.5" fontSize="small" />
                <div>
                  <div className="font-medium text-gray-800">개인화된 대시보드</div>
                  <div className="text-sm text-gray-600">나만의 맞춤형 시장 정보 화면</div>
                </div>
              </div>
            </div>
          </div>

          {/* 이미 계정이 있는 경우 */}
          <div className="mt-8 p-4 bg-market-50 rounded-lg border border-market-200">
            <p className="text-market-800 text-center lg:text-left">
              이미 계정이 있으신가요? 
              <Link to="/login" className="font-semibold text-market-600 hover:text-market-700 ml-2">
                로그인하기 →
              </Link>
            </p>
          </div>
        </div>

        {/* 우측 회원가입 폼 */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <PersonAddIcon className="text-4xl text-market-500 mb-3" />
              <h3 className="text-2xl font-bold text-gray-800">회원가입</h3>
              <p className="text-gray-600 mt-2">새 계정을 만들어 서비스를 시작하세요</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  사용자명 *
                </label>
                <input
                  type="text"
                  name="username"
                  value={inputs.username}
                  onChange={handleChange}
                  placeholder="영문, 숫자로 구성된 사용자명"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-market-500 focus:border-market-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이름 *
                </label>
                <input
                  type="text"
                  name="name"
                  value={inputs.name}
                  onChange={handleChange}
                  placeholder="실명을 입력하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-market-500 focus:border-market-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  이메일 *
                </label>
                <input
                  type="email"
                  name="email"
                  value={inputs.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-market-500 focus:border-market-500 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  비밀번호 *
                </label>
                <input
                  type="password"
                  name="password"
                  value={inputs.password}
                  onChange={handleChange}
                  placeholder="8자 이상의 안전한 비밀번호"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-market-500 focus:border-market-500 transition-colors"
                  required
                  minLength={8}
                />
                <p className="mt-1 text-xs text-gray-500">
                  영문, 숫자, 특수문자를 포함하여 8자 이상 입력하세요
                </p>
              </div>

              {/* 이용약관 동의 */}
              <div className="space-y-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 rounded border-gray-300 text-market-600 focus:ring-market-500"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">[필수]</span> 이용약관에 동의합니다
                    <Link to="/terms" target="_blank" className="text-market-600 hover:text-market-700 ml-1">보기</Link>
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    required
                    className="mt-1 rounded border-gray-300 text-market-600 focus:ring-market-500"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium">[필수]</span> 개인정보 처리방침에 동의합니다
                    <Link to="/privacy" target="_blank" className="text-market-600 hover:text-market-700 ml-1">보기</Link>
                  </span>
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-gray-300 text-market-600 focus:ring-market-500"
                  />
                  <span className="text-sm text-gray-700">
                    [선택] 마케팅 정보 수신에 동의합니다
                  </span>
                </label>
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
                    회원가입 중...
                  </div>
                ) : (
                  '회원가입'
                )}
              </button>
            </form>

            {/* 카카오톡 회원가입 */}
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
                카카오톡으로 간편가입 (준비중)
              </button>
            </div>
          </div>

          {/* 추가 링크 */}
          <div className="text-center mt-6 text-sm text-gray-600">
            <p>
              계정이 이미 있으신가요? 
              <Link to="/login" className="text-market-600 hover:text-market-700 font-medium ml-1">
                로그인
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
