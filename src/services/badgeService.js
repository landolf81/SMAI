import { supabase } from '../config/supabase.js';
import { storageService } from './storageService.js';

/**
 * 뱃지 서비스
 * 사용자 인증 뱃지 관리
 */
export const badgeService = {
  /**
   * 뱃지 타입 목록 조회
   */
  async getBadgeTypes() {
    try {
      const { data, error } = await supabase
        .from('badge_types')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('뱃지 타입 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 특정 뱃지 타입 정보 조회
   * @param {string} badgeType - 뱃지 타입 ID
   */
  async getBadgeTypeInfo(badgeType) {
    try {
      const { data, error } = await supabase
        .from('badge_types')
        .select('*')
        .eq('type', badgeType)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('뱃지 타입 정보 조회 오류:', error);
      return null;
    }
  },

  /**
   * 모든 사용자 뱃지 조회 (관리자용)
   */
  async getAllBadges() {
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .select(`
          *,
          users!user_id (
            id,
            username,
            name,
            profile_pic
          ),
          verified_by_user:users!verified_by (
            name,
            username
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data.map(badge => ({
        id: badge.id,
        user_id: badge.user_id,
        username: badge.users?.username,
        user_name: badge.users?.name,
        profilePic: badge.users?.profile_pic,
        profilePicUrl: storageService.getProfileImageUrl(badge.users?.profile_pic, badge.user_id), // Supabase Storage URL
        badge_type: badge.badge_type,
        badge_name: badge.badge_name,
        badge_color: badge.badge_color,
        icon_type: badge.icon_type,
        icon_value: badge.icon_value,
        icon_background: badge.icon_background,
        verified_by: badge.verified_by,
        verified_by_name: badge.verified_by_user?.name || badge.verified_by_user?.username,
        created_at: badge.created_at
      }));
    } catch (error) {
      console.error('전체 뱃지 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 특정 사용자의 뱃지 조회
   * @param {string} userId - 사용자 ID
   */
  async getUserBadges(userId) {
    try {
      // 1. user_badges 조회
      const { data: userBadges, error } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!userBadges || userBadges.length === 0) return [];

      // 2. 고유한 badge_type 목록 추출
      const badgeTypes = [...new Set(userBadges.map(b => b.badge_type))];

      // 3. badge_types 테이블에서 해당 타입 정보 조회
      const { data: typeInfos } = await supabase
        .from('badge_types')
        .select('*')
        .in('type', badgeTypes);

      // 4. badge_type별 정보 맵 생성
      const typeInfoMap = new Map();
      (typeInfos || []).forEach(info => {
        typeInfoMap.set(info.type, info);
      });

      // 5. user_badges에 badge_types 정보 병합
      return userBadges.map(badge => {
        const typeInfo = typeInfoMap.get(badge.badge_type);
        return {
          ...badge,
          // badge_types에서 가져온 정보 (없으면 user_badges 값 사용)
          badge_name: badge.badge_name || typeInfo?.name,
          badge_color: badge.badge_color || typeInfo?.color,
          icon_type: badge.icon_type || typeInfo?.icon_type,
          icon_value: badge.icon_value || typeInfo?.icon_value,
          icon_url: badge.icon_url || typeInfo?.icon_url,
          icon_background: badge.icon_background || typeInfo?.icon_background
        };
      });
    } catch (error) {
      console.error('사용자 뱃지 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 뱃지 추가
   * @param {Object} badgeData - 뱃지 데이터
   */
  async addBadge(badgeData) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const insertData = {
        user_id: badgeData.userId,
        badge_type: badgeData.badgeType,
        badge_name: badgeData.badgeName,
        badge_color: badgeData.badgeColor,
        verified_by: user.id,
        created_at: new Date().toISOString()
      };

      // 아이콘 관련 필드 추가 (있는 경우)
      if (badgeData.iconType) {
        insertData.icon_type = badgeData.iconType;
      }
      if (badgeData.iconValue !== undefined) {
        insertData.icon_value = badgeData.iconValue;
      }
      if (badgeData.iconBackground) {
        insertData.icon_background = badgeData.iconBackground;
      }

      const { data, error } = await supabase
        .from('user_badges')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('뱃지 추가 오류:', error);
      throw error;
    }
  },

  /**
   * 뱃지 추가 (legacy alias)
   */
  async createBadge(badgeData) {
    return this.addBadge(badgeData);
  },

  /**
   * 뱃지 수정
   * @param {string} badgeId - 뱃지 ID
   * @param {Object} updates - 수정할 데이터
   */
  async updateBadge(badgeId, updates) {
    try {
      const { data, error } = await supabase
        .from('user_badges')
        .update({
          badge_type: updates.badgeType,
          badge_name: updates.badgeName,
          badge_color: updates.badgeColor,
          updated_at: new Date().toISOString()
        })
        .eq('id', badgeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('뱃지 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 뱃지 삭제
   * @param {string} badgeId - 뱃지 ID
   */
  async deleteBadge(badgeId) {
    try {
      const { error } = await supabase
        .from('user_badges')
        .delete()
        .eq('id', badgeId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('뱃지 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 뱃지 타입 추가
   * @param {Object} typeData - 뱃지 타입 데이터
   */
  async addBadgeType(typeData) {
    try {
      // 이미지 타입일 때 iconValue는 URL이므로 icon_url에도 저장
      const iconUrl = typeData.iconType === 'image' ? typeData.iconValue : null;

      const insertData = {
        type: typeData.type,
        name: typeData.name,
        description: typeData.description,
        color: typeData.color,
        sort_order: typeData.sortOrder || 0,
        icon_type: typeData.iconType || 'color',
        icon_value: typeData.iconValue || null,
        icon_url: iconUrl,  // 이미지 URL 별도 저장
        icon_background: typeData.iconBackground || 'transparent',
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('badge_types')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('뱃지 타입 추가 오류:', error);
      throw error;
    }
  },

  /**
   * 뱃지 타입 추가 (legacy alias)
   */
  async createBadgeType(typeData) {
    return this.addBadgeType(typeData);
  },

  /**
   * 뱃지 타입 수정
   * @param {string} typeId - 뱃지 타입 ID
   * @param {Object} updates - 수정할 데이터
   */
  async updateBadgeType(typeId, updates) {
    try {
      const updateData = {
        type: updates.type,
        name: updates.name,
        description: updates.description,
        color: updates.color,
        sort_order: updates.sortOrder,
        updated_at: new Date().toISOString()
      };

      // 아이콘 관련 필드가 있으면 추가
      if (updates.iconType !== undefined) {
        updateData.icon_type = updates.iconType;
      }
      if (updates.iconValue !== undefined) {
        updateData.icon_value = updates.iconValue;
        // 이미지 타입일 때 iconValue는 URL이므로 icon_url에도 저장
        if (updates.iconType === 'image') {
          updateData.icon_url = updates.iconValue;
        } else {
          updateData.icon_url = null;
        }
      }
      if (updates.iconBackground !== undefined) {
        updateData.icon_background = updates.iconBackground;
      }

      const { data, error } = await supabase
        .from('badge_types')
        .update(updateData)
        .eq('id', typeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('뱃지 타입 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 뱃지 타입 삭제
   * @param {string} typeId - 뱃지 타입 ID
   */
  async deleteBadgeType(typeId) {
    try {
      const { error } = await supabase
        .from('badge_types')
        .delete()
        .eq('id', typeId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('뱃지 타입 삭제 오류:', error);
      throw error;
    }
  }
};

export default badgeService;
