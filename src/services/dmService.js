import { supabase } from '../config/supabase.js';

// DM 기능 사용 가능 여부 캐시 (세션 동안 유지)
let dmFeatureAvailable = null;

/**
 * DM 테이블 스키마 확인 (receiver_id 컬럼 존재 여부)
 * @returns {Promise<boolean>} DM 기능 사용 가능 여부
 */
async function checkDMTableSchema() {
  // 이미 확인된 경우 캐시된 결과 반환
  if (dmFeatureAvailable !== null) {
    return dmFeatureAvailable;
  }

  try {
    // receiver_id 컬럼만 선택하여 스키마 확인
    const { error } = await supabase
      .from('messages')
      .select('receiver_id')
      .limit(0); // 데이터 없이 스키마만 확인

    if (error) {
      if (error.code === '42703' || error.message.includes('does not exist') || error.code === '42P01') {
        // DM 테이블이 아직 생성되지 않았거나 스키마가 다름 - 조용히 비활성화
        dmFeatureAvailable = false;
        return false;
      }
    }

    dmFeatureAvailable = true;
    return true;
  } catch {
    dmFeatureAvailable = false;
    return false;
  }
}

/**
 * DM (Direct Message) 서비스
 * 다이렉트 메시지 관련 Supabase 쿼리를 중앙화
 */
export const dmService = {
  /**
   * 대화 목록 조회
   * @returns {Promise<Array>} 대화 목록
   */
  async getConversations() {
    try {
      // DM 테이블 스키마 확인 (캐시됨)
      const isAvailable = await checkDMTableSchema();
      if (!isAvailable) {
        return [];
      }

      // 읽기 전용 - 캐시된 세션 사용
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // messages 테이블에서 현재 사용자가 참여한 대화 조회
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, is_read, created_at')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (messagesError) {
        // receiver_id 컬럼이 없는 경우 (테이블 스키마 불일치)
        if (messagesError.code === '42703') {
          dmFeatureAvailable = false; // 캐시 업데이트
          return [];
        }
        throw messagesError;
      }

      if (!messagesData || messagesData.length === 0) {
        return [];
      }

      // 관련 사용자 ID 수집
      const userIds = new Set();
      messagesData.forEach(msg => {
        if (msg.sender_id !== user.id) userIds.add(msg.sender_id);
        if (msg.receiver_id !== user.id) userIds.add(msg.receiver_id);
      });

      // 사용자 정보 조회
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, name, profile_pic')
        .in('id', Array.from(userIds));

      if (usersError) {
        console.warn('사용자 정보 조회 실패:', usersError);
      }

      // 사용자 정보 맵 생성
      const usersMap = new Map();
      (usersData || []).forEach(u => usersMap.set(u.id, u));

      // 대화 상대별로 그룹화하여 마지막 메시지 추출
      const conversationsMap = new Map();

      messagesData.forEach(message => {
        const isOutgoing = message.sender_id === user.id;
        const otherUserId = isOutgoing ? message.receiver_id : message.sender_id;
        const otherUser = usersMap.get(otherUserId);

        if (!conversationsMap.has(otherUserId)) {
          conversationsMap.set(otherUserId, {
            id: otherUserId, // 대화 ID를 상대방 ID로 사용
            other_user_id: otherUserId,
            other_user_name: otherUser?.name,
            other_user_username: otherUser?.username,
            other_user_profile: otherUser?.profile_pic,
            last_message: message.content,
            last_message_time: message.created_at,
            is_read: isOutgoing ? true : message.is_read,
            unread_count: 0
          });
        }

        // 읽지 않은 메시지 수 계산
        if (!isOutgoing && !message.is_read) {
          conversationsMap.get(otherUserId).unread_count++;
        }
      });

      return Array.from(conversationsMap.values());
    } catch (error) {
      console.error('대화 목록 조회 오류:', error);
      // 에러 발생 시 빈 배열 반환 (페이지 깨짐 방지)
      return [];
    }
  },

  /**
   * 특정 사용자와의 메시지 목록 조회
   * @param {string} otherUserId - 상대방 사용자 ID
   * @returns {Promise<Array>} 메시지 목록
   */
  async getMessages(otherUserId) {
    try {
      // DM 테이블 스키마 확인 (캐시됨)
      const isAvailable = await checkDMTableSchema();
      if (!isAvailable) {
        return [];
      }

      // 읽기 전용 - 캐시된 세션 사용
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 메시지 조회
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (messagesError) {
        if (messagesError.code === '42703') {
          dmFeatureAvailable = false;
        }
        return [];
      }

      if (!messagesData || messagesData.length === 0) {
        return [];
      }

      // 관련 사용자 정보 조회
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, username, name, profile_pic')
        .in('id', [user.id, otherUserId]);

      if (usersError) {
        console.warn('사용자 정보 조회 실패:', usersError);
      }

      // 사용자 정보 맵 생성
      const usersMap = new Map();
      (usersData || []).forEach(u => usersMap.set(u.id, u));

      return messagesData.map(msg => {
        const sender = usersMap.get(msg.sender_id);
        const receiver = usersMap.get(msg.receiver_id);
        return {
          ...msg,
          sender_name: sender?.name,
          sender_username: sender?.username,
          sender_profile: sender?.profile_pic,
          receiver_name: receiver?.name,
          receiver_username: receiver?.username,
          receiver_profile: receiver?.profile_pic
        };
      });
    } catch (error) {
      console.error('메시지 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 메시지 전송
   * @param {Object} messageData - 메시지 데이터
   * @param {string} messageData.receiverId - 수신자 ID
   * @param {string} messageData.content - 메시지 내용
   * @returns {Promise<Object>} 생성된 메시지
   */
  async sendMessage(messageData) {
    try {
      // DM 테이블 스키마 확인 (캐시됨)
      const isAvailable = await checkDMTableSchema();
      if (!isAvailable) {
        throw new Error('DM 기능은 현재 준비 중입니다.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          sender_id: user.id,
          receiver_id: messageData.receiverId,
          content: messageData.content,
          is_read: false,
          created_at: now,
          updated_at: now
        }])
        .select()
        .single();

      if (error) {
        console.error('Supabase 메시지 전송 에러:', error);
        if (error.code === '42703') {
          dmFeatureAvailable = false;
          throw new Error('DM 기능은 현재 준비 중입니다.');
        }
        throw new Error(`메시지 전송에 실패했습니다: ${error.message || error.code}`);
      }

      return data;
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      throw error;
    }
  },

  /**
   * 메시지를 읽음으로 표시
   * @param {string} messageId - 메시지 ID
   * @returns {Promise<Object>} 업데이트된 메시지
   */
  async markAsRead(messageId) {
    try {
      // DM 테이블 스키마 확인 (캐시됨)
      const isAvailable = await checkDMTableSchema();
      if (!isAvailable) {
        return null;
      }

      const { data, error } = await supabase
        .from('messages')
        .update({
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch {
      return null;
    }
  },

  /**
   * 특정 사용자로부터 받은 모든 메시지를 읽음으로 표시
   * @param {string} senderId - 발신자 ID
   * @returns {Promise<void>}
   */
  async markAllAsReadFromUser(senderId) {
    try {
      // DM 테이블 스키마 확인 (캐시됨)
      const isAvailable = await checkDMTableSchema();
      if (!isAvailable) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      await supabase
        .from('messages')
        .update({
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('sender_id', senderId)
        .eq('receiver_id', user.id)
        .eq('is_read', false);
    } catch {
      // 조용히 실패
    }
  },

  /**
   * 읽지 않은 메시지 수 조회
   * @returns {Promise<number>} 읽지 않은 메시지 수
   */
  async getUnreadCount() {
    try {
      // DM 테이블 스키마 확인 (캐시됨)
      const isAvailable = await checkDMTableSchema();
      if (!isAvailable) {
        return 0;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        return 0;
      }

      // 읽지 않은 메시지 수 조회
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', user.id)
        .eq('is_read', false);

      if (error) {
        if (error.code === '42703') {
          dmFeatureAvailable = false;
        }
        return 0;
      }

      return count || 0;
    } catch {
      return 0;
    }
  },

  /**
   * 메시지 삭제
   * @param {string} messageId - 메시지 ID
   * @returns {Promise<void>}
   */
  async deleteMessage(messageId) {
    try {
      // DM 테이블 스키마 확인 (캐시됨)
      const isAvailable = await checkDMTableSchema();
      if (!isAvailable) {
        throw new Error('DM 기능은 현재 준비 중입니다.');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', user.id); // 본인이 보낸 메시지만 삭제 가능

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('메시지 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 실시간 메시지 구독
   * @param {string} userId - 현재 사용자 ID
   * @param {Function} onNewMessage - 새 메시지 콜백
   * @returns {Object} 구독 객체 (unsubscribe 메서드 포함)
   */
  subscribeToMessages(userId, onNewMessage) {
    try {
      // DM 기능이 아직 구현되지 않은 경우를 대비한 안전한 구독
      // messages 테이블에 receiver_id 컬럼이 없으면 구독이 실패할 수 있음
      const subscription = supabase
        .channel('dm-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages'
            // receiver_id 필터 제거 - 스키마 불일치 방지
            // 클라이언트에서 필터링 처리
          },
          (payload) => {
            // 클라이언트 측에서 receiver_id 확인
            if (payload.new && payload.new.receiver_id === userId) {
              onNewMessage(payload.new);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.warn('DM 실시간 구독 실패 - messages 테이블 스키마 불일치 가능성');
          }
        });

      return {
        unsubscribe: () => {
          supabase.removeChannel(subscription);
        }
      };
    } catch (error) {
      console.warn('DM 실시간 구독 설정 실패:', error.message);
      // 빈 구독 객체 반환 (에러 방지)
      return {
        unsubscribe: () => {}
      };
    }
  }
};

export default dmService;
