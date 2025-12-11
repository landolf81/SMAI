import { supabase } from '../config/supabase.js';
import { badgeService } from './badgeService.js';

export const verificationService = {
  /**
   * 인증 요청 생성
   */
  async createRequest(data) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('로그인이 필요합니다.');

    // 기존 대기 중인 요청 확인
    const { data: existing } = await supabase
      .from('verification_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'code_sent'])
      .maybeSingle();

    if (existing) {
      throw new Error('이미 진행 중인 인증 요청이 있습니다.');
    }

    const { data: request, error } = await supabase
      .from('verification_requests')
      .insert([{
        user_id: user.id,
        real_name: data.realName,
        phone_number: data.phoneNumber,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return request;
  },

  /**
   * 내 인증 요청 상태 조회
   */
  async getMyRequest() {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;

    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * 인증 코드 확인 및 자동 승인
   */
  async verifyCode(code) {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) throw new Error('로그인이 필요합니다.');

    // 코드 확인
    const { data: request, error } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('user_id', user.id)
      .eq('verification_code', code)
      .eq('status', 'code_sent')
      .maybeSingle();

    if (error) throw error;
    if (!request) throw new Error('유효하지 않은 인증 코드입니다.');

    // 만료 확인
    if (request.code_expires_at && new Date(request.code_expires_at) < new Date()) {
      throw new Error('인증 코드가 만료되었습니다. 관리자에게 재발급을 요청해주세요.');
    }

    // 승인 처리
    return await this.completeVerification(user.id, request.id);
  },

  /**
   * 인증 완료 처리 (users.verified 업데이트 + 뱃지 발급)
   */
  async completeVerification(userId, requestId) {
    // 1. 인증 요청 승인으로 변경
    const { error: updateError } = await supabase
      .from('verification_requests')
      .update({
        status: 'approved',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // 2. users.verified = true 설정
    const { error: userError } = await supabase
      .from('users')
      .update({
        verified: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (userError) throw userError;

    // 3. 인증 뱃지 자동 발급 (중복 확인)
    try {
      const existingBadges = await badgeService.getUserBadges(userId);
      const hasVerifiedBadge = existingBadges.some(b => b.badge_type === 'verified_user');

      if (!hasVerifiedBadge) {
        await badgeService.addBadge({
          userId: userId,
          badgeType: 'verified_user',
          badgeName: '인증됨',
          badgeColor: '#10B981'
        });
      }
    } catch (badgeError) {
      console.error('뱃지 발급 오류:', badgeError);
      // 뱃지 발급 실패해도 인증은 완료된 것으로 처리
    }

    return { success: true };
  },

  // ========== 관리자 전용 메서드 ==========

  /**
   * 모든 인증 요청 조회 (관리자용)
   */
  async getAllRequests(options = {}) {
    const { status = 'all', page = 1, limit = 20, search = '' } = options;

    // 1. 인증 요청 기본 데이터 조회
    let query = supabase
      .from('verification_requests')
      .select('*', { count: 'exact' });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`real_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (error) throw error;

    // 2. 사용자 정보 일괄 조회 (N+1 문제 해결)
    const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
    let usersMap = {};

    if (userIds.length > 0) {
      try {
        // 한 번의 쿼리로 모든 사용자 정보 조회
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, username, name, email, profile_pic, verified')
          .in('id', userIds);

        if (!usersError && usersData) {
          usersData.forEach(user => {
            usersMap[user.id] = user;
          });
        }
      } catch (err) {
        console.error('사용자 정보 조회 실패:', err);
      }
    }

    // 3. 데이터 결합
    const requests = (data || []).map(request => ({
      ...request,
      users: usersMap[request.user_id] || null
    }));

    return {
      requests,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  },

  /**
   * 인증 요청 통계 조회
   */
  async getStats() {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('status');

    if (error) throw error;

    const stats = {
      total: data.length,
      pending: 0,
      code_sent: 0,
      approved: 0,
      rejected: 0
    };

    data.forEach(item => {
      if (stats[item.status] !== undefined) {
        stats[item.status]++;
      }
    });

    return stats;
  },

  /**
   * 인증 코드 생성 (관리자용)
   */
  async generateCode(requestId) {
    const { data: { session } } = await supabase.auth.getSession();
    const admin = session?.user;
    if (!admin) throw new Error('로그인이 필요합니다.');

    // 6자리 숫자 코드 생성
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24시간 유효

    const { data, error } = await supabase
      .from('verification_requests')
      .update({
        verification_code: code,
        code_generated_at: new Date().toISOString(),
        code_expires_at: expiresAt.toISOString(),
        status: 'code_sent',
        processed_by: admin.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select('*')
      .single();

    if (error) throw error;
    return { code, request: data };
  },

  /**
   * 관리자 직접 승인
   */
  async approveRequest(requestId) {
    const { data: { session } } = await supabase.auth.getSession();
    const admin = session?.user;
    if (!admin) throw new Error('로그인이 필요합니다.');

    // 요청 정보 조회
    const { data: request, error: fetchError } = await supabase
      .from('verification_requests')
      .select('user_id')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;

    // 승인 처리
    const { error: updateError } = await supabase
      .from('verification_requests')
      .update({
        status: 'approved',
        processed_by: admin.id,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) throw updateError;

    // users.verified 업데이트 및 뱃지 발급
    return await this.completeVerification(request.user_id, requestId);
  },

  /**
   * 관리자 거부
   */
  async rejectRequest(requestId, reason = '') {
    const { data: { session } } = await supabase.auth.getSession();
    const admin = session?.user;
    if (!admin) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('verification_requests')
      .update({
        status: 'rejected',
        processed_by: admin.id,
        processed_at: new Date().toISOString(),
        rejection_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};

export default verificationService;
