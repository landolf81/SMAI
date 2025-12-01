import { supabase } from '../config/supabase.js';
import { storageService } from './storageService.js';

/**
 * 사용자 서비스
 * 모든 사용자 관련 Supabase 쿼리를 중앙화
 */
export const userService = {
  /**
   * 사용자 프로필 조회
   * @param {string} userId - 사용자 ID
   */
  async getUser(userId) {
    try {
      const { data, error } = await supabase
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

      if (error) throw error;

      // Supabase는 1:1 관계일 때 객체를 반환, 1:N 관계일 때 배열을 반환
      const adminRole = Array.isArray(data.admin_roles)
        ? data.admin_roles[0]
        : data.admin_roles;

      return {
        ...data,
        // camelCase 필드명 매핑
        profilePic: data.profile_pic,
        coverPic: data.cover_pic,
        role: adminRole?.role || 'member',
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
    } catch (error) {
      console.error('사용자 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 목록 조회 (관리자용, 검색 지원)
   * @param {Object} options - 조회 옵션
   * @param {string} options.search - 검색어 (username, name, email)
   * @param {number} options.limit - 최대 결과 수 (기본값: 20)
   */
  async getUsers(options = {}) {
    try {
      const { search = '', limit = 20 } = options;

      let query = supabase
        .from('users')
        .select(`
          id,
          username,
          name,
          email,
          profile_pic,
          created_at,
          admin_roles (
            role
          )
        `);

      // 검색 조건 추가
      if (search) {
        query = query.or(`username.ilike.%${search}%,name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      query = query
        .order('created_at', { ascending: false })
        .limit(limit);

      const { data, error } = await query;

      if (error) throw error;

      const users = data.map(user => {
        // Supabase는 1:1 관계일 때 객체를 반환, 1:N 관계일 때 배열을 반환
        const adminRole = Array.isArray(user.admin_roles)
          ? user.admin_roles[0]
          : user.admin_roles;

        return {
          ...user,
          role: adminRole?.role || 'member',
          profilePic: user.profile_pic, // 원본 필드값 유지
          profilePicUrl: storageService.getProfileImageUrl(user.profile_pic, user.id) // Supabase Storage URL
        };
      });

      return { users }; // { users } 형태로 반환 (AdminBadgesNew 기대 형식)
    } catch (error) {
      console.error('사용자 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 프로필 업데이트
   * @param {string} userId - 사용자 ID
   * @param {Object} updates - 업데이트할 데이터
   */
  async updateUser(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          name: updates.name,
          profile_pic: updates.profilePic,
          cover_pic: updates.coverPic,
          city: updates.city,
          website: updates.website,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('사용자 업데이트 오류:', error);
      throw error;
    }
  },

  /**
   * 현재 사용자 프로필 업데이트 (Update 컴포넌트용)
   * @param {Object} userData - 업데이트할 사용자 데이터
   */
  async updateProfile(userData) {
    try {
      // 현재 로그인한 사용자 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      console.log('🔄 프로필 업데이트 시작:', { userId: user.id, userData });

      // 업데이트할 필드만 추출
      const updateData = {};
      if (userData.name !== undefined) updateData.name = userData.name;
      if (userData.bio !== undefined) updateData.bio = userData.bio;
      if (userData.profilePic !== undefined) updateData.profile_pic = userData.profilePic;
      if (userData.coverPic !== undefined) updateData.cover_pic = userData.coverPic;

      updateData.updated_at = new Date().toISOString();

      console.log('💾 실제 업데이트 데이터:', updateData);

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (error) {
        console.error('❌ 프로필 업데이트 실패:', error);
        throw error;
      }

      console.log('✅ 프로필 업데이트 성공:', data);
      return data;
    } catch (error) {
      console.error('프로필 업데이트 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 게시물 조회
   * @param {string} userId - 사용자 ID
   */
  async getUserPosts(userId) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          post_tags (
            tags (
              id,
              name,
              color
            )
          ),
          likes:likes(count),
          comments:comments(count)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(post => ({
        ...post,
        tags: post.post_tags?.map(pt => pt.tags) || [],
        likesCount: post.likes?.[0]?.count || 0,
        commentsCount: post.comments?.[0]?.count || 0
      }));
    } catch (error) {
      console.error('사용자 게시물 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자가 좋아요한 게시물 조회
   * @param {string} userId - 사용자 ID
   */
  async getUserLikedPosts(userId) {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select(`
          post_id,
          created_at,
          posts (
            *,
            users:user_id (
              id,
              username,
              name,
              profile_pic
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(like => ({
        ...like.posts,
        user: like.posts.users,
        tags: [],
        liked_at: like.created_at
      }));
    } catch (error) {
      console.error('좋아요한 게시물 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 댓글 조회
   * @param {string} userId - 사용자 ID
   */
  async getUserComments(userId) {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          posts (
            id,
            title,
            description,
            user_id,
            users:user_id (
              username,
              name
            )
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(comment => ({
        ...comment,
        desc: comment.description,
        post: comment.posts ? {
          ...comment.posts,
          desc: comment.posts.description,
          content: comment.posts.description,
          username: comment.posts.users?.username,
          name: comment.posts.users?.name
        } : null
      }));
    } catch (error) {
      console.error('사용자 댓글 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 통계 조회
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 사용자 통계 (게시물 수, 댓글 수)
   */
  async getUserStats(userId) {
    try {
      // 게시물 수 카운트
      const { count: postsCount, error: postsError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (postsError) throw postsError;

      // 댓글 수 카운트
      const { count: commentsCount, error: commentsError } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (commentsError) throw commentsError;

      return {
        posts: postsCount || 0,
        comments: commentsCount || 0
      };
    } catch (error) {
      console.error('사용자 통계 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 현재 로그인한 사용자의 권한 정보 조회
   */
  async getCurrentUserPermissions() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      return await this.getUser(user.id);
    } catch (error) {
      console.error('사용자 권한 정보 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 특정 태그에 대한 사용자 권한 확인
   * @param {string} tagId - 태그 ID
   * @param {string} permissionType - 권한 타입 ('read', 'write', 'manage')
   */
  async checkTagPermission(tagId, permissionType = 'write') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // 관리자 권한 확인
      const userData = await this.getUser(user.id);
      if (userData.isSuperAdmin || userData.permissions?.canManageTags) {
        return true;
      }

      // user_tag_permissions 테이블에서 권한 확인
      const { data, error } = await supabase
        .from('user_tag_permissions')
        .select('permission_type')
        .eq('user_id', user.id)
        .eq('tag_id', tagId)
        .eq('permission_type', permissionType)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      return !!data;
    } catch (error) {
      console.error('태그 권한 확인 오류:', error);
      return false;
    }
  },

  /**
   * 사용자가 작성 가능한 태그 목록 조회
   */
  async getWritableTags() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // 관리자는 모든 태그에 쓰기 가능
      const userData = await this.getUser(user.id);
      if (userData.isSuperAdmin || userData.permissions?.canManageTags) {
        const { data: allTags, error } = await supabase
          .from('tags')
          .select('*')
          .order('display_name');

        if (error) throw error;
        return allTags || [];
      }

      // 일반 사용자: 권한이 있는 태그만
      const { data, error } = await supabase
        .from('user_tag_permissions')
        .select(`
          tags (
            id,
            name,
            display_name,
            color,
            group_id
          )
        `)
        .eq('user_id', user.id)
        .eq('permission_type', 'write');

      if (error) throw error;

      return data?.map(p => p.tags).filter(Boolean) || [];
    } catch (error) {
      console.error('작성 가능한 태그 조회 오류:', error);
      return [];
    }
  },

  /**
   * 사용자에게 태그 권한 부여
   * @param {Object} permissionData - 권한 데이터
   */
  async grantTagPermission(permissionData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 권한 부여 권한 확인
      const userData = await this.getUser(user.id);
      if (!userData.isSuperAdmin && !userData.permissions?.canAssignTagPermissions) {
        throw new Error('권한 부여 권한이 없습니다.');
      }

      const { data, error } = await supabase
        .from('user_tag_permissions')
        .insert([{
          user_id: permissionData.userId,
          tag_id: permissionData.tagId,
          permission_type: permissionData.permissionType || 'write',
          granted_by: user.id,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 권한 부여 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자의 태그 권한 조회
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Array>} 권한 목록
   */
  async getUserTagPermissions(userId) {
    try {
      const { data, error } = await supabase
        .from('user_tag_permissions')
        .select(`
          *,
          tags:tag_id (
            id,
            name,
            display_name
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(permission => ({
        ...permission,
        tag_display_name: permission.tags?.display_name || permission.tags?.name
      }));
    } catch (error) {
      console.error('사용자 태그 권한 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 일괄 태그 권한 부여
   * @param {Object} data - 일괄 권한 부여 데이터
   * @param {Array<string>} data.userIds - 사용자 ID 배열
   * @param {string} data.tagId - 태그 ID
   * @param {string} data.permissionType - 권한 타입
   * @param {string} data.expiresAt - 만료일 (선택)
   */
  async bulkGrantTagPermissions(data) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 권한 부여 권한 확인
      const userData = await this.getUser(user.id);
      if (!userData.isSuperAdmin && !userData.permissions?.canAssignTagPermissions) {
        throw new Error('권한 부여 권한이 없습니다.');
      }

      // 모든 사용자에게 권한 부여
      const permissions = data.userIds.map(userId => ({
        user_id: userId,
        tag_id: data.tagId,
        permission_type: data.permissionType || 'write',
        expires_at: data.expiresAt || null,
        granted_by: user.id,
        created_at: new Date().toISOString()
      }));

      const { data: result, error } = await supabase
        .from('user_tag_permissions')
        .insert(permissions)
        .select();

      if (error) throw error;

      return result;
    } catch (error) {
      console.error('일괄 태그 권한 부여 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자의 태그 권한 제거
   * @param {string} permissionId - 권한 ID
   */
  async revokeTagPermission(permissionId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 권한 부여 권한 확인
      const userData = await this.getUser(user.id);
      if (!userData.isSuperAdmin && !userData.permissions?.canAssignTagPermissions) {
        throw new Error('권한 제거 권한이 없습니다.');
      }

      const { error } = await supabase
        .from('user_tag_permissions')
        .delete()
        .eq('id', permissionId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('태그 권한 제거 오류:', error);
      throw error;
    }
  },

  // ===== Admin 메서드 =====

  /**
   * 관리자용 사용자 목록 조회 (필터링 및 페이징 지원)
   * @param {Object} options - 조회 옵션
   * @param {number} options.page - 페이지 번호
   * @param {number} options.limit - 페이지당 항목 수
   * @param {string} options.search - 검색어 (username, email)
   * @param {string} options.role - 역할 필터 ('all', 'admin', 'moderator', 'user')
   * @param {string} options.status - 상태 필터 ('all', 'active', 'banned', 'inactive')
   */
  async getAdminUsers(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        search = '',
        role = 'all',
        status = 'all'
      } = options;

      // 기본 쿼리
      let query = supabase
        .from('users')
        .select(`
          id,
          username,
          name,
          email,
          profile_pic,
          created_at,
          status,
          admin_roles (
            role
          )
        `, { count: 'exact' });

      // 검색 조건
      if (search) {
        query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%,name.ilike.%${search}%`);
      }

      // 상태 필터
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      // 데이터 가져오기
      const { data: users, error, count } = await query
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      // 역할 정보 추가 및 필터링
      let processedUsers = users.map(user => {
        // Supabase는 1:1 관계일 때 객체를 반환, 1:N 관계일 때 배열을 반환
        const adminRole = Array.isArray(user.admin_roles)
          ? user.admin_roles[0]
          : user.admin_roles;

        return {
          ...user,
          role: adminRole?.role || 'member',
          posts_count: 0, // 클라이언트에서 별도 조회 또는 집계 쿼리 필요
          comments_count: 0
        };
      });

      // 역할 필터 (클라이언트 사이드)
      if (role !== 'all') {
        processedUsers = processedUsers.filter(user => user.role === role);
      }

      return {
        users: processedUsers,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      console.error('관리자용 사용자 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 상태 변경
   * @param {string} userId - 사용자 ID
   * @param {string} status - 새로운 상태 ('active', 'banned', 'inactive')
   */
  async updateUserStatus(userId, status) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('사용자 상태 변경 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 역할 변경
   * @param {string} userId - 사용자 ID
   * @param {string} role - 새로운 역할 ('member', 'advertiser', 'content_admin', 'market_admin', 'super_admin')
   */
  async updateUserRole(userId, role) {
    try {
      console.log('📝 updateUserRole 호출:', { userId, role });

      if (role === 'member') {
        // member 역할이면 admin_roles에서 제거
        console.log('🗑️ admin_roles에서 제거 시도...');
        const { error } = await supabase
          .from('admin_roles')
          .delete()
          .eq('user_id', userId);

        if (error) {
          console.error('❌ admin_roles 삭제 실패:', error);
          throw error;
        }

        console.log('✅ admin_roles 삭제 완료');
        return { success: true, role: 'member' };
      } else {
        // 역할별 권한 정의
        const permissions = {
          super_admin: {
            can_manage_posts: true,
            can_manage_tags: true,
            can_assign_tag_permissions: true,
            can_manage_users: true,
            can_manage_ads: true
          },
          market_admin: {
            can_manage_posts: true,
            can_manage_tags: false,
            can_assign_tag_permissions: false,
            can_manage_users: false,
            can_manage_ads: false
          },
          content_admin: {
            can_manage_posts: true,
            can_manage_tags: true,
            can_assign_tag_permissions: false,
            can_manage_users: false,
            can_manage_ads: false
          },
          advertiser: {
            can_manage_posts: false,
            can_manage_tags: false,
            can_assign_tag_permissions: false,
            can_manage_users: false,
            can_manage_ads: true
          }
        };

        const rolePermissions = permissions[role] || permissions.content_admin;
        console.log('🔑 권한 설정:', rolePermissions);

        const upsertData = {
          user_id: userId,
          role,
          ...rolePermissions,
          updated_at: new Date().toISOString()
        };
        console.log('💾 Upsert 데이터:', upsertData);

        const { data, error } = await supabase
          .from('admin_roles')
          .upsert(upsertData, {
            onConflict: 'user_id'
          })
          .select()
          .single();

        if (error) {
          console.error('❌ admin_roles upsert 실패:', error);
          console.error('에러 코드:', error.code);
          console.error('에러 메시지:', error.message);
          console.error('에러 상세:', error.details);
          throw error;
        }

        console.log('✅ admin_roles upsert 완료:', data);
        return data;
      }
    } catch (error) {
      console.error('❌ 사용자 역할 변경 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자 삭제
   * @param {string} userId - 사용자 ID
   */
  async deleteUser(userId) {
    try {
      // 먼저 관련 데이터 삭제 (순서 중요)
      // 1. admin_roles 삭제
      await supabase.from('admin_roles').delete().eq('user_id', userId);

      // 2. user_tag_permissions 삭제
      await supabase.from('user_tag_permissions').delete().eq('user_id', userId);

      // 3. likes 삭제
      await supabase.from('likes').delete().eq('user_id', userId);

      // 4. comments 삭제
      await supabase.from('comments').delete().eq('user_id', userId);

      // 5. posts 삭제
      await supabase.from('posts').delete().eq('user_id', userId);

      // 6. 사용자 삭제
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      throw error;
    }
  }
};

export default userService;
