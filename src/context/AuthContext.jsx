import React, { createContext, useEffect, useState } from "react";
import { supabase, supabaseHelpers } from "../config/supabase.js";
import { generateRandomId, generateRandomNickname } from "../utils/randomGenerator";

export const AuthContext = createContext();

// eslint-disable-next-line react/prop-types
export const AuthContextProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 세션 변경 감지 및 사용자 정보 업데이트
  useEffect(() => {
    // 초기 세션 확인
    const initializeAuth = async () => {
      try {
        console.log("🚀 인증 초기화 시작...");

        // OAuth 콜백 처리 중에는 프로필 체크를 건너뜀
        const isOAuthCallback = window.location.pathname === '/auth/callback';
        if (isOAuthCallback) {
          console.log("⏭️ OAuth 콜백 처리 중이므로 AuthContext 초기화를 건너뜁니다.");
          setLoading(false);
          return;
        }

        const { data: { session } } = await supabase.auth.getSession();
        console.log("📝 세션 확인:", session ? "로그인됨" : "로그아웃됨");

        if (session?.user) {
          // 사용자 프로필 정보 조회
          console.log("🔍 초기 프로필 조회 시작:", session.user.id);
          const userProfile = await supabaseHelpers.getUserProfile(session.user.id);
          console.log("✅ 초기 프로필 조회 성공:", userProfile);
          setCurrentUser(userProfile);
        } else {
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("❌ 세션 초기화 오류:", error);
        console.error("오류 상세:", error.message, error.details, error.hint);

        // 프로필 조회 실패 시 로그아웃 처리
        console.warn("⚠️ 프로필 조회 실패로 인해 로그아웃 처리합니다.");
        await supabase.auth.signOut();
        setCurrentUser(null);
      } finally {
        console.log("✅ 로딩 완료");
        setLoading(false);
      }
    };

    initializeAuth();

    // 인증 상태 변경 리스너
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log("🔔 Auth state changed:", event);

        // OAuth 콜백 처리 중에는 건너뜀
        const isOAuthCallback = window.location.pathname === '/auth/callback';
        if (isOAuthCallback) {
          console.log("⏭️ OAuth 콜백 처리 중이므로 Auth state change 무시");
          return;
        }

        // SIGNED_IN, TOKEN_REFRESHED 같은 이벤트는 프로필 재조회 불필요
        // SIGNED_IN: login 함수에서 이미 처리
        // TOKEN_REFRESHED: 백그라운드 토큰 갱신 (프로필 변경 없음)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log(`⏭️ ${event} 이벤트는 프로필 재조회 불필요, 스킵`);
          return;
        }

        if (session?.user) {
          // 이미 currentUser가 설정되어 있고 같은 사용자면 스킵
          if (currentUser?.id === session.user.id) {
            console.log("⏭️ 동일 사용자 프로필 이미 로드됨, 스킵");
            return;
          }

          try {
            console.log("🔍 사용자 프로필 조회 시작:", session.user.id);
            const userProfile = await supabaseHelpers.getUserProfile(session.user.id);
            console.log("✅ 프로필 조회 성공:", userProfile);
            setCurrentUser(userProfile);
          } catch (error) {
            console.error("❌ 프로필 조회 오류:", error);
            console.error("오류 상세:", error.message, error.details, error.hint);
            // 프로필 조회 실패해도 로그아웃하지 않음 (토큰은 유효)
          }
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
        }
      }
    );

    // 클린업
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const login = async (inputs) => {
    try {
      // Supabase Auth로 로그인
      const { data, error } = await supabase.auth.signInWithPassword({
        email: inputs.username, // username을 email로 사용
        password: inputs.password,
      });

      if (error) throw error;

      // 사용자 프로필 정보 조회
      const userProfile = await supabaseHelpers.getUserProfile(data.user.id);
      setCurrentUser(userProfile);

      return userProfile;
    } catch (error) {
      console.error("로그인 오류:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setCurrentUser(null);
    } catch (error) {
      console.error("로그아웃 오류:", error);
      // 오류가 발생해도 로컬 상태는 초기화
      setCurrentUser(null);
      throw error;
    }
  };

  const register = async ({ username, email, password, name }) => {
    try {
      // 중복 체크 및 재생성 (최대 10회 시도)
      let finalUsername = username;
      let finalName = name;

      // username 중복 체크
      for (let i = 0; i < 10; i++) {
        const exists = await supabaseHelpers.checkUsernameExists(finalUsername);
        if (!exists) break;
        finalUsername = generateRandomId();
        if (i === 9) throw new Error('사용자명 생성에 실패했습니다. 다시 시도해주세요.');
      }

      // name 중복 체크
      for (let i = 0; i < 10; i++) {
        const exists = await supabaseHelpers.checkNameExists(finalName);
        if (!exists) break;
        finalName = generateRandomNickname();
        if (i === 9) throw new Error('별명 생성에 실패했습니다. 다시 시도해주세요.');
      }

      // Supabase Auth에 사용자 등록
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: finalUsername,
            name: finalName
          }
        }
      });

      if (authError) throw authError;

      console.log("✅ 회원가입 완료:", authData.user.id);

      // 프로필 직접 생성
      console.log("⏳ 프로필 생성 중...");
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: email,
          username: finalUsername,
          name: finalName,
          created_at: new Date().toISOString()
        });

      if (profileError) {
        // 이미 존재하는 경우 무시 (Trigger가 먼저 생성했을 수 있음)
        if (profileError.code !== '23505') {
          console.error("❌ 프로필 생성 실패:", profileError);
          throw profileError;
        }
        console.log("ℹ️ 프로필이 이미 존재함");
      } else {
        console.log("✅ 프로필 생성 완료");
      }

      // 생성된 프로필 조회
      await new Promise(resolve => setTimeout(resolve, 500));
      const userProfile = await supabaseHelpers.getUserProfile(authData.user.id);
      console.log("✅ 프로필 조회 완료:", userProfile);
      setCurrentUser(userProfile);

      return userProfile;
    } catch (error) {
      console.error("회원가입 오류:", error);
      throw error;
    }
  };

  const updateUserProfile = async (updates) => {
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', currentUser.id);

      if (error) throw error;

      // 업데이트된 프로필 정보 조회
      const updatedProfile = await supabaseHelpers.getUserProfile(currentUser.id);
      setCurrentUser(updatedProfile);

      return updatedProfile;
    } catch (error) {
      console.error("프로필 업데이트 오류:", error);
      throw error;
    }
  };

  // 카카오 로그인
  const loginWithKakao = async () => {
    try {
      console.log("🟡 카카오 로그인 시작...");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: window.location.origin + '/auth/callback',
          // scopes를 지정하지 않아 Supabase 기본값 사용
          // 카카오 개발자 콘솔에서 활성화된 동의 항목만 요청됨
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error("❌ 카카오 로그인 오류:", error);
      throw error;
    }
  };

  // 차단된 사용자인지 확인
  const isBanned = currentUser?.status === 'banned';

  const value = {
    currentUser,
    loading,
    isBanned,
    login,
    logout,
    register,
    updateUserProfile,
    loginWithKakao
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
