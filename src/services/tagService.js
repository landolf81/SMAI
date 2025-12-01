import { supabase } from '../config/supabase.js';

/**
 * 태그 서비스
 * 모든 태그 관련 Supabase 쿼리를 중앙화
 */
export const tagService = {
  /**
   * 태그 목록 조회
   */
  async getTags() {
    try {
      // 태그 시스템 비활성화 - 빈 배열 반환
      console.warn('태그 시스템이 비활성화되었습니다.');
      return [];
    } catch (error) {
      console.error('태그 목록 조회 오류:', error);
      // 에러 발생 시 빈 배열 반환 (UI가 깨지지 않도록)
      return [];
    }
  },

  /**
   * 태그 검색 (자동완성용)
   * @param {string} query - 검색어
   * @param {number} limit - 결과 개수 제한
   */
  async searchTags(query, limit = 10) {
    try {
      if (!query || query.length < 1) {
        return [];
      }

      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .or(`display_name.ilike.%${query}%,name.ilike.%${query}%`)
        .eq('is_visible', true)
        .eq('is_blocked', false)
        .order('tag_type', { ascending: true }) // official 우선
        .order('is_promoted', { ascending: false })
        .order('post_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('태그 검색 오류:', error);
      return [];
    }
  },

  /**
   * 사용자 태그 생성
   * @param {Object} tagData - { name, displayName, description, color }
   * @param {string} userId - 생성자 ID
   */
  async createUserTag(tagData, userId) {
    try {
      // 중복 체크
      const existing = await this.findTagByName(tagData.name);
      if (existing) {
        return { error: '이미 존재하는 태그입니다', existing };
      }

      // 태그명 검증
      if (!this.validateTagName(tagData.name)) {
        throw new Error('유효하지 않은 태그명입니다. 2-30자의 한글, 영문, 숫자만 사용 가능합니다.');
      }

      // 태그 생성
      const { data, error } = await supabase
        .from('tags')
        .insert({
          name: tagData.name.toLowerCase().replace(/\s+/g, '_'),
          display_name: tagData.displayName || tagData.name,
          description: tagData.description || null,
          color: tagData.color || '#007bff',
          tag_type: 'user',
          created_by: userId,
          permission_level: 'public',
          is_category: false,
          is_visible: true,
          post_count: 0
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('사용자 태그 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 태그명 검증
   * @param {string} name - 태그명
   */
  validateTagName(name) {
    // 1. 길이 제한 (2-30자)
    if (!name || name.length < 2 || name.length > 30) return false;

    // 2. 허용 문자: 영문, 숫자, 한글, 언더스코어, 하이픈
    const regex = /^[a-zA-Z0-9가-힣_-]+$/;
    if (!regex.test(name)) return false;

    // 3. 특수문자 과다 검사 (3개 초과 불가)
    const specialChars = name.replace(/[a-zA-Z0-9가-힣]/g, '');
    if (specialChars.length > 3) return false;

    return true;
  },

  /**
   * 태그명으로 태그 찾기
   * @param {string} name - 태그명
   */
  async findTagByName(name) {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('name', name.toLowerCase().replace(/\s+/g, '_'))
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116: 데이터 없음
      return data || null;
    } catch (error) {
      console.error('태그 조회 오류:', error);
      return null;
    }
  },

  /**
   * 인기 태그 조회
   * @param {number} limit - 결과 개수
   */
  async getPopularTags(limit = 20) {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('is_visible', true)
        .eq('is_blocked', false)
        .order('post_count', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('인기 태그 조회 오류:', error);
      return [];
    }
  },

  /**
   * 사용자가 만든 태그 조회
   * @param {string} userId - 사용자 ID
   * @param {number} limit - 결과 개수
   */
  async getUserCreatedTags(userId, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('created_by', userId)
        .eq('is_blocked', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('사용자 태그 조회 오류:', error);
      return [];
    }
  },

  /**
   * 태그 사용 통계 업데이트
   * @param {string} tagId - 태그 ID
   * @param {string} userId - 사용자 ID
   */
  async incrementTagUsage(tagId, userId) {
    try {
      const { error } = await supabase.rpc('increment_tag_usage', {
        tag_id_param: tagId,
        user_id_param: userId
      });

      if (error) throw error;
    } catch (error) {
      console.error('태그 사용 통계 업데이트 오류:', error);
      // 통계 업데이트 실패는 무시 (중요하지 않은 기능)
    }
  },

  /**
   * 공식 태그 승격 제안
   * @param {Object} suggestionData - { name, displayName, description, reason }
   * @param {string} userId - 제안자 ID
   */
  async suggestOfficialTag(suggestionData, userId) {
    try {
      const { data, error } = await supabase
        .from('tag_suggestions')
        .insert({
          suggested_name: suggestionData.name,
          suggested_display_name: suggestionData.displayName,
          description: suggestionData.description,
          color: suggestionData.color || '#007bff',
          suggested_by: userId,
          suggestion_reason: suggestionData.reason,
          status: 'pending'
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 제안 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 제안 목록 조회
   * @param {string} status - 'pending' | 'approved' | 'rejected' | 'all'
   */
  async getTagSuggestions(status = 'pending') {
    try {
      let query = supabase
        .from('tag_suggestions')
        .select(`
          *,
          users:suggested_by(id, username, name, profile_pic)
        `)
        .order('vote_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('태그 제안 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 태그 제안에 투표
   * @param {string} suggestionId - 제안 ID
   * @param {string} userId - 사용자 ID
   * @param {string} voteType - 'up' | 'down'
   */
  async voteTagSuggestion(suggestionId, userId, voteType = 'up') {
    try {
      const { data, error } = await supabase
        .from('tag_votes')
        .upsert({
          suggestion_id: suggestionId,
          user_id: userId,
          vote_type: voteType
        }, {
          onConflict: 'suggestion_id,user_id'
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 제안 투표 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 생성
   * @param {Object} tagData - 태그 데이터
   */
  async createTag(tagData) {
    try {
      const { data, error } = await supabase
        .from('tags')
        .insert([{
          name: tagData.name,
          display_name: tagData.displayName || tagData.name,
          description: tagData.description || null,
          color: tagData.color,
          permission_level: tagData.permissionLevel || 'member',
          is_category: tagData.isCategory || false,
          is_visible: tagData.isVisible !== false,
          sort_order: tagData.sortOrder || 0,
          post_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 수정
   * @param {string} tagId - 태그 ID
   * @param {Object} updates - 수정할 데이터
   */
  async updateTag(tagId, updates) {
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      };

      // 존재하는 필드만 업데이트에 포함
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.displayName !== undefined) updateData.display_name = updates.displayName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.color !== undefined) updateData.color = updates.color;
      if (updates.permissionLevel !== undefined) updateData.permission_level = updates.permissionLevel;
      if (updates.isCategory !== undefined) updateData.is_category = updates.isCategory;
      if (updates.isVisible !== undefined) updateData.is_visible = updates.isVisible;
      if (updates.sortOrder !== undefined) updateData.sort_order = updates.sortOrder;

      const { data, error } = await supabase
        .from('tags')
        .update(updateData)
        .eq('id', tagId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 삭제
   * @param {string} tagId - 태그 ID
   */
  async deleteTag(tagId) {
    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('id', tagId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('태그 삭제 오류:', error);
      throw error;
    }
  }
};

/**
 * 태그 그룹 서비스
 */
export const tagGroupService = {
  /**
   * 태그 그룹 목록 조회
   */
  async getTagGroups() {
    try {
      const { data, error } = await supabase
        .from('tag_groups')
        .select('*')
        .order('name');

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 그룹 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 그룹 생성
   * @param {Object} groupData - 태그 그룹 데이터
   */
  async createTagGroup(groupData) {
    try {
      const { data, error } = await supabase
        .from('tag_groups')
        .insert([{
          name: groupData.name,
          color: groupData.color,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 그룹 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 그룹 수정
   * @param {string} groupId - 태그 그룹 ID
   * @param {Object} updates - 수정할 데이터
   */
  async updateTagGroup(groupId, updates) {
    try {
      const { data, error } = await supabase
        .from('tag_groups')
        .update({
          name: updates.name,
          color: updates.color,
          updated_at: new Date().toISOString()
        })
        .eq('id', groupId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('태그 그룹 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 그룹 삭제
   * @param {string} groupId - 태그 그룹 ID
   */
  async deleteTagGroup(groupId) {
    try {
      const { error } = await supabase
        .from('tag_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('태그 그룹 삭제 오류:', error);
      throw error;
    }
  }
};

export default tagService;
