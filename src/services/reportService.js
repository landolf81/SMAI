import { supabase } from '../config/supabase.js';

/**
 * 신고 서비스
 * reports 테이블 실제 스키마:
 * - id, post_id, comment_id, reporter_id, category_id, custom_reason,
 *   status, admin_id, admin_action, admin_notes, is_false_report, created_at, resolved_at
 */
export const reportService = {
  /**
   * 신고 카테고리 조회
   */
  async getReportCategories() {
    try {
      const { data, error } = await supabase
        .from('report_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('신고 카테고리 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자의 오늘 신고 횟수 확인
   */
  async getTodayReportCount(userId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('reporter_id', userId)
        .gte('created_at', today.toISOString());

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('신고 횟수 조회 오류:', error);
      return 0;
    }
  },

  /**
   * 사용자의 신고 기능 활성화 여부 확인
   */
  async checkReportPermission(userId) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('can_report')
        .eq('id', userId)
        .single();

      if (error) throw error;
      // can_report 컬럼이 없거나 true이면 신고 가능
      return data?.can_report !== false;
    } catch (error) {
      // 컬럼이 없는 경우 기본값 true
      console.log('신고 권한 확인 (기본값 true):', error.message);
      return true;
    }
  },

  /**
   * 신고 생성
   */
  async createReport(reportData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 1. 신고 권한 확인
      const canReport = await this.checkReportPermission(user.id);
      if (!canReport) {
        throw new Error('신고 기능이 비활성화되었습니다. 관리자에게 문의하세요.');
      }

      // 2. 오늘 신고 횟수 확인 (하루 3건 제한)
      const todayCount = await this.getTodayReportCount(user.id);
      if (todayCount >= 3) {
        throw new Error('일일 신고 횟수 제한에 도달했습니다. (3회)');
      }

      // 3. 중복 신고 확인 (maybeSingle 사용 - 결과가 없어도 에러 안남)
      let duplicateQuery = supabase
        .from('reports')
        .select('id')
        .eq('reporter_id', user.id);

      if (reportData.postId) {
        duplicateQuery = duplicateQuery.eq('post_id', reportData.postId);
      } else if (reportData.commentId) {
        duplicateQuery = duplicateQuery.eq('comment_id', reportData.commentId);
      }

      const { data: existingReports, error: duplicateError } = await duplicateQuery;
      if (duplicateError) {
        console.error('중복 신고 확인 오류:', duplicateError);
      }
      if (existingReports && existingReports.length > 0) {
        throw new Error('이미 신고한 게시물/댓글입니다.');
      }

      // 4. 신고 생성
      const { data, error } = await supabase
        .from('reports')
        .insert([{
          reporter_id: user.id,
          post_id: reportData.postId || null,
          comment_id: reportData.commentId || null,
          category_id: reportData.categoryId,
          custom_reason: reportData.reason || reportData.description || null,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;

      // 5. 게시글/댓글 신고 누적 확인 및 자동 숨김 (3건 이상)
      await this.checkAndHideContent(reportData.postId, reportData.commentId);

      return data;
    } catch (error) {
      console.error('신고 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 신고 누적 확인 및 콘텐츠 자동 숨김 (3건 이상 시)
   */
  async checkAndHideContent(postId, commentId) {
    try {
      const HIDE_THRESHOLD = 3; // 3건 이상 신고 시 숨김

      if (postId) {
        // 해당 게시글의 총 신고 수 확인 (pending, reviewing 상태만)
        const { count, error } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('post_id', postId)
          .in('status', ['pending', 'reviewing']);

        if (error) {
          console.error('게시글 신고 수 확인 오류:', error);
          return;
        }

        console.log(`게시글 ${postId}의 신고 수: ${count}`);

        // 3건 이상이면 게시글 숨김
        if (count >= HIDE_THRESHOLD) {
          const { error: hideError } = await supabase
            .from('posts')
            .update({ is_hidden: true })
            .eq('id', postId);

          if (hideError) {
            console.error('게시글 숨김 처리 오류:', hideError);
          } else {
            console.log(`게시글 ${postId}가 ${count}건 신고로 자동 숨김 처리됨`);
          }
        }
      }

      if (commentId) {
        // 해당 댓글의 총 신고 수 확인 (pending, reviewing 상태만)
        const { count, error } = await supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .eq('comment_id', commentId)
          .in('status', ['pending', 'reviewing']);

        if (error) {
          console.error('댓글 신고 수 확인 오류:', error);
          return;
        }

        console.log(`댓글 ${commentId}의 신고 수: ${count}`);

        // 3건 이상이면 댓글 숨김
        if (count >= HIDE_THRESHOLD) {
          const { error: hideError } = await supabase
            .from('comments')
            .update({ is_hidden: true })
            .eq('id', commentId);

          if (hideError) {
            console.error('댓글 숨김 처리 오류:', hideError);
          } else {
            console.log(`댓글 ${commentId}이 ${count}건 신고로 자동 숨김 처리됨`);
          }
        }
      }
    } catch (error) {
      console.error('콘텐츠 자동 숨김 처리 오류:', error);
      // 숨김 실패해도 신고는 정상 처리되도록 에러를 던지지 않음
    }
  },

  /**
   * 신고 목록 조회 (관리자용)
   */
  async getReports() {
    try {
      // 1. 신고 목록 조회
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        return [];
      }

      // 2. 관련 ID 수집 (숫자형 ID는 Number로 변환하여 Supabase 쿼리 호환성 보장)
      const reporterIds = [...new Set(data.filter(r => r.reporter_id).map(r => r.reporter_id))];
      const postIds = [...new Set(data.filter(r => r.post_id).map(r => Number(r.post_id)))];
      const commentIds = [...new Set(data.filter(r => r.comment_id).map(r => Number(r.comment_id)))];
      const categoryIds = [...new Set(data.filter(r => r.category_id).map(r => Number(r.category_id)))];

      // 3. 각 테이블에서 데이터 조회 (개별 쿼리로 분리하여 에러 처리)
      let reportersResult = { data: [] };
      let postsResult = { data: [] };
      let commentsResult = { data: [] };
      let categoriesResult = { data: [] };

      try {
        if (reporterIds.length > 0) {
          reportersResult = await supabase
            .from('users')
            .select('id, username, name, can_report')
            .in('id', reporterIds);
        }
      } catch (e) {
        console.error('신고자 조회 오류:', e);
      }

      try {
        if (postIds.length > 0) {
          // 개별 ID로 조회하여 .in() 오류 방지
          const postPromises = postIds.map(id =>
            supabase.from('posts').select('*').eq('id', id).maybeSingle()
          );
          const postResults = await Promise.allSettled(postPromises);
          postsResult.data = postResults
            .filter(r => r.status === 'fulfilled' && r.value.data)
            .map(r => r.value.data);
        }
      } catch (e) {
        console.error('게시물 조회 오류:', e);
      }

      try {
        if (commentIds.length > 0) {
          // 개별 ID로 조회하여 .in() 오류 방지
          const commentPromises = commentIds.map(id =>
            supabase.from('comments').select('*').eq('id', id).maybeSingle()
          );
          const commentResults = await Promise.allSettled(commentPromises);
          commentsResult.data = commentResults
            .filter(r => r.status === 'fulfilled' && r.value.data)
            .map(r => r.value.data);
        }
      } catch (e) {
        console.error('댓글 조회 오류:', e);
      }

      try {
        if (categoryIds.length > 0) {
          // 개별 ID로 조회하여 .in() 오류 방지
          const categoryPromises = categoryIds.map(id =>
            supabase.from('report_categories').select('*').eq('id', id).maybeSingle()
          );
          const categoryResults = await Promise.allSettled(categoryPromises);
          categoriesResult.data = categoryResults
            .filter(r => r.status === 'fulfilled' && r.value.data)
            .map(r => r.value.data);
        }
      } catch (e) {
        console.error('카테고리 조회 오류:', e);
      }

      // 4. 맵으로 변환
      const reportersMap = (reportersResult.data || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
      const postsMap = (postsResult.data || []).reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
      const commentsMap = (commentsResult.data || []).reduce((acc, c) => { acc[c.id] = c; return acc; }, {});
      const categoriesMap = (categoriesResult.data || []).reduce((acc, cat) => { acc[cat.id] = cat; return acc; }, {});

      // 5. 게시물/댓글 작성자 ID 수집 및 조회
      const postAuthorIds = [...new Set(Object.values(postsMap).filter(p => p.user_id).map(p => p.user_id))];
      const commentAuthorIds = [...new Set(Object.values(commentsMap).filter(c => c.user_id).map(c => c.user_id))];
      const allAuthorIds = [...new Set([...postAuthorIds, ...commentAuthorIds])];

      let authorsMap = {};
      if (allAuthorIds.length > 0) {
        const { data: authors } = await supabase
          .from('users')
          .select('id, username, name')
          .in('id', allAuthorIds);

        if (authors) {
          authorsMap = authors.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});
        }
      }

      // 6. 데이터 정규화
      return data.map(report => {
        const reporter = reportersMap[report.reporter_id];
        const post = postsMap[report.post_id];
        const comment = commentsMap[report.comment_id];
        const category = categoriesMap[report.category_id];
        const postAuthor = post?.user_id ? authorsMap[post.user_id] : null;
        const commentAuthor = comment?.user_id ? authorsMap[comment.user_id] : null;

        return {
          ...report,
          reporter_username: reporter?.username || '알 수 없음',
          reporter_can_report: reporter?.can_report !== false,
          post_author_username: postAuthor?.username || '알 수 없음',
          comment_author_username: commentAuthor?.username || '알 수 없음',
          // posts 테이블: content 또는 description 컬럼 지원
          post_content: post?.content || post?.description,
          post_title: post?.title,
          // posts 테이블: img 또는 photo 컬럼 지원
          post_image: post?.img || post?.photo,
          post_is_hidden: post?.is_hidden,
          // comments 테이블: description 또는 content 컬럼 지원
          comment_content: comment?.description || comment?.content,
          comment_is_hidden: comment?.is_hidden,
          category_name: category?.name || '기타',
          severity_level: category?.severity_level || 1
        };
      });
    } catch (error) {
      console.error('신고 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 신고 상태 업데이트 (관리자용)
   */
  async updateReportStatus(reportId, status, adminAction, adminNotes, isFalseReport = false) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const updateData = {
        status: status,
        admin_id: user?.id || null,
        admin_action: adminAction || null,
        admin_notes: adminNotes || null,
        is_false_report: isFalseReport
      };

      // 처리완료 시 resolved_at 설정
      if (status === 'resolved' || status === 'dismissed') {
        updateData.resolved_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('reports')
        .update(updateData)
        .eq('id', reportId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('신고 상태 업데이트 오류:', error);
      throw error;
    }
  },

  /**
   * 사용자의 신고 기능 비활성화/활성화 (관리자용)
   */
  async toggleUserReportPermission(userId, canReport) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ can_report: canReport })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('사용자 신고 권한 변경 오류:', error);
      throw error;
    }
  },

  /**
   * 허위 신고로 처리 (신고자의 신고 기능 비활성화 옵션)
   */
  async markAsFalseReport(reportId, disableReporter = false) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. 신고를 허위 신고로 표시
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .update({
          status: 'dismissed',
          is_false_report: true,
          admin_id: user?.id || null,
          admin_action: 'no_action',
          admin_notes: '허위 신고로 판정됨',
          resolved_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select('reporter_id')
        .single();

      if (reportError) throw reportError;

      // 2. 신고자의 신고 기능 비활성화 (선택적)
      if (disableReporter && report?.reporter_id) {
        await this.toggleUserReportPermission(report.reporter_id, false);
      }

      return report;
    } catch (error) {
      console.error('허위 신고 처리 오류:', error);
      throw error;
    }
  }
};

export default reportService;
