import { supabase } from '../config/supabase.js';

/** 게시물 열람·저장·고정·인기 조회 메서드. postService에 합성해 기존 API를 유지한다. */
export const postEngagementMethods = {
  /**
   * 게시물 열람 기록 저장 (피드 알고리즘용)
   * @param {string|number} postId - 게시물 ID
   */
  async recordPostView(postId) {
    try {
      // 읽기 전용 세션 사용 (열람 기록은 빈번하게 호출되므로 getUser HTTP 요청 회피)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { success: false, reason: 'not_logged_in' };

      const postIdInt = parseInt(postId, 10);
      if (isNaN(postIdInt)) {
        console.warn('유효하지 않은 postId:', postId);
        return { success: false, reason: 'invalid_post_id' };
      }

      // RPC 함수 사용하여 upsert 처리 (중복 키 에러 방지)
      const { error } = await supabase.rpc('upsert_user_post_view', {
        p_user_id: user.id,
        p_post_id: postIdInt
      });

      if (error) {
        // RPC 함수가 없으면 기존 방식 시도 (PGRST202: 함수 없음, 42883: 시그니처 없음)
        if (error.code === '42883' || error.code === 'PGRST202') {
          // 기존 기록 확인
          const { data: existingView } = await supabase
            .from('user_post_views')
            .select('view_count')
            .eq('user_id', user.id)
            .eq('post_id', postIdInt)
            .maybeSingle();

          if (existingView) {
            // 기존 기록 있으면 업데이트 (횟수 증가는 생략 - 조회 시간만 업데이트)
            await supabase
              .from('user_post_views')
              .update({ viewed_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .eq('post_id', postIdInt);
            return { success: true, reason: 'updated' };
          } else {
            // 신규 기록 추가
            const { error: insertError } = await supabase
              .from('user_post_views')
              .insert({
                user_id: user.id,
                post_id: postIdInt,
                view_count: 1,
                viewed_at: new Date().toISOString()
              });

            // 중복 키 에러는 무시 (race condition)
            if (insertError && insertError.code !== '23505') {
              return { success: false, reason: insertError.message };
            }
            return { success: true, viewCount: 1 };
          }
        }
        return { success: false, reason: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('열람 기록 저장 예외:', error);
      return { success: false, reason: error.message };
    }
  },

  /**
   * 관리자 전용: 게시물 고정/고정 해제
   * @param {string|number} postId - 게시물 ID
   * @param {boolean} isPinned - 고정 여부
   */
  async setPinned(postId, isPinned) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('posts')
        .update({
          is_pinned: isPinned,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('게시물 고정 설정 오류:', error);
      throw error;
    }
  },

  /**
   * hot_score 수동 갱신 (관리자용)
   * Supabase Function 호출
   */
  async refreshHotScores() {
    try {
      const { data, error } = await supabase.rpc('update_all_hot_scores');

      if (error) throw error;

      return { success: true, updatedCount: data };
    } catch (error) {
      console.error('hot_score 갱신 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 저장 (Supabase saved_posts 테이블)
   * @param {string} postId - 게시물 ID
   * @param {string} userId - 사용자 ID
   */
  async savePost(postId, userId) {
    try {
      const { error } = await supabase
        .from('saved_posts')
        .insert([{
          user_id: userId,
          post_id: postId
        }]);

      if (error) {
        // 이미 저장된 경우 (중복) 무시
        if (error.code === '23505') {
          return { success: true, alreadySaved: true };
        }
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('게시물 저장 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 저장 취소
   * @param {string} postId - 게시물 ID
   * @param {string} userId - 사용자 ID
   */
  async unsavePost(postId, userId) {
    try {
      const { error } = await supabase
        .from('saved_posts')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('게시물 저장 취소 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 저장 여부 확인
   * @param {string} postId - 게시물 ID
   * @param {string} userId - 사용자 ID
   */
  async isPostSaved(postId, userId) {
    try {
      const { data, error } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('저장 여부 확인 오류:', error);
      return false;
    }
  },

  /**
   * 저장된 게시물 목록 조회 (상세 정보 포함)
   * @param {string} userId - 사용자 ID
   */
  async getSavedPosts(userId) {
    try {
      // saved_posts에서 저장된 게시물 ID 조회 (최신순)
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (savedError) throw savedError;
      if (!savedData || savedData.length === 0) return [];

      const postIds = savedData.map(s => s.post_id);

      // 저장된 게시물 상세 정보 조회
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `)
        .in('id', postIds)
        .or('is_hidden.is.null,is_hidden.eq.false');

      if (postsError) throw postsError;

      // 저장 순서 유지 (최신 저장이 맨 앞)
      const postsMap = {};
      posts.forEach(p => { postsMap[p.id] = p; });

      const orderedPosts = postIds
        .map(id => postsMap[id])
        .filter(p => p !== undefined);

      // 데이터 변환
      return orderedPosts.map(post => ({
        ...post,
        desc: post.description,
        content: post.description,
        img: post.photo,
        userId: post.user_id,
        createdAt: post.created_at,
        username: post.users?.username || '',
        name: post.users?.name || '',
        profilePic: post.users?.profile_pic || 'defaultAvatar.png',
        user: post.users || null
      }));
    } catch (error) {
      console.error('저장된 게시물 조회 오류:', error);
      return [];
    }
  },

  /**
   * 특정 시각 이후 새 게시물이 있는지 확인 (head-only 경량 쿼리)
   * @param {string} sinceTime - ISO 8601 timestamp
   * @returns {Promise<boolean>}
   */
  async hasNewPostsSince(sinceTime) {
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', sinceTime)
        .eq('is_hidden', false)
        .limit(1);
      if (error) return false;
      return (count || 0) > 0;
    } catch {
      return false;
    }
  },

  /**
   * hot_score 최고점 게시물 조회 (홈 화면용) - 캐시 테이블 사용
   * @returns {Object|null} 가장 인기있는 게시물
   */
  async getHottestPost() {
    try {
      // 1. 캐시 테이블에서 조회 시도
      const { data: cached } = await supabase
        .from('cached_hottest_post')
        .select(`
          post_id,
          expires_at,
          posts:post_id (
            *,
            users:user_id (
              id,
              username,
              name,
              profile_pic
            )
          )
        `)
        .single();

      // 캐시가 있고 유효하면 반환
      if (cached?.posts && new Date(cached.expires_at) > new Date()) {
        return this._formatHottestPost(cached.posts);
      }

      // 2. 캐시 없거나 만료 → 직접 조회
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `)
        .eq('post_type', 'general')
        .or('is_hidden.is.null,is_hidden.eq.false')
        .order('hot_score', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      if (!data) return null;

      // 캐시 갱신 (백그라운드, 실패해도 무시)
      supabase.rpc('refresh_cached_hottest_post').then(() => {}).catch(() => {});

      return this._formatHottestPost(data);
    } catch (error) {
      console.error('인기 게시물 조회 오류:', error);
      return null;
    }
  },

  /**
   * 인기 게시물 포맷 헬퍼
   */
  _formatHottestPost(data) {
    return {
      ...data,
      desc: data.description,
      content: data.description,
      img: data.photo,
      userId: data.user_id,
      createdAt: data.created_at,
      username: data.users?.username || '',
      name: data.users?.name || '',
      profilePic: data.users?.profile_pic || 'defaultAvatar.png',
      user: data.users || null
    };
  }
};
