/**
 * adPollService.js
 * 역할: 광고(ads) 투표(Poll) CRUD + 투표 토글 + Realtime 구독
 *
 * loungePollService와 동일한 패턴이지만 아래 차이점이 있음:
 * - 테이블: ad_polls, ad_poll_options, ad_poll_votes
 * - 투표는 광고(ad_id) 에 귀속됨 (lounge_messages 연결 없음)
 * - createPoll 후 ads 테이블의 poll_id 컬럼을 업데이트
 * - deletePoll: 투표 삭제 + ads.poll_id 초기화 (관리자 수정용)
 */
import { supabase } from '../config/supabase.js';

/** 광고 투표의 선택지를 포함한 poll 조인 쿼리 문자열 */
export const AD_POLL_SELECT = `
  id, question, is_anonymous, is_multiple, expires_at, is_closed, total_votes, ad_id, created_at,
  ad_poll_options ( id, label, sort_order, vote_count )
`;

const adPollService = {
  /**
   * 광고 투표 생성 (투표 + 선택지 + ads.poll_id 업데이트)
   * @param {Object} params
   * @param {string} params.adId - 연결할 광고 ID
   * @param {string} params.question - 질문 (최대 100자)
   * @param {string[]} params.options - 선택지 배열 (2~8개)
   * @param {boolean} params.isAnonymous - 익명 여부
   * @param {boolean} params.isMultiple - 복수 선택 허용 여부
   * @param {number|null} params.expiresInHours - 만료 시간 (null이면 무기한)
   * @returns {Promise<Object>} 생성된 poll 데이터 (선택지 포함)
   */
  async createPoll({ adId, question, options, isAnonymous = false, isMultiple = false, expiresInHours = null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // 1) 만료 시간 계산
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    // 2) 투표 생성 (ad_id로 귀속)
    const { data: poll, error: pollErr } = await supabase
      .from('ad_polls')
      .insert({
        ad_id: adId,
        question: question.trim(),
        is_anonymous: isAnonymous,
        is_multiple: isMultiple,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (pollErr) throw pollErr;

    // 3) 선택지 생성
    const optionRows = options.map((label, idx) => ({
      poll_id: poll.id,
      label: label.trim(),
      sort_order: idx,
    }));

    const { error: optErr } = await supabase
      .from('ad_poll_options')
      .insert(optionRows);

    if (optErr) throw optErr;

    // 4) ads 테이블에 poll_id 연결
    const { error: adErr } = await supabase
      .from('ads')
      .update({ poll_id: poll.id })
      .eq('id', adId);

    if (adErr) throw adErr;

    // 5) 생성된 투표 전체 데이터 반환 (선택지 포함)
    const { data: pollData, error: fetchErr } = await supabase
      .from('ad_polls')
      .select(AD_POLL_SELECT)
      .eq('id', poll.id)
      .single();

    if (fetchErr) throw fetchErr;
    return pollData;
  },

  /**
   * 특정 광고 투표 데이터 조회 (선택지 포함)
   * @param {string} pollId
   * @returns {Promise<Object>} poll 데이터 + options
   */
  async getPollData(pollId) {
    const { data, error } = await supabase
      .from('ad_polls')
      .select(AD_POLL_SELECT)
      .eq('id', pollId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 현재 유저의 특정 투표에 대한 투표 목록 조회
   * @param {string} pollId
   * @returns {Promise<string[]>} 투표한 option_id 배열
   */
  async getMyVotes(pollId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('ad_poll_votes')
      .select('option_id')
      .eq('poll_id', pollId)
      .eq('user_id', user.id);

    if (error) throw error;
    return (data || []).map((v) => v.option_id);
  },

  /**
   * 여러 광고 투표에 대한 내 투표 일괄 조회
   * @param {string[]} pollIds
   * @returns {Promise<Object>} { pollId: [optionId, ...], ... }
   */
  async batchGetMyVotes(pollIds) {
    if (!pollIds.length) return {};

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('ad_poll_votes')
      .select('poll_id, option_id')
      .in('poll_id', pollIds)
      .eq('user_id', user.id);

    if (error) throw error;

    const result = {};
    for (const v of (data || [])) {
      if (!result[v.poll_id]) result[v.poll_id] = [];
      result[v.poll_id].push(v.option_id);
    }
    return result;
  },

  /**
   * 투표 토글 (투표/취소)
   * - 단일선택: 다른 옵션 선택 시 기존 삭제 → 새 투표, 같은 옵션이면 취소
   * - 복수선택: 해당 옵션만 토글
   * @param {string} pollId
   * @param {string} optionId
   * @param {boolean} isMultiple - 복수선택 투표인지
   * @returns {Promise<{ voted: boolean }>}
   */
  async toggleVote(pollId, optionId, isMultiple = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // 이미 이 옵션에 투표했는지 확인
    const { data: existing } = await supabase
      .from('ad_poll_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('option_id', optionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // 이미 투표 → 취소
      const { error } = await supabase
        .from('ad_poll_votes')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return { voted: false };
    }

    // 단일선택: 기존 다른 옵션 투표 삭제
    if (!isMultiple) {
      await supabase
        .from('ad_poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', user.id);
    }

    // 새 투표 삽입
    const { error } = await supabase
      .from('ad_poll_votes')
      .insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: user.id,
      });

    if (error) throw error;
    return { voted: true };
  },

  /**
   * 투표 마감 (관리자만)
   * @param {string} pollId
   */
  async closePoll(pollId) {
    const { error } = await supabase
      .from('ad_polls')
      .update({ is_closed: true })
      .eq('id', pollId);

    if (error) throw error;
  },

  /**
   * 투표 삭제 + ads.poll_id 초기화 (관리자 광고 수정 시 사용)
   * CASCADE 설정으로 ad_polls 삭제 시 options, votes 자동 삭제
   * @param {string} pollId
   * @param {string} adId - 연결된 광고 ID
   */
  async deletePoll(pollId, adId) {
    // 1) ads.poll_id 초기화 (FK 참조 해제)
    const { error: adErr } = await supabase
      .from('ads')
      .update({ poll_id: null })
      .eq('id', adId);

    if (adErr) throw adErr;

    // 2) 투표 삭제 (CASCADE로 options, votes 자동 삭제)
    const { error: pollErr } = await supabase
      .from('ad_polls')
      .delete()
      .eq('id', pollId);

    if (pollErr) throw pollErr;
  },

  /**
   * 광고 투표 결과 실시간 구독
   * @param {Function} onVoteChange - 투표 변경 시 콜백 (payload 전달)
   * @returns {{ unsubscribe: Function }}
   */
  subscribeToVotes(onVoteChange) {
    const channel = supabase
      .channel('ad-poll-votes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ad_poll_votes' },
        (payload) => {
          onVoteChange(payload);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => supabase.removeChannel(channel),
    };
  },
};

export default adPollService;
