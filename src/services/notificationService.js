/**
 * notificationService - 개인 알림 서비스
 * 용도: user_notifications 테이블 CRUD + 실시간 구독
 * 알림 타입: comment, reply, like, mention, dm
 */

import { supabase } from '../config/supabase';

export const notificationService = {
  /**
   * 알림 생성 (중복 방지: upsert + ignoreDuplicates)
   * receiver === sender면 생성하지 않음 (자기 게시물에 자기가 댓글 등)
   */
  async createNotification({ receiverId, senderId, type, title, body, url, referenceId, referenceType }) {
    // 자기 자신에 대한 알림 생략
    if (!receiverId || !senderId || receiverId === senderId) return null;

    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .upsert({
          receiver_id: receiverId,
          sender_id: senderId,
          type,
          title,
          body: body || null,
          url: url || null,
          reference_id: referenceId || null,
          reference_type: referenceType || null,
          is_read: false,
        }, {
          onConflict: 'receiver_id,sender_id,type,reference_id,reference_type',
          ignoreDuplicates: true,
        })
        .select()
        .single();

      if (error && error.code !== '23505') {
        // 23505 = unique violation (중복) — 무시
        console.error('알림 생성 오류:', error);
      }
      return data || null;
    } catch (err) {
      console.error('알림 생성 실패:', err);
      return null;
    }
  },

  /**
   * 개인 알림 목록 조회 (sender 정보 join)
   * @param {number} limit - 조회 개수 (기본 50)
   */
  async getNotifications(limit = 50) {
    try {
      const { data, error } = await supabase
        .from('user_notifications')
        .select(`
          id, type, title, body, url, is_read, created_at,
          reference_id, reference_type,
          sender:sender_id (
            id, name, username, profile_pic
          )
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('알림 목록 조회 오류:', err);
      return [];
    }
  },

  /**
   * 미읽은 알림 개수 조회
   * @returns {Promise<number>}
   */
  async getUnreadCount() {
    try {
      const { count, error } = await supabase
        .from('user_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('미읽은 알림 카운트 오류:', err);
      return 0;
    }
  },

  /**
   * 단일 알림 읽음 처리
   * @param {string} notificationId - 알림 ID
   */
  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('알림 읽음 처리 오류:', err);
      return false;
    }
  },

  /**
   * 전체 알림 읽음 처리
   */
  async markAllAsRead() {
    try {
      const { error } = await supabase
        .from('user_notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('전체 읽음 처리 오류:', err);
      return false;
    }
  },

  /**
   * 실시간 알림 구독 (Supabase Realtime)
   * @param {string} userId - 수신자 ID
   * @param {Function} onNewNotification - 새 알림 콜백
   * @returns {Function} unsubscribe 함수
   */
  subscribeToNotifications(userId, onNewNotification) {
    const channel = supabase
      .channel(`user_notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          onNewNotification(payload.new);
        }
      )
      .subscribe();

    // unsubscribe 함수 반환
    return () => {
      supabase.removeChannel(channel);
    };
  },
};
