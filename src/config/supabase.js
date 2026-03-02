import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 설정
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

// Supabase URL export (이미지 URL 구성 등에 사용)
export const SUPABASE_URL = supabaseUrl

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL과 Anon Key가 .env 파일에 설정되어 있지 않습니다.')
}

// Supabase 클라이언트 생성
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'meridian-auth-token'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'meridian-app'
    }
  }
})

// 헬퍼 함수들
export const supabaseHelpers = {
  // 현재 사용자 조회 (캐시된 세션 사용 - 읽기 전용)
  getCurrentUser: async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session?.user || null
  },

  // 현재 세션 조회
  getCurrentSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  // 사용자 프로필 조회
  getUserProfile: async (userId) => {
    // 타임아웃 설정 (3초) - 빠른 실패
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getUserProfile 타임아웃 (3초)')), 3000)
    );

    // 1. users 테이블 조회
    const userQueryPromise = supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    const { data, error } = await Promise.race([userQueryPromise, timeoutPromise])
      .catch(err => {
        console.error('⏱️ Promise.race 에러:', err);
        return { data: null, error: err };
      });

    if (error) {
      console.error('❌ getUserProfile 에러:', error);
      console.error('에러 코드:', error.code);
      console.error('에러 메시지:', error.message);

      // PGRST116: 사용자를 찾을 수 없음 (프로필 미생성)
      if (error.code === 'PGRST116') {
        console.warn('⚠️ users 테이블에 프로필이 없습니다.');
        console.warn('⚠️ AuthCallback.jsx에서 프로필을 생성해야 합니다.');
        console.warn('⚠️ 여기서는 자동 생성을 시도하지 않습니다.');

        // 프로필이 없으면 원래 에러를 throw하여 로그아웃 처리
        // AuthCallback.jsx나 register에서 제대로 프로필을 생성하도록 유도
        throw error;
      }

      throw error;
    }

    // 2. admin_roles 테이블 별도 조회 (외래키 조인 문제 우회)
    let adminRole = null;
    try {
      const { data: adminRoleData, error: adminError } = await supabase
        .from('admin_roles')
        .select('role, can_manage_posts, can_manage_tags, can_assign_tag_permissions, can_manage_users, can_manage_ads')
        .eq('user_id', userId)
        .maybeSingle();

      if (!adminError) {
        adminRole = adminRoleData;
      }
    } catch (e) {
      // admin_roles 조회 실패해도 일반 사용자로 진행
    }

    const userProfile = {
      ...data,
      role: adminRole?.role || 'user',
      isAdmin: !!adminRole?.role,
      isSuperAdmin: adminRole?.role === 'super_admin',
      permissions: {
        canManagePosts: adminRole?.can_manage_posts || adminRole?.role === 'super_admin',
        canManageTags: adminRole?.can_manage_tags || adminRole?.role === 'super_admin',
        canAssignTagPermissions: adminRole?.can_assign_tag_permissions || adminRole?.role === 'super_admin',
        canManageUsers: adminRole?.can_manage_users || adminRole?.role === 'super_admin',
        canManageAds: adminRole?.can_manage_ads || adminRole?.role === 'super_admin'
      }
    };

    return userProfile;
  },

  // 파일 업로드
  uploadFile: async (bucket, path, file) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) throw error
    return data
  },

  // 파일 URL 조회
  getFileUrl: (bucket, path) => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return data.publicUrl
  },

  // 파일 삭제
  deleteFile: async (bucket, path) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove([path])

    if (error) throw error
    return data
  },

  // username 중복 체크
  checkUsernameExists: async (username) => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (error) throw error
    return !!data
  },

  // name(별명) 중복 체크
  checkNameExists: async (name) => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('name', name)
      .maybeSingle()

    if (error) throw error
    return !!data
  }
}

export default supabase
