import { supabase } from '../config/supabase.js';
import { commentService } from './commentService.js';

/**
 * QnA 서비스
 * QnA 관련 Supabase 쿼리를 중앙화
 */
export const qnaService = {
  /**
   * 질문 목록 조회 (필터링 및 정렬 지원)
   * @param {Object} options - 조회 옵션
   */
  async getQuestions(options = {}) {
    try {
      const {
        status = 'all',
        sort = 'latest',
        search = '',
        searchField = 'all', // 'all', 'title', 'description'
        limit = 20,
        offset = 0
      } = options;

      // 총 개수 조회
      let countQuery = supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('post_type', 'qna')
        // 숨김 처리된 게시물 제외
        .or('is_hidden.is.null,is_hidden.eq.false');

      if (search) {
        const searchPattern = `%${search}%`;
        if (searchField === 'title') {
          countQuery = countQuery.ilike('title', searchPattern);
        } else if (searchField === 'description') {
          countQuery = countQuery.ilike('description', searchPattern);
        } else {
          // 'all' - 제목 또는 내용
          countQuery = countQuery.or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`);
        }
      }

      const { count, error: countError } = await countQuery;

      if (countError) throw countError;

      // 데이터 조회
      let query = supabase
        .from('posts')
        .select(`
          id,
          title,
          description,
          photo,
          user_id,
          post_type,
          created_at,
          updated_at,
          views_count,
          question_status,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `, { count: 'exact' })
        .eq('post_type', 'qna')
        // 숨김 처리된 게시물 제외
        .or('is_hidden.is.null,is_hidden.eq.false');

      // 검색
      if (search) {
        const searchPattern = `%${search}%`;
        if (searchField === 'title') {
          query = query.ilike('title', searchPattern);
        } else if (searchField === 'description') {
          query = query.ilike('description', searchPattern);
        } else {
          // 'all' - 제목 또는 내용
          query = query.or(`title.ilike.${searchPattern},description.ilike.${searchPattern}`);
        }
      }

      // 상태 필터 (서버 사이드)
      if (status === 'open') {
        query = query.eq('question_status', 'open');
      } else if (status === 'answered') {
        query = query.eq('question_status', 'answered');
      } else if (status === 'closed') {
        query = query.eq('question_status', 'closed');
      }

      // 정렬
      if (sort === 'latest') {
        query = query.order('created_at', { ascending: false });
      } else if (sort === 'popular') {
        query = query.order('views_count', { ascending: false, nullsFirst: false });
      }

      // 페이징
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      // 각 질문에 대한 관련 데이터를 별도로 조회
      const questionIds = data.map(q => q.id);

      const [commentsData, likesData, tagsData] = await Promise.all([
        // 댓글 수 조회
        supabase
          .from('comments')
          .select('post_id')
          .in('post_id', questionIds),

        // 좋아요 수 조회
        supabase
          .from('likes')
          .select('post_id')
          .in('post_id', questionIds),

        // 태그 조회
        supabase
          .from('post_tags')
          .select('post_id, tags(id, name, color)')
          .in('post_id', questionIds)
      ]);

      // 댓글 수 카운트
      const commentsCountMap = {};
      commentsData.data?.forEach(comment => {
        commentsCountMap[comment.post_id] = (commentsCountMap[comment.post_id] || 0) + 1;
      });

      // 좋아요 수 카운트
      const likesCountMap = {};
      likesData.data?.forEach(like => {
        likesCountMap[like.post_id] = (likesCountMap[like.post_id] || 0) + 1;
      });

      // 태그 맵 생성
      const tagsMap = {};
      tagsData.data?.forEach(pt => {
        if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
        if (pt.tags) tagsMap[pt.post_id].push(pt.tags);
      });

      // 데이터 변환
      const questions = data.map(post => {
        const tags = tagsMap[post.id] || [];
        const firstTag = tags[0] || null;

        return {
          ...post,
          desc: post.description,
          img: post.photo,
          username: post.users?.username,
          user_name: post.users?.name,
          profilePic: post.users?.profile_pic,
          answers_count: commentsCountMap[post.id] || 0,
          likes_count: likesCountMap[post.id] || 0,
          tags: tags,
          tag_display_name: firstTag?.name || null,
          tag_color: firstTag?.color || null
        };
      });

      console.log('📝 QnA 질문 목록 조회:', {
        total: count,
        currentPage: Math.floor(offset / limit) + 1,
        questions: questions.length
      });

      return {
        questions,
        pagination: {
          page: Math.floor(offset / limit) + 1,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      console.error('질문 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * QnA 통계 조회
   */
  async getQnaStats() {
    try {
      // 모든 QnA 게시물 가져오기 (댓글 수 포함)
      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          comments:comments(count)
        `)
        .eq('post_type', 'qna');

      if (error) throw error;

      // 클라이언트 사이드에서 통계 계산
      const totalQuestions = data.length;
      const answeredQuestions = data.filter(post => {
        const commentCount = post.comments?.[0]?.count || 0;
        return commentCount > 0;
      }).length;
      const unansweredQuestions = totalQuestions - answeredQuestions;

      return {
        totalQuestions,
        answeredQuestions,
        unansweredQuestions
      };
    } catch (error) {
      console.error('QnA 통계 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 인기 질문 조회 (최근 7일 기준)
   */
  async getTrendingQuestions(limit = 3) {
    try {
      // 7일 전 날짜 계산
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoISO = sevenDaysAgo.toISOString();

      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          title,
          description,
          views_count,
          created_at,
          question_status,
          users:user_id (
            username,
            name,
            profile_pic
          )
        `)
        .eq('post_type', 'qna')
        // 숨김 처리된 게시물 제외
        .or('is_hidden.is.null,is_hidden.eq.false')
        .gte('created_at', sevenDaysAgoISO) // 최근 7일 이내
        .order('views_count', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;

      // 각 질문의 댓글 수와 좋아요 수 조회
      const questionIds = data.map(q => q.id);

      const [commentsData, likesData] = await Promise.all([
        supabase
          .from('comments')
          .select('post_id')
          .in('post_id', questionIds),
        supabase
          .from('likes')
          .select('post_id')
          .in('post_id', questionIds)
      ]);

      // 댓글 수 카운트
      const commentsCountMap = {};
      commentsData.data?.forEach(comment => {
        commentsCountMap[comment.post_id] = (commentsCountMap[comment.post_id] || 0) + 1;
      });

      // 좋아요 수 카운트
      const likesCountMap = {};
      likesData.data?.forEach(like => {
        likesCountMap[like.post_id] = (likesCountMap[like.post_id] || 0) + 1;
      });

      return data.map(post => ({
        ...post,
        username: post.users?.username,
        user_name: post.users?.name,
        profilePic: post.users?.profile_pic,
        answers_count: commentsCountMap[post.id] || 0,
        likes_count: likesCountMap[post.id] || 0
      }));
    } catch (error) {
      console.error('인기 질문 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 특정 질문 상세 조회
   * @param {string} questionId - 질문 ID
   */
  async getQuestion(questionId) {
    try {
      // 조회수 증가 로직 (postService와 동일한 방식)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      const postIdInt = parseInt(questionId, 10);
      if (!isNaN(postIdInt)) {
        // 비로그인 사용자용 고유 세션 ID (localStorage에 영구 저장)
        const getOrCreateSessionId = () => {
          let sessionId = localStorage.getItem('anonymous_session_id');
          if (!sessionId) {
            sessionId = 'anon_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
            localStorage.setItem('anonymous_session_id', sessionId);
          }
          return sessionId;
        };

        const sessionId = user ? null : getOrCreateSessionId();

        // 기존 조회 기록 확인
        let existingViewQuery = supabase
          .from('post_views')
          .select('id')
          .eq('post_id', postIdInt);

        if (user) {
          existingViewQuery = existingViewQuery.eq('user_id', user.id);
        } else {
          existingViewQuery = existingViewQuery.eq('session_id', sessionId);
        }

        const { data: existingView } = await existingViewQuery.maybeSingle();

        // 이미 조회한 경우 조회수 증가하지 않음
        if (!existingView) {
          const { error: viewError } = await supabase
            .from('post_views')
            .insert({
              post_id: postIdInt,
              user_id: user?.id || null,
              session_id: sessionId,
              ip_address: 'unknown',
              viewed_at: new Date().toISOString()
            });

          if (viewError && viewError.code !== '23505') {
            console.warn('QnA 조회 기록 추가 실패:', viewError.code, viewError.message);
          }
        }
      }

      // 질문과 답변을 병렬로 조회 (성능 최적화)
      const [questionResult, answers] = await Promise.all([
        supabase
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
          .eq('id', questionId)
          .eq('post_type', 'qna')
          .single(),
        commentService.getComments(questionId)
      ]);

      const { data, error } = questionResult;
      if (error) throw error;

      // 숨김 처리된 질문은 접근 불가
      if (data.is_hidden === true) {
        throw new Error('숨김 처리된 질문입니다.');
      }

      // 답변을 QnADetail에서 기대하는 형식으로 변환
      const formattedAnswers = answers.map(comment => ({
        id: comment.id,
        content: comment.description || comment.desc || '',
        user_id: comment.user_id,
        username: comment.user?.username || comment.users?.username,
        user_name: comment.user?.name || comment.users?.name,
        profilePic: comment.user?.profile_pic || comment.users?.profile_pic,
        created_at: comment.created_at,
        is_accepted: comment.is_accepted || false,
        likes_count: comment.likes_count || 0,
        user_liked: false, // TODO: 사용자 좋아요 여부 확인 필요
        photo: comment.photo // 이미지/영상 URL 배열 (JSON 문자열)
      }));

      // QnADetail 컴포넌트에서 기대하는 형식으로 반환
      return {
        question: {
          ...data,
          username: data.users?.username,
          user_name: data.users?.name,
          profilePic: data.users?.profile_pic
        },
        answers: formattedAnswers,
        stats: {
          views: data.views_count || 0,
          likes: data.likes_count || 0,
          totalAnswers: formattedAnswers.length
        }
      };
    } catch (error) {
      console.error('질문 상세 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 질문 생성
   * @param {Object} questionData - 질문 데이터
   */
  async createQuestion(questionData) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('posts')
        .insert([{
          user_id: user.id,
          title: questionData.title,
          description: questionData.content,  // posts 테이블은 'description' 컬럼 사용
          post_type: 'qna',
          photo: questionData.images && questionData.images.length > 0 ? JSON.stringify(questionData.images) : null,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('질문 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 질문 수정
   * @param {string} questionId - 질문 ID
   * @param {Object} updates - 수정할 데이터 { desc, images } 또는 { title, content, tagId }
   */
  async updateQuestion(questionId, updates) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 업데이트 데이터 구성
      const updateData = {
        updated_at: new Date().toISOString()
      };

      // desc가 있으면 description으로 매핑 (QnADetail에서 사용)
      if (updates.desc !== undefined) {
        updateData.description = updates.desc;
      }
      // content가 있으면 description으로 매핑 (호환성)
      if (updates.content !== undefined) {
        updateData.description = updates.content;
      }
      // title이 있으면 그대로 사용
      if (updates.title !== undefined) {
        updateData.title = updates.title;
      }
      // images 배열이 있으면 photo로 저장 (JSON 문자열)
      if (updates.images !== undefined) {
        updateData.photo = updates.images.length > 0 ? JSON.stringify(updates.images) : null;
      }
      // tagId가 있으면 tag_id로 매핑
      if (updates.tagId !== undefined) {
        updateData.tag_id = updates.tagId;
      }

      console.log('질문 수정 - DB 업데이트 데이터:', updateData);

      const { data, error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', questionId)
        .eq('user_id', user.id)
        .eq('post_type', 'qna')
        .select()
        .single();

      if (error) throw error;

      console.log('질문 수정 완료:', data);
      return data;
    } catch (error) {
      console.error('질문 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 질문 삭제
   * @param {string} questionId - 질문 ID
   */
  async deleteQuestion(questionId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', questionId)
        .eq('user_id', user.id)
        .eq('post_type', 'qna');

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('질문 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 답변 추가
   * @param {string} questionId - 질문 ID
   * @param {string} content - 답변 내용
   * @param {string[]} images - 이미지 URL 배열
   */
  async addAnswer(questionId, content, images = []) {
    try {
      // commentService를 사용하여 Supabase에 직접 추가
      const comment = await commentService.createComment({
        postId: questionId,
        content: content,
        images: images
      });

      return comment;
    } catch (error) {
      console.error('답변 추가 오류:', error);
      throw error;
    }
  },

  // 답변 좋아요는 commentService.toggleCommentLike() 사용
  // 답변 채택 기능 삭제됨 (2025-11-27)

  /**
   * 댓글 신고
   * @param {Object} reportData - 신고 데이터
   * @param {string} reportData.commentId - 신고할 댓글 ID
   * @param {string} reportData.reason - 신고 사유
   */
  async reportComment(reportData) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('reports')
        .insert([{
          user_id: user.id,
          comment_id: reportData.commentId,
          reason: reportData.reason,
          status: 'pending',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('댓글 신고 오류:', error);
      throw error;
    }
  }
};

export default qnaService;
