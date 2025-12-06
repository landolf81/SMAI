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

      // 관리자 권한 체크는 댓글 조회 시 불필요 (삭제/수정 버튼은 프론트엔드에서 처리)

      // 1. 부모 댓글 쿼리 준비
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

      // 2. 답글 쿼리 준비
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

      // 부모 댓글과 답글을 병렬로 조회
      const [parentResult, repliesResult] = await Promise.all([parentQuery, repliesQuery]);

      if (parentResult.error) throw parentResult.error;
      if (repliesResult.error) throw repliesResult.error;

      const parentComments = parentResult.data || [];
      const replies = repliesResult.data || [];

      // 3. 모든 댓글 ID 수집 (좋아요 정보 조회용)
      const allCommentIds = [
        ...parentComments.map(c => c.id),
        ...replies.map(r => r.id)
      ];

      // 댓글이 없으면 빈 배열 반환
      if (allCommentIds.length === 0) {
        return [];
      }

      // 4. 좋아요 관련 쿼리 병렬 실행
      const likesPromises = [
        // 전체 좋아요 수
        supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', allCommentIds)
      ];

      // 로그인 사용자인 경우 본인 좋아요 여부도 조회
      if (currentUserId) {
        likesPromises.push(
          supabase
            .from('comment_likes')
            .select('comment_id')
            .eq('user_id', currentUserId)
            .in('comment_id', allCommentIds)
        );
      }

      const likesResults = await Promise.all(likesPromises);

      // 좋아요 수 카운트 맵 생성
      const likesCountMap = {};
      likesResults[0].data?.forEach(like => {
        likesCountMap[like.comment_id] = (likesCountMap[like.comment_id] || 0) + 1;
      });

      // 사용자 좋아요 맵 생성
      const userLikesMap = {};
      if (currentUserId && likesResults[1]?.data) {
        likesResults[1].data.forEach(like => {
          userLikesMap[like.comment_id] = true;
        });
      }

      // 5. 답글을 부모 댓글에 매핑
      const commentsWithReplies = parentComments.map(comment => {
        const commentReplies = replies
          .filter(reply => reply.parent_id === comment.id)
          .map(reply => ({
            ...reply,
            desc: reply.description,
            userId: reply.user_id,
            name: reply.users?.name,
            username: reply.users?.username,
            profilePic: reply.users?.profile_pic,
            user_name: reply.users?.name,
            profile_pic: reply.users?.profile_pic,
            user: reply.users,
            likes_count: likesCountMap[reply.id] || 0,
            user_liked: userLikesMap[reply.id] || false
          }));

        return {
          ...comment,
          desc: comment.description,
          userId: comment.user_id,
          name: comment.users?.name,
          username: comment.users?.username,
          profilePic: comment.users?.profile_pic,
          user_name: comment.users?.name,
          profile_pic: comment.users?.profile_pic,
          user: comment.users,
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
