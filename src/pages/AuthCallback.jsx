import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseHelpers } from '../config/supabase';
import { generateRandomId, generateRandomNickname } from '../utils/randomGenerator';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('처리 중...');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('🔄 OAuth 콜백 처리 시작...');

        // URL에서 에러 확인
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const queryParams = new URLSearchParams(window.location.search);

        const errorParam = hashParams.get('error') || queryParams.get('error');
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');

        if (errorParam) {
          throw new Error(errorDescription || errorParam);
        }

        // 세션 확인
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session?.user) {
          // 세션이 없으면 다시 시도
          console.log('⏳ 세션 대기 중...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession?.user) {
            throw new Error('로그인 세션을 찾을 수 없습니다.');
          }
        }

        const user = session?.user || (await supabase.auth.getSession()).data.session?.user;
        console.log('✅ 사용자 인증 완료:', user.id);

        // 기존 프로필 확인
        setStatus('프로필 확인 중...');
        const { data: existingProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('프로필 조회 오류:', profileError);
        }

        // 프로필이 없으면 생성
        if (!existingProfile) {
          console.log('🆕 신규 사용자 - 프로필 생성 중...');
          setStatus('프로필 생성 중...');

          // 카카오에서 받은 사용자 정보
          const kakaoUser = user.user_metadata || {};
          const kakaoName = kakaoUser.name || kakaoUser.full_name || kakaoUser.preferred_username || '';
          // 이메일이 없을 수 있음 (카카오 동의 항목에서 선택 또는 미동의)
          const kakaoEmail = user.email || kakaoUser.email || null;
          const kakaoProfileImage = kakaoUser.avatar_url || kakaoUser.picture || '';

          // 고유한 username과 name 생성
          let username = generateRandomId();
          let name = kakaoName || generateRandomNickname();

          // username 중복 체크
          for (let i = 0; i < 10; i++) {
            const exists = await supabaseHelpers.checkUsernameExists(username);
            if (!exists) break;
            username = generateRandomId();
          }

          // name 중복 체크
          for (let i = 0; i < 10; i++) {
            const exists = await supabaseHelpers.checkNameExists(name);
            if (!exists) break;
            name = generateRandomNickname();
          }

          // 프로필 생성
          const { error: insertError } = await supabase
            .from('users')
            .insert([{
              id: user.id,
              email: kakaoEmail,
              username: username,
              name: name,
              profile_pic: kakaoProfileImage,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (insertError) {
            console.error('프로필 생성 오류:', insertError);
            // 이미 존재하는 경우 무시 (동시성 문제)
            if (insertError.code !== '23505') {
              throw insertError;
            }
          } else {
            console.log('✅ 프로필 생성 완료');
          }
        } else {
          console.log('✅ 기존 사용자 확인됨');
        }

        setStatus('로그인 완료! 이동 중...');

        // 잠시 대기 후 메인 페이지로 이동
        await new Promise(resolve => setTimeout(resolve, 500));
        navigate('/', { replace: true });

      } catch (err) {
        console.error('❌ OAuth 콜백 오류:', err);
        setError(err.message || '로그인 처리 중 오류가 발생했습니다.');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">로그인 실패</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="btn btn-primary"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center">
        <div className="loading loading-spinner loading-lg text-primary mb-4"></div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">카카오 로그인</h2>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
