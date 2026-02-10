import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseHelpers } from '../config/supabase';
import { generateRandomId, generateRandomNickname } from '../utils/randomGenerator';
import LoadingSpinner from '../components/LoadingSpinner';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('처리 중...');
  const [error, setError] = useState(null);

  // v2.0 - 불완전한 프로필 자동 정리 및 재시도 로직 추가

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
          console.error('🚨 URL에서 에러 파라미터 발견:');
          console.error('에러:', errorParam);
          console.error('에러 설명:', errorDescription);
          console.error('전체 URL:', window.location.href);
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
          .is('deleted_at', null)  // 탈퇴하지 않은 활성 사용자만
          .maybeSingle();

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('프로필 조회 오류:', profileError);
        }

        // 프로필이 없으면 생성 (탈퇴 및 불완전 프로필 처리 포함)
        if (!existingProfile) {
          console.log('🆕 신규 사용자 - 프로필 생성 중...');
          setStatus('프로필 생성 중...');

          // 카카오에서 받은 사용자 정보
          const kakaoUser = user.user_metadata || {};
          // 이메일이 없을 수 있음 (카카오 동의 항목에서 선택 또는 미동의)
          const kakaoEmail = user.email || kakaoUser.email || null;
          // 프로필 이미지는 기본적으로 가져오지 않음 (사용자가 직접 설정)
          const kakaoProfileImage = '';

          // 고유한 username과 name 생성
          // username: 랜덤 6자리 + 사용자 ID 뒤 4자리 = 더 높은 유니크성
          const userIdSuffix = user.id.slice(-4);
          let username = `${generateRandomId()}${userIdSuffix}`;
          // name: 카카오 프로필명 사용하지 않고 랜덤 닉네임 생성
          let name = generateRandomNickname();

          // username 중복 체크 (최대 10회 시도)
          for (let i = 0; i < 10; i++) {
            const exists = await supabaseHelpers.checkUsernameExists(username);
            if (!exists) {
              console.log(`✅ 사용 가능한 username 찾음: ${username} (${i + 1}번째 시도)`);
              break;
            }
            console.log(`⚠️ username 중복: ${username}, 재생성 중...`);
            username = `${generateRandomId()}${userIdSuffix}`;
          }

          // name 중복 체크 (최대 10회 시도)
          for (let i = 0; i < 10; i++) {
            const exists = await supabaseHelpers.checkNameExists(name);
            if (!exists) {
              console.log(`✅ 사용 가능한 name 찾음: ${name} (${i + 1}번째 시도)`);
              break;
            }
            console.log(`⚠️ name 중복: ${name}, 재생성 중...`);
            name = generateRandomNickname();
          }

          // 이전에 생성된 프로필(탈퇴 또는 불완전)이 있는지 확인하고 정리
          const { data: anyExistingProfile } = await supabase
            .from('users')
            .select('id, username, deleted_at')
            .eq('id', user.id)
            .maybeSingle();

          if (anyExistingProfile) {
            console.log('⚠️ 이전 프로필 발견:', anyExistingProfile);

            if (anyExistingProfile.deleted_at) {
              // 탈퇴한 사용자는 재가입 불가
              throw new Error('탈퇴한 계정입니다. 탈퇴한 계정으로는 재가입이 불가능합니다.');
            } else {
              // 불완전한 프로필(생성 중 오류) - 삭제 후 재생성
              console.log('⚠️ 불완전한 프로필 삭제 중...');
              await supabase
                .from('users')
                .delete()
                .eq('id', user.id);
              console.log('✅ 불완전한 프로필 삭제 완료');
            }
          }

          // 프로필 생성 (재시도 로직 포함)
          let insertSuccess = false;
          let retryCount = 0;
          const maxRetries = 5;

          while (!insertSuccess && retryCount < maxRetries) {
            const newUserData = {
              id: user.id,
              email: kakaoEmail,
              username: username,
              name: name,
              profile_pic: kakaoProfileImage,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };

            console.log(`📝 생성할 사용자 데이터 (${retryCount + 1}/${maxRetries}):`, JSON.stringify(newUserData, null, 2));

            const { error: insertError } = await supabase
              .from('users')
              .insert([newUserData]);

            if (insertError) {
              console.error('프로필 생성 오류:', insertError);
              console.error('에러 코드:', insertError.code);
              console.error('에러 메시지:', insertError.message);
              console.error('에러 상세:', insertError.details);

              // username 또는 name 중복 오류 (23505)
              if (insertError.code === '23505') {
                const errorDetail = insertError.message || '';

                // Primary Key (id) 중복인 경우 - 이미 프로필이 생성됨
                if (errorDetail.includes('pkey') || errorDetail.includes('users_pkey')) {
                  console.log('✅ 프로필이 이미 생성되어 있습니다. (동시성 문제)');
                  insertSuccess = true;
                  break;
                }

                retryCount++;
                console.warn(`⚠️ 중복 키 오류 발생, 재시도 중... (${retryCount}/${maxRetries})`);

                // 에러 메시지에서 어떤 필드가 중복인지 확인
                if (errorDetail.includes('username')) {
                  console.log('🔄 username 재생성');
                  username = `${generateRandomId()}${userIdSuffix}`;
                } else if (errorDetail.includes('name')) {
                  console.log('🔄 name 재생성');
                  name = generateRandomNickname();
                } else {
                  // 어떤 필드인지 모르면 둘 다 재생성
                  console.log('🔄 username과 name 모두 재생성');
                  username = `${generateRandomId()}${userIdSuffix}`;
                  name = generateRandomNickname();
                }

                // 대기 시간을 점진적으로 증가 (exponential backoff)
                const delay = 100 * Math.pow(2, retryCount - 1);
                console.log(`⏳ ${delay}ms 대기 후 재시도...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
              } else {
                // 23505가 아닌 다른 에러는 즉시 throw
                throw new Error(`프로필 생성 실패: ${insertError.message || '알 수 없는 오류'}`);
              }
            } else {
              insertSuccess = true;
              console.log('✅ 프로필 생성 완료');
            }
          }

          // 최대 재시도 횟수를 초과한 경우
          if (!insertSuccess) {
            throw new Error('프로필 생성 실패: 최대 재시도 횟수 초과 (중복 키 문제). 브라우저 캐시를 삭제하고 다시 시도해주세요.');
          }
        } else {
          console.log('✅ 기존 사용자 확인됨');
        }

        setStatus('로그인 완료! 이동 중...');
        console.log('✅ 로그인 완료! 이동 중...');

        // 메인 페이지로 이동하면서 새로고침하여 AuthContext가 프로필을 로드하도록 함
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.href = '/';

      } catch (err) {
        console.error('❌ OAuth 콜백 오류:', err);
        setError(err.message || '로그인 처리 중 오류가 발생했습니다.');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloud-dancer px-4">
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
    <div className="min-h-screen flex items-center justify-center bg-cloud-dancer px-4">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <LoadingSpinner size="lg" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">카카오 로그인</h2>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
};

export default AuthCallback;
