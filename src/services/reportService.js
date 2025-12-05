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
          post_author_id: post?.user_id || null,
          post_author_username: postAuthor?.username || '알 수 없음',
          comment_author_id: comment?.user_id || null,
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
  },

  /**
   * 신고 처리 결과를 게시물/댓글 작성자에게 DM으로 알림
   * @param {Object} params - DM 파라미터
   * @param {string} params.receiverId - 수신자 ID (게시물/댓글 작성자)
   * @param {string} params.action - 처리 액션 (hide_post, delete_post, warn_user, suspend_user, ban_user 등)
   * @param {string} params.contentType - 콘텐츠 타입 ('post' 또는 'comment')
   * @param {string} params.reason - 신고 사유 (선택)
   */
  async sendReportResultDM({ receiverId, action, contentType, reason, adminId }) {
    try {
      if (!receiverId) {
        console.warn('DM 수신자 ID가 없습니다.');
        return null;
      }

      // 현재 로그인한 관리자 ID 가져오기
      let senderId = adminId;
      if (!senderId) {
        const { data: { user } } = await supabase.auth.getUser();
        senderId = user?.id;
      }

      if (!senderId) {
        console.warn('관리자 ID를 가져올 수 없습니다.');
        return null;
      }

      // 액션에 따른 메시지 생성
      const actionMessages = {
        hide_post: '게시물이 커뮤니티 가이드라인 위반으로 숨김 처리되었습니다.',
        delete_post: '게시물이 커뮤니티 가이드라인 위반으로 삭제되었습니다.',
        hide_comment: '댓글이 커뮤니티 가이드라인 위반으로 숨김 처리되었습니다.',
        delete_comment: '댓글이 커뮤니티 가이드라인 위반으로 삭제되었습니다.',
        warn_user: '커뮤니티 가이드라인 위반으로 경고 조치가 내려졌습니다. 반복 시 계정이 정지될 수 있습니다.',
        suspend_user: '커뮤니티 가이드라인 위반으로 계정이 7일간 정지되었습니다.',
        ban_user: '커뮤니티 가이드라인 심각한 위반으로 계정이 영구 정지되었습니다.'
      };

      const message = actionMessages[action] || `${contentType === 'comment' ? '댓글' : '게시물'}에 대한 신고가 처리되었습니다.`;

      // 전체 메시지 구성
      let fullMessage = `[시스템 알림]\n\n${message}`;
      if (reason) {
        fullMessage += `\n\n신고 사유: ${reason}`;
      }
      fullMessage += '\n\n문의사항이 있으시면 고객센터로 연락해 주세요.';

      // DM 전송 (messages 테이블에 직접 삽입)
      // 현재 로그인한 관리자를 발신자로 설정
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: senderId, // 관리자 ID
          receiver_id: receiverId,
          content: fullMessage,
          is_read: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        // DM 테이블이 없거나 스키마가 다른 경우 무시
        if (error.code === '42703' || error.code === '42P01') {
          console.log('DM 기능이 비활성화되어 있습니다.');
          return null;
        }
        console.error('신고 결과 DM 전송 실패:', error);
        return null;
      }

      return data;
    } catch (error) {
      // DM 전송 실패해도 신고 처리는 정상 진행
      console.error('신고 결과 DM 전송 오류:', error);
      return null;
    }
  },

  /**
   * 특정 사용자가 받은 경고 횟수 조회
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Object>} 경고 통계 { warningCount, suspensionCount, banCount, totalActions }
   */
  async getUserWarningStats(userId) {
    try {
      if (!userId) return { warningCount: 0, suspensionCount: 0, banCount: 0, totalActions: 0 };

      // 해당 사용자의 게시물 ID 조회
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', userId);

      // 해당 사용자의 댓글 ID 조회
      const { data: userComments } = await supabase
        .from('comments')
        .select('id')
        .eq('user_id', userId);

      const postIds = (userPosts || []).map(p => p.id);
      const commentIds = (userComments || []).map(c => c.id);

      if (postIds.length === 0 && commentIds.length === 0) {
        return { warningCount: 0, suspensionCount: 0, banCount: 0, totalActions: 0 };
      }

      // 신고 처리 기록에서 해당 사용자의 콘텐츠에 대한 조치 조회
      let query = supabase
        .from('reports')
        .select('admin_action, resolved_at')
        .eq('status', 'resolved')
        .in('admin_action', ['warn_user', 'suspend_user', 'ban_user']);

      // 게시물 또는 댓글 필터
      if (postIds.length > 0 && commentIds.length > 0) {
        query = query.or(`post_id.in.(${postIds.join(',')}),comment_id.in.(${commentIds.join(',')})`);
      } else if (postIds.length > 0) {
        query = query.in('post_id', postIds);
      } else {
        query = query.in('comment_id', commentIds);
      }

      const { data: reports, error } = await query.order('resolved_at', { ascending: false });

      if (error) {
        console.error('경고 통계 조회 오류:', error);
        return { warningCount: 0, suspensionCount: 0, banCount: 0, totalActions: 0 };
      }

      // 액션별 횟수 계산
      const stats = {
        warningCount: 0,
        suspensionCount: 0,
        banCount: 0,
        totalActions: 0,
        history: []
      };

      (reports || []).forEach(report => {
        stats.totalActions++;
        if (report.admin_action === 'warn_user') stats.warningCount++;
        else if (report.admin_action === 'suspend_user') stats.suspensionCount++;
        else if (report.admin_action === 'ban_user') stats.banCount++;

        stats.history.push({
          action: report.admin_action,
          date: report.resolved_at
        });
      });

      return stats;
    } catch (error) {
      console.error('사용자 경고 통계 조회 오류:', error);
      return { warningCount: 0, suspensionCount: 0, banCount: 0, totalActions: 0 };
    }
  }
};

export default reportService;
