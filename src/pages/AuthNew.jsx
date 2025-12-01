import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { makeRequest } from '../axios';
import { API_BASE_URL } from '../config/api';
import toast from 'react-hot-toast';

const AuthNew = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // 상태 관리
  const [authStep, setAuthStep] = useState('choose'); // 'choose', 'phone', 'verify', 'kakao'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(true);

  // 카운트다운 타이머
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (countdown === 0 && !canResend) {
      setCanResend(true);
    }
    
    return () => clearInterval(timer);
  }, [countdown, canResend]);

  // 전화번호 포맷팅
  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  // 전화번호 입력 핸들러
  const handlePhoneChange = (e) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  // SMS 인증번호 발송
  const sendVerificationCode = async () => {
    if (!phoneNumber || phoneNumber.replace(/[^\d]/g, '').length !== 11) {
      toast.error('올바른 휴대폰 번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await makeRequest.post('/auth/send-verification', {
        phoneNumber: phoneNumber.replace(/[^\d]/g, '')
      });
      
      toast.success('인증번호가 발송되었습니다.');
      setAuthStep('verify');
      setCountdown(300); // 5분
      setCanResend(false);
    } catch (error) {
      toast.error(error.response?.data?.message || '인증번호 발송에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 인증번호 재발송
  const resendVerificationCode = async () => {
    if (!canResend) return;
    await sendVerificationCode();
  };

  // 인증번호 확인 및 로그인/회원가입
  const verifyAndLogin = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('6자리 인증번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const response = await makeRequest.post('/auth/verify-and-login', {
        phoneNumber: phoneNumber.replace(/[^\d]/g, ''),
        verificationCode
      });

      const { token, user, isNewUser } = response.data;
      
      // 토큰 저장
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast.success(isNewUser ? '회원가입이 완료되었습니다!' : '로그인되었습니다!');
      
      // 리다이렉트
      const redirectTo = location.state?.from?.pathname || '/';
      navigate(redirectTo, { replace: true });
      
    } catch (error) {
      toast.error(error.response?.data?.message || '인증에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 카카오 로그인
  const handleKakaoLogin = () => {
    const kakaoLoginUrl = `${API_BASE_URL}/auth/kakao`;
    window.location.href = kakaoLoginUrl;
  };

  // 인증 방법 선택 화면
  const renderChooseMethod = () => (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">메리디안 로그인</h1>
        <p className="text-gray-600">로그인 방법을 선택해주세요</p>
      </div>

      <div className="space-y-4">
        {/* 휴대폰 인증 로그인 */}
        <button
          onClick={() => setAuthStep('phone')}
          className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="text-2xl mr-3">📱</span>
          <span className="font-medium">휴대폰 번호로 로그인</span>
        </button>

        {/* 카카오 로그인 */}
        <button
          onClick={handleKakaoLogin}
          className="w-full flex items-center justify-center px-4 py-3 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors"
        >
          <span className="text-2xl mr-3">💬</span>
          <span className="font-medium">카카오톡으로 로그인</span>
        </button>
      </div>

      <div className="mt-8 text-center text-sm text-gray-500">
        <p>처음 이용하시는 경우 자동으로 회원가입됩니다.</p>
      </div>
    </div>
  );

  // 휴대폰 번호 입력 화면
  const renderPhoneInput = () => (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <button
          onClick={() => setAuthStep('choose')}
          className="mb-4 text-gray-500 hover:text-gray-700"
        >
          ← 뒤로가기
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">휴대폰 인증</h1>
        <p className="text-gray-600">휴대폰 번호를 입력해주세요</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            휴대폰 번호
          </label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={handlePhoneChange}
            placeholder="010-1234-5678"
            maxLength={13}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={sendVerificationCode}
          disabled={loading || !phoneNumber}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            loading || !phoneNumber
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-600 text-white hover:bg-green-700'
          }`}
        >
          {loading ? '발송 중...' : '인증번호 받기'}
        </button>
      </div>
    </div>
  );

  // 인증번호 입력 화면
  const renderVerification = () => (
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-lg p-8">
      <div className="text-center mb-8">
        <button
          onClick={() => setAuthStep('phone')}
          className="mb-4 text-gray-500 hover:text-gray-700"
        >
          ← 뒤로가기
        </button>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">인증번호 입력</h1>
        <p className="text-gray-600">
          {phoneNumber}로 발송된<br />
          인증번호 6자리를 입력해주세요
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            인증번호
          </label>
          <input
            type="number"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl tracking-widest"
          />
          
          {countdown > 0 && (
            <p className="text-sm text-gray-500 mt-2 text-center">
              남은 시간: {Math.floor(countdown / 60)}분 {countdown % 60}초
            </p>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={verifyAndLogin}
            disabled={loading || !verificationCode}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              loading || !verificationCode
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {loading ? '확인 중...' : '확인'}
          </button>

          <button
            onClick={resendVerificationCode}
            disabled={!canResend || loading}
            className={`w-full py-2 px-4 text-sm rounded-lg transition-colors ${
              !canResend || loading
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-green-600 hover:text-green-700 hover:bg-green-50'
            }`}
          >
            {!canResend ? `${countdown}초 후 재발송 가능` : '인증번호 재발송'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      {authStep === 'choose' && renderChooseMethod()}
      {authStep === 'phone' && renderPhoneInput()}
      {authStep === 'verify' && renderVerification()}
    </div>
  );
};

export default AuthNew;