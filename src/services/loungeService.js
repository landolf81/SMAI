/**
 * loungeService.js
 * 역할: 광장(단체 채팅방) 메시지 CRUD + Realtime 구독
 */
import { supabase } from '../config/supabase.js';
import { pushNotificationService } from './pushNotificationService.js';

const loungeService = {
  /**
   * 메시지 목록 조회 (cursor 기반 페이지네이션)
   * @param {Object} options
   * @param {string|null} options.beforeTime - 이 시각보다 이전 메시지만 (null이면 최신부터)
   * @param {number} options.limit - 가져올 개수 (기본 30)
   * @returns {Promise<Array>} 오래된 순으로 정렬된 메시지 배열
   */
  async getMessages({ beforeTime = null, limit = 30 } = {}) {
    let query = supabase
      .from('lounge_messages')
      .select(`
        id,
        content,
        created_at,
        user_id,
        is_hidden,
        users:user_id (id, name, username, profile_pic)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (beforeTime) {
      query = query.lt('created_at', beforeTime);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 내림차순으로 받았으므로 뒤집어서 오래된 순으로 반환
    return (data || []).reverse();
  },

  /**
   * 메시지 전송
   * @param {string} content - 메시지 내용 (최대 300자)
   * @returns {Promise<Object>} 삽입된 메시지
   */
  async sendMessage(content) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('lounge_messages')
      .insert({ user_id: user.id, content: content.trim() })
      .select(`
        id,
        content,
        created_at,
        user_id,
        is_hidden,
        users:user_id (id, name, username, profile_pic)
      `)
      .single();

    if (error) throw error;

    // @멘션 푸시 알림 (fire-and-forget)
    const mentionRegex = /@([가-힣a-zA-Z0-9_-]+(?:\s[가-힣a-zA-Z0-9_-]+){0,2})/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const mentionedName = match[1];
      supabase
        .from('users')
        .select('id')
        .eq('name', mentionedName)
        .maybeSingle()
        .then(({ data: mentioned }) => {
          if (mentioned && mentioned.id !== user.id) {
            pushNotificationService.sendMentionPush({
              receiverId: mentioned.id,
              senderName: data.users?.name || '누군가',
              content,
            }).catch(() => {});
          }
        })
        .catch(() => {});
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

          // users 정보 포함해서 조회
          const { data } = await supabase
            .from('lounge_messages')
            .select(`
              id,
              content,
              created_at,
              user_id,
              is_hidden,
              users:user_id (id, name, username, profile_pic)
            `)
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
};

export default loungeService;
