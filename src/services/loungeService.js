/**
 * loungeService.js
 * 역할: 광장(단체 채팅방) 메시지 CRUD + Realtime 구독
 */
import { supabase } from '../config/supabase.js';
import { pushNotificationService } from './pushNotificationService.js';
import { storageService } from './storageService.js';
import { v4 as uuidv4 } from 'uuid';
import { POLL_SELECT } from './loungePollService.js';

/** 기본 select (video_url 없이) */
const MSG_SELECT_BASE = `
  id, content, image_url, image_urls, created_at, user_id, is_hidden, poll_id,
  users:user_id (id, name, username, profile_pic),
  lounge_polls:poll_id ( ${POLL_SELECT} )
`;

/** video_url 포함 select */
const MSG_SELECT_WITH_VIDEO = `
  id, content, image_url, image_urls, video_url, created_at, user_id, is_hidden, poll_id,
  users:user_id (id, name, username, profile_pic),
  lounge_polls:poll_id ( ${POLL_SELECT} )
`;

/** video_url 컬럼 존재 여부 — 모듈 로드 시 백그라운드 체크 (요청 차단 없음) */
let hasVideoColumn = false;
(() => {
  supabase.from('lounge_messages').select('video_url').limit(0)
    .then(({ error }) => { hasVideoColumn = !error; });
})();
const getMsgSelect = () => hasVideoColumn ? MSG_SELECT_WITH_VIDEO : MSG_SELECT_BASE;

const loungeService = {
  /**
   * 메시지 목록 조회 (cursor 기반 페이지네이션)
   * @param {Object} options
   * @param {string|null} options.beforeTime - 이 시각보다 이전 메시지만 (null이면 최신부터)
   * @param {number} options.limit - 가져올 개수 (기본 30)
   * @returns {Promise<Array>} 최신순(내림차순)으로 정렬된 메시지 배열
   */
  async getMessages({ beforeTime = null, limit = 30 } = {}) {
    let query = supabase
      .from('lounge_messages')
      .select(getMsgSelect())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (beforeTime) {
      query = query.lt('created_at', beforeTime);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * 메시지 전송
   * @param {string} content - 메시지 내용 (최대 300자)
   * @returns {Promise<Object>} 삽입된 메시지
   */
  async sendMessage(content, imageUrl = null, imageUrls = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const row = { user_id: user.id };
    if (content?.trim()) row.content = content.trim();
    if (imageUrl) row.image_url = imageUrl;
    if (imageUrls && imageUrls.length > 0) row.image_urls = imageUrls;

    const { data, error } = await supabase
      .from('lounge_messages')
      .insert(row)
      .select(getMsgSelect())
      .single();

    if (error) throw error;

    // @멘션 푸시 알림 (fire-and-forget) — greedy DB 매칭
    // @뒤의 텍스트를 3단어→2단어→1단어 순으로 DB 조회하여 실제 닉네임만 매칭
    const mentionStarts = [];
    for (let idx = 0; idx < (content || '').length; idx++) {
      if (content[idx] === '@' && (idx === 0 || content[idx - 1] === ' ' || content[idx - 1] === '\n')) {
        mentionStarts.push(idx);
      }
    }
    for (const start of mentionStarts) {
      const after = content.slice(start + 1);
      const words = after.split(/\s+/).filter(Boolean).slice(0, 3);
      // 3단어 → 2단어 → 1단어 순으로 시도
      (async () => {
        for (let len = words.length; len >= 1; len--) {
          const candidate = words.slice(0, len).join(' ');
          if (!candidate) continue;
          const { data: mentioned } = await supabase
            .from('users')
            .select('id')
            .eq('name', candidate)
            .maybeSingle();
          if (mentioned && mentioned.id !== user.id) {
            pushNotificationService.sendMentionPush({
              receiverId: mentioned.id,
              senderName: data.users?.name || '누군가',
              content,
            }).catch(() => {});
            break; // 가장 긴 매칭으로 확정
          }
        }
      })();
    }

    return data;
  },

  /**
   * 메시지 삭제 (본인 메시지만)
   * @param {string} id - 메시지 UUID
   */
  async deleteMessage(id) {
    const { error } = await supabase
      .from('lounge_messages')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * 메시지 숨기기/복구 (관리자 전용)
   * @param {string} id - 메시지 UUID
   * @param {boolean} isHidden - true: 숨기기, false: 복구
   */
  async hideMessage(id, isHidden) {
    const { error } = await supabase
      .from('lounge_messages')
      .update({ is_hidden: isHidden })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * 특정 시각 이후 새 메시지가 있는지 확인 (head-only 경량 쿼리)
   * @param {string} sinceTime - ISO 8601 timestamp
   * @returns {Promise<boolean>}
   */
  async hasNewMessagesSince(sinceTime) {
    try {
      const { count, error } = await supabase
        .from('lounge_messages')
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
   * 새 메시지 실시간 구독
   * @param {Function} onNewMessage - 새 메시지 수신 시 콜백 (메시지 객체 전달)
   * @returns {{ unsubscribe: Function }}
   */
  subscribeToNewMessages(onNewMessage) {
    const channel = supabase
      .channel('lounge-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'lounge_messages' },
        async (payload) => {
          if (!payload.new?.id) return;

          // users + poll 정보 포함해서 조회
          const { data } = await supabase
            .from('lounge_messages')
            .select(getMsgSelect())
            .eq('id', payload.new.id)
            .single();

          if (data) onNewMessage(data);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[Lounge] Realtime 구독 실패');
        }
      });

    return {
      unsubscribe: () => supabase.removeChannel(channel),
    };
  },

  /**
   * 광장 이미지 업로드 (CF Images) — 단일
   * @param {File} file - 이미지 파일
   * @returns {Promise<string>} 업로드된 이미지 URL
   */
  async uploadLoungeImage(file) {
    const ext = file.name.split('.').pop();
    const filename = `${uuidv4()}.${ext}`;
    const result = await storageService.uploadFile('lounge', `images/${filename}`, file);
    return result.url;
  },

  /**
   * 광장 이미지 다중 업로드 (CF Images) — 순차 업로드
   * @param {File[]} files - 이미지 파일 배열 (최대 5개)
   * @returns {Promise<string[]>} 업로드된 이미지 URL 배열
   */
  async uploadLoungeImages(files) {
    const urls = [];
    for (const file of files) {
      const ext = file.name.split('.').pop();
      const filename = `${uuidv4()}.${ext}`;
      const result = await storageService.uploadFile('lounge', `images/${filename}`, file);
      urls.push(result.url);
    }
    return urls;
  },
};

export default loungeService;
