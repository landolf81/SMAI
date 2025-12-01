import { createClient } from '@supabase/supabase-js'

// Supabase 클라이언트 설정
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
  // 현재 사용자 조회
  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error) throw error
    return user
  },

  // 현재 세션 조회
  getCurrentSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) throw error
    return session
  },

  // 사용자 프로필 조회
  getUserProfile: async (userId) => {
    console.log('🔍 getUserProfile 호출:', userId);

    // 타임아웃 설정 (3초) - 빠른 실패
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('getUserProfile 타임아웃 (3초)')), 3000)
    );

    const queryPromise = supabase
      .from('users')
      .select(`
        *,
        admin_roles (
          role,
          can_manage_posts,
          can_manage_tags,
          can_assign_tag_permissions,
          can_manage_users,
          can_manage_ads
        )
      `)
      .eq('id', userId)
      .single();

    const { data, error } = await Promise.race([queryPromise, timeoutPromise])
      .catch(err => {
        console.error('⏱️ Promise.race 에러:', err);
        return { data: null, error: err };
      })

    if (error) {
      console.error('❌ getUserProfile 에러:', error);
      console.error('에러 코드:', error.code);
      console.error('에러 메시지:', error.message);

      // PGRST116: 사용자를 찾을 수 없음 (프로필 미생성)
      if (error.code === 'PGRST116') {
        console.warn('⚠️ users 테이블에 프로필이 없습니다. 자동 생성 시도...');

        // Auth에서 사용자 정보 가져오기
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // users 테이블에 기본 프로필 생성
          const { data: newProfile, error: insertError } = await supabase
            .from('users')
            .insert([
              {
                id: userId,
                email: user.email,
                username: user.user_metadata?.username || user.email?.split('@')[0] || 'user',
                name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
                created_at: new Date().toISOString()
              }
            ])
            .select()
            .single();

          if (insertError) {
            console.error('❌ 프로필 자동 생성 실패:', insertError);
            throw error; // 원래 에러 throw
          }

          console.log('✅ 프로필 자동 생성 성공:', newProfile);
          return newProfile;
        }
      }

      throw error;
    }

    // admin_roles 정보를 기반으로 role 정보 추가
    // Supabase는 1:1 관계일 때 객체를 반환, 1:N 관계일 때 배열을 반환
    const adminRole = Array.isArray(data.admin_roles)
      ? data.admin_roles[0]
      : data.admin_roles;

    console.log('🔍 admin_roles 타입:', Array.isArray(data.admin_roles) ? '배열' : '객체', adminRole);

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

    console.log('✅ getUserProfile 성공:', userProfile);
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
  }
}

export default supabase
