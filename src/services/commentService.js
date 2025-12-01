import { supabase } from '../config/supabase.js';

/**
 * 댓글 서비스
 * 모든 댓글 관련 Supabase 쿼리를 중앙화
 */
export const commentService = {
  /**
   * 게시물의 댓글 목록 조회
   * @param {string} postId - 게시물 ID
   * @param {Object} options - 쿼리 옵션
   * @param {number} options.limit - 제한 개수
   * @param {number} options.offset - 오프셋
   * @param {boolean} options.includeHidden - 숨김 댓글 포함 여부
   * @param {string} options.postOwnerId - 게시물 작성자 ID (비공개 댓글 권한 체크용)
   */
  async getComments(postId, { limit, offset, includeHidden = false, postOwnerId = null } = {}) {
    try {
      // 현재 로그인한 사용자 정보 조회
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserId = currentUser?.id;

      // 현재 사용자의 역할 조회 (관리자 여부 확인)
      let isAdmin = false;
      if (currentUserId) {
        const { data: userData } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentUserId)
          .single();
        isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';
      }

      // 1. 부모 댓글만 조회 (parent_id가 null인 댓글)
      let parentQuery = supabase
        .from('comments')
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `)
        .eq('post_id', postId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      // 숨김 댓글 필터링 (관리자 페이지가 아닌 경우)
      if (!includeHidden) {
        parentQuery = parentQuery.or('is_hidden.is.null,is_hidden.eq.false');
      }

      // limit/offset 적용
      if (limit !== undefined && offset !== undefined) {
        parentQuery = parentQuery.range(offset, offset + limit - 1);
      }

      const { data: parentComments, error: parentError } = await parentQuery;

      if (parentError) throw parentError;

      // 2. 답글 조회 (parent_id가 있는 댓글)
      let repliesQuery = supabase
        .from('comments')
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `)
        .eq('post_id', postId)
        .not('parent_id', 'is', null)
        .order('created_at', { ascending: true });

      // 숨김 댓글 필터링 (관리자 페이지가 아닌 경우)
      if (!includeHidden) {
        repliesQuery = repliesQuery.or('is_hidden.is.null,is_hidden.eq.false');
      }

      const { data: replies, error: repliesError } = await repliesQuery;

      if (repliesError) throw repliesError;

      /**
       * 비공개 댓글 권한 체크 함수
       * 열람 가능 조건:
       * 1. 댓글 작성자 본인
       * 2. 게시물 작성자 (판매자)
       * 3. 관리자
       */
      const canViewSecretComment = (comment) => {
        if (!comment.is_secret) return true; // 공개 댓글은 모두 열람 가능
        if (!currentUserId) return false; // 비로그인 사용자는 비공개 댓글 열람 불가
        if (isAdmin) return true; // 관리자는 모든 비공개 댓글 열람 가능
        if (comment.user_id === currentUserId) return true; // 댓글 작성자 본인
        if (postOwnerId && postOwnerId === currentUserId) return true; // 게시물 작성자
        return false;
      };

      /**
       * 비공개 댓글 마스킹 함수
       * 열람 권한이 없는 경우 내용을 숨김
       */
      const maskSecretComment = (comment) => {
        if (canViewSecretComment(comment)) {
          return comment;
        }
        // 열람 권한이 없는 경우 내용 마스킹
        return {
          ...comment,
          description: '🔒 비밀 댓글입니다.',
          isMasked: true // 마스킹 여부 표시
        };
      };

      // 3. 모든 댓글 ID 수집 (좋아요 정보 조회용)
      const allCommentIds = [
        ...parentComments.map(c => c.id),
        ...replies.map(r => r.id)
      ];

      // 4. 댓글 좋아요 수 조회
      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', allCommentIds);

      // 좋아요 수 카운트 맵 생성
      const likesCountMap = {};
      likesData?.forEach(like => {
        likesCountMap[like.comment_id] = (likesCountMap[like.comment_id] || 0) + 1;
      });

      // 5. 현재 사용자의 좋아요 여부 조회
      let userLikesMap = {};
      if (currentUserId) {
        const { data: userLikes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', currentUserId)
          .in('comment_id', allCommentIds);

        userLikes?.forEach(like => {
          userLikesMap[like.comment_id] = true;
        });
      }

      // 6. 답글을 부모 댓글에 매핑 (비공개 댓글 권한 체크 적용)
      const commentsWithReplies = parentComments.map(comment => {
        const maskedComment = maskSecretComment(comment);

        const commentReplies = replies
          .filter(reply => reply.parent_id === comment.id)
          .map(reply => {
            const maskedReply = maskSecretComment(reply);
            return {
              ...maskedReply,
              desc: maskedReply.description,
              userId: maskedReply.user_id,
              name: maskedReply.users?.name,
              username: maskedReply.users?.username,
              profilePic: maskedReply.users?.profile_pic,
              user_name: maskedReply.users?.name,
              profile_pic: maskedReply.users?.profile_pic,
              user: maskedReply.users,
              likes_count: likesCountMap[reply.id] || 0,
              user_liked: userLikesMap[reply.id] || false
            };
          });

        return {
          ...maskedComment,
          desc: maskedComment.description,
          userId: maskedComment.user_id,
          name: maskedComment.users?.name,
          username: maskedComment.users?.username,
          profilePic: maskedComment.users?.profile_pic,
          user_name: maskedComment.users?.name,
          profile_pic: maskedComment.users?.profile_pic,
          user: maskedComment.users,
          replies: commentReplies,
          likes_count: likesCountMap[comment.id] || 0,
          user_liked: userLikesMap[comment.id] || false
        };
      });

      return commentsWithReplies;
    } catch (error) {
      console.error('댓글 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 댓글 생성
   * @param {Object} commentData - 댓글 데이터
   * @param {string} commentData.postId - 게시물 ID
   * @param {string} commentData.content - 댓글 내용
   * @param {string} commentData.parentId - 부모 댓글 ID (답글인 경우)
   * @param {boolean} commentData.isSecret - 비밀 댓글 여부
   */
  async createComment(commentData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('comments')
        .insert([{
          user_id: user.id,
          post_id: commentData.postId,
          description: commentData.content,
          parent_id: commentData.parentId || null,
          is_secret: commentData.isSecret || false
          // created_at은 DB 기본값(NOW())을 사용 - 타임존 문제 방지
        }])
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `)
        .single();

      if (error) throw error;

      // 사용자 정보 매핑
      return {
        ...data,
        desc: data.description,
        userId: data.user_id,
        name: data.users?.name,
        username: data.users?.username,
        profilePic: data.users?.profile_pic,
        user_name: data.users?.name,
        profile_pic: data.users?.profile_pic,
        user: data.users
      };
    } catch (error) {
      console.error('댓글 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 댓글 수정
   * @param {string} commentId - 댓글 ID
   * @param {string} content - 새 내용
   */
  async updateComment(commentId, content) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('comments')
        .update({
          description: content
          // updated_at은 DB 트리거가 자동으로 업데이트
        })
        .eq('id', commentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('댓글 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 댓글 삭제
   * @param {string} commentId - 댓글 ID
   */
  async deleteComment(commentId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('댓글 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 관리자용 댓글 삭제 (작성자 무관)
   * @param {string} commentId - 댓글 ID
   */
  async deleteCommentAdmin(commentId) {
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('관리자 댓글 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 관리자용 댓글 숨김 (soft delete)
   * @param {string} commentId - 댓글 ID
   * @param {boolean} isHidden - 숨김 여부
   */
  async hideComment(commentId, isHidden = true) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('comments')
        .update({
          is_hidden: isHidden
        })
        .eq('id', commentId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('댓글 숨김 처리 오류:', error);
      throw error;
    }
  },

  /**
   * 댓글 좋아요 토글
   * @param {string} commentId - 댓글 ID
   * @returns {Promise<{liked: boolean, likesCount: number}>}
   */
  async toggleCommentLike(commentId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 기존 좋아요 확인
      const { data: existingLike, error: checkError } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('user_id', user.id)
        .eq('comment_id', commentId)
        .maybeSingle();

      if (checkError) throw checkError;

      let liked;
      if (existingLike) {
        // 좋아요 취소
        const { error: deleteError } = await supabase
          .from('comment_likes')
          .delete()
          .eq('id', existingLike.id);

        if (deleteError) throw deleteError;
        liked = false;
      } else {
        // 좋아요 추가
        const { error: insertError } = await supabase
          .from('comment_likes')
          .insert([{ user_id: user.id, comment_id: commentId }]);

        if (insertError) throw insertError;
        liked = true;
      }

      // 좋아요 수 다시 조회 (comment_likes 테이블에서 직접 카운트)
      const { count, error: countError } = await supabase
        .from('comment_likes')
        .select('*', { count: 'exact', head: true })
        .eq('comment_id', commentId);

      if (countError) console.warn('좋아요 수 조회 실패:', countError);

      return {
        liked,
        likesCount: count || 0
      };
    } catch (error) {
      console.error('댓글 좋아요 토글 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자가 특정 댓글들에 좋아요 했는지 확인
   * @param {string[]} commentIds - 댓글 ID 배열
   * @returns {Promise<{[commentId: string]: boolean}>}
   */
  async getUserCommentLikes(commentIds) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !commentIds.length) return {};

      const { data, error } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .eq('user_id', user.id)
        .in('comment_id', commentIds);

      if (error) throw error;

      const likedMap = {};
      data?.forEach(like => {
        likedMap[like.comment_id] = true;
      });

      return likedMap;
    } catch (error) {
      console.error('댓글 좋아요 상태 조회 오류:', error);
      return {};
    }
  }
};

export default commentService;
