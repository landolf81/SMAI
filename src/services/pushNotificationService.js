/**
 * 푸시 알림 구독 관리 서비스
 * Web Push API를 통한 구독/해제/상태 관리
 */

import { supabase } from '../config/supabase.js';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/**
 * VAPID 공개키를 Uint8Array로 변환 (PushManager.subscribe에 필요)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushNotificationService = {
  /**
   * 푸시 알림 지원 여부 확인
   */
  isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  /**
   * 현재 알림 권한 상태
   * @returns {'granted' | 'denied' | 'default'}
   */
  getPermissionStatus() {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  /**
   * 알림 권한 요청
   * @returns {Promise<'granted' | 'denied' | 'default'>}
   */
  async requestPermission() {
    if (!this.isSupported()) return 'denied';
    return await Notification.requestPermission();
  },

  /**
   * 현재 구독 상태 확인
   * @returns {Promise<boolean>}
   */
  async isSubscribed() {
    if (!this.isSupported()) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      return !!subscription;
    } catch {
      return false;
    }
  },

  /**
   * 푸시 알림 구독
   * @param {string} userId - 현재 로그인 사용자 ID
   * @returns {Promise<boolean>} 구독 성공 여부
   */
  async subscribe(userId) {
    if (!this.isSupported() || !VAPID_PUBLIC_KEY) {
      console.warn('[Push] 지원되지 않거나 VAPID 키가 없습니다.');
      return false;
    }

    try {
      // 1. 알림 권한 요청
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push] 알림 권한 거부됨');
        return false;
      }

      // 2. SW 준비 대기
      const registration = await navigator.serviceWorker.ready;

      // 3. 기존 구독이 있으면 재사용
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // 4. 새 구독 생성
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 5. Supabase에 저장
      const subscriptionJSON = subscription.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert(
        {
          user_id: userId,
          endpoint: subscriptionJSON.endpoint,
          keys: {
            p256dh: subscriptionJSON.keys.p256dh,
            auth: subscriptionJSON.keys.auth,
          },
        },
        { onConflict: 'user_id,endpoint' }
      );

      if (error) {
        console.error('[Push] 구독 저장 실패:', error);
        return false;
      }

      console.log('[Push] 구독 완료');
      return true;
    } catch (error) {
      console.error('[Push] 구독 오류:', error);
      return false;
    }
  },

  /**
   * 푸시 알림 구독 해제
   * @param {string} userId - 현재 로그인 사용자 ID
   * @returns {Promise<boolean>} 해제 성공 여부
   */
  async unsubscribe(userId) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 1. 브라우저 구독 해제
        await subscription.unsubscribe();

        // 2. Supabase에서 삭제
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', subscription.endpoint);

        if (error) {
          console.error('[Push] 구독 삭제 실패:', error);
        }
      }

      return true;
    } catch (error) {
      console.error('[Push] 구독 해제 오류:', error);
      return false;
    }
  },

  /**
   * 구독자 수 조회 (관리자용)
   * @returns {Promise<number>}
   */
  async getSubscriberCount() {
    const { count, error } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[Push] 구독자 수 조회 실패:', error);
      return 0;
    }
    return count || 0;
  },

  /**
   * 푸시 발송 (관리자용 - Edge Function 호출)
   * @param {Object} payload - { title, body, url }
   * @returns {Promise<{ success: boolean, sent: number, failed: number }>}
   */
  async sendPush({ title, body, url }) {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { title, body, url },
    });

    if (error) {
      console.error('[Push] 발송 실패:', error);
      throw error;
    }

    return data;
  },
};

export default pushNotificationService;
