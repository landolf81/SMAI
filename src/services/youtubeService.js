/**
 * YouTube 동영상 서비스
 * 참외 관련 YouTube 영상 수집 및 관리
 */

import { supabase } from '../config/supabase.js';

export const youtubeService = {
  /**
   * 승인된 YouTube 영상 목록 조회 (피드용)
   * @param {number} limit - 조회 개수
   * @param {number} offset - 오프셋
   */
  async getApprovedVideos(limit = 10, offset = 0) {
    try {
      const { data, error, count } = await supabase
        .from('youtube_videos')
        .select('*', { count: 'exact' })
        .eq('status', 'approved')
        .order('posted_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { videos: data || [], total: count || 0 };
    } catch (error) {
      console.error('승인된 영상 조회 오류:', error);
      return { videos: [], total: 0 };
    }
  },

  /**
   * 최신 승인된 영상 1개 조회 (홈 피드용)
   */
  async getLatestApprovedVideo() {
    try {
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('status', 'approved')
        .order('posted_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('최신 영상 조회 오류:', error);
      return null;
    }
  },

  /**
   * 대기 중인 영상 목록 조회 (관리자용)
   */
  async getPendingVideos() {
    try {
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .eq('status', 'pending')
        .order('collected_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('대기 영상 조회 오류:', error);
      return [];
    }
  },

  /**
   * 모든 영상 목록 조회 (관리자용)
   * @param {string} status - 필터할 상태 (all, pending, approved, rejected)
   */
  async getAllVideos(status = 'all') {
    try {
      let query = supabase
        .from('youtube_videos')
        .select('*')
        .order('published_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('영상 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 영상 승인
   * @param {string} videoId - 영상 UUID
   */
  async approveVideo(videoId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('youtube_videos')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          posted_at: new Date().toISOString()
        })
        .eq('id', videoId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('영상 승인 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 영상 거절
   * @param {string} videoId - 영상 UUID
   * @param {string} reason - 거절 사유
   */
  async rejectVideo(videoId, reason = '') {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('youtube_videos')
        .update({
          status: 'rejected',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          reject_reason: reason
        })
        .eq('id', videoId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('영상 거절 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 영상 삭제
   * @param {string} videoId - 영상 UUID
   */
  async deleteVideo(videoId) {
    try {
      const { error } = await supabase
        .from('youtube_videos')
        .delete()
        .eq('id', videoId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('영상 삭제 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 구독 채널 목록 조회 (관리자용)
   */
  async getChannels() {
    try {
      const { data, error } = await supabase
        .from('youtube_channels')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('채널 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 채널 추가
   * @param {Object} channel - 채널 정보
   */
  async addChannel({ channelId, channelName, channelHandle, filterKeywords }) {
    try {
      const { data, error } = await supabase
        .from('youtube_channels')
        .insert([{
          channel_id: channelId,
          channel_name: channelName,
          channel_handle: channelHandle,
          filter_keywords: filterKeywords || null
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('채널 추가 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 채널 수정
   * @param {string} id - 채널 UUID
   * @param {Object} updates - 수정할 정보
   */
  async updateChannel(id, updates) {
    try {
      const { data, error } = await supabase
        .from('youtube_channels')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('채널 수정 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 채널 삭제
   * @param {string} id - 채널 UUID
   */
  async deleteChannel(id) {
    try {
      const { error } = await supabase
        .from('youtube_channels')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('채널 삭제 오류:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 대기 중인 영상 개수 조회 (관리자용)
   */
  async getPendingCount() {
    try {
      const { count, error } = await supabase
        .from('youtube_videos')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('대기 영상 수 조회 오류:', error);
      return 0;
    }
  },

  /**
   * YouTube 영상 URL 생성
   * @param {string} videoId - YouTube 비디오 ID
   */
  getVideoUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  },

  /**
   * YouTube 임베드 URL 생성
   * @param {string} videoId - YouTube 비디오 ID
   */
  getEmbedUrl(videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  },

  /**
   * YouTube 썸네일 URL 생성
   * @param {string} videoId - YouTube 비디오 ID
   * @param {string} quality - 품질 (default, mqdefault, hqdefault, maxresdefault)
   */
  getThumbnailUrl(videoId, quality = 'hqdefault') {
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
  }
};

export default youtubeService;
