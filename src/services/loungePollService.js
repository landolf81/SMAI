/**
 * loungePollService.js
 * 역할: 광장 투표(Poll) CRUD + 투표 토글 + Realtime 구독
 */
import { supabase } from '../config/supabase.js';

/** 투표의 선택지 + 내 투표 여부를 포함한 poll 조인 쿼리 문자열 */
export const POLL_SELECT = `
  id, question, is_anonymous, is_multiple, expires_at, is_closed, total_votes, user_id, created_at,
  lounge_poll_options ( id, label, sort_order, vote_count )
`;

const loungePollService = {
  /**
   * 투표 생성 (투표 + 선택지 + 메시지 일괄)
   * @param {Object} params
   * @param {string} params.question - 질문 (최대 100자)
   * @param {string[]} params.options - 선택지 배열 (2~8개)
   * @param {boolean} params.isAnonymous - 익명 여부
   * @param {boolean} params.isMultiple - 복수 선택 허용 여부
   * @param {string|null} params.content - 함께 보낼 텍스트 (선택)
   * @param {number|null} params.expiresInHours - 만료 시간 (null이면 무기한)
   * @returns {Promise<Object>} 생성된 lounge_message (poll 포함)
   */
  async createPoll({ question, options, isAnonymous = false, isMultiple = false, content = null, expiresInHours = null }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    // 1) 투표 생성
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
      : null;

    const { data: poll, error: pollErr } = await supabase
      .from('lounge_polls')
      .insert({
        user_id: user.id,
        question: question.trim(),
        is_anonymous: isAnonymous,
        is_multiple: isMultiple,
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (pollErr) throw pollErr;

    // 2) 선택지 생성
    const optionRows = options.map((label, idx) => ({
      poll_id: poll.id,
      label: label.trim(),
      sort_order: idx,
    }));

    const { error: optErr } = await supabase
      .from('lounge_poll_options')
      .insert(optionRows);

    if (optErr) throw optErr;

    // 3) 메시지 생성 (poll_id 포함)
    const msgRow = {
      user_id: user.id,
      poll_id: poll.id,
    };
    if (content?.trim()) msgRow.content = content.trim();

    const { data: msg, error: msgErr } = await supabase
      .from('lounge_messages')
      .insert(msgRow)
      .select(`
        id, content, image_url, created_at, user_id, is_hidden, poll_id,
        users:user_id ( id, name, username, profile_pic ),
        lounge_polls:poll_id ( ${POLL_SELECT} )
      `)
      .single();

    if (msgErr) throw msgErr;
    return msg;
  },

  /**
   * 특정 투표 데이터 조회 (선택지 포함)
   * @param {string} pollId
   * @returns {Promise<Object>} poll 데이터 + options
   */
  async getPollData(pollId) {
    const { data, error } = await supabase
      .from('lounge_polls')
      .select(POLL_SELECT)
      .eq('id', pollId)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * 현재 유저의 투표 목록 조회
   * @param {string} pollId
   * @returns {Promise<string[]>} 투표한 option_id 배열
   */
  async getMyVotes(pollId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('lounge_poll_votes')
      .select('option_id')
      .eq('poll_id', pollId)
      .eq('user_id', user.id);

    if (error) throw error;
    return (data || []).map((v) => v.option_id);
  },

  /**
   * 여러 투표에 대한 내 투표 일괄 조회
   * @param {string[]} pollIds
   * @returns {Promise<Object>} { pollId: [optionId, ...], ... }
   */
  async batchGetMyVotes(pollIds) {
    if (!pollIds.length) return {};

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('lounge_poll_votes')
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
      .from('lounge_poll_votes')
      .select('id')
      .eq('poll_id', pollId)
      .eq('option_id', optionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // 이미 투표 → 취소
      const { error } = await supabase
        .from('lounge_poll_votes')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return { voted: false };
    }

    // 단일선택: 기존 다른 옵션 투표 삭제
    if (!isMultiple) {
      await supabase
        .from('lounge_poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', user.id);
    }

    // 새 투표 삽입
    const { error } = await supabase
      .from('lounge_poll_votes')
      .insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: user.id,
      });

    if (error) throw error;
    return { voted: true };
  },

  /**
   * 투표 마감 (작성자만)
   * @param {string} pollId
   */
  async closePoll(pollId) {
    const { error } = await supabase
      .from('lounge_polls')
      .update({ is_closed: true })
      .eq('id', pollId);

    if (error) throw error;
  },

  /**
   * 투표 결과 실시간 구독
   * @param {Function} onVoteChange - 투표 변경 시 콜백 (payload 전달)
   * @returns {{ unsubscribe: Function }}
   */
  subscribeToVotes(onVoteChange) {
    const channel = supabase
      .channel('lounge-poll-votes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lounge_poll_votes' },
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

export default loungePollService;
