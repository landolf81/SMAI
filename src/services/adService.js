import { supabase } from '../config/supabase.js';
import { deleteFromR2, isR2Url } from './r2Service.js';

// v2: end_date/start_date 필터 YYYY-MM-DD 형식 사용
/**
 * 광고 서비스
 * - 메모리 캐시로 세션 내 중복 노출 추적 방지
 */

// 세션 내 노출 추적 메모리 캐시 (adId_YYYY-MM-DD 키)
const _trackedImpressions = new Set();
// 진행 중인 trackAdImpression Promise (레이스 컨디션 방지)
const _pendingImpressions = new Map();

/** KST 기준 오늘 날짜 문자열 (YYYY-MM-DD) */
const _getKstToday = () => {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().split('T')[0];
};

export const adService = {
  /**
   * 활성 광고 목록 조회
   */
  async getActiveAds() {
    try {
      const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .eq('is_active', true)
        .or(`end_date.is.null,end_date.gte.${today}`)
        .lte('start_date', today)
        .order('priority', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('활성 광고 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 목록 조회 (관리자용)
   */
  async getAds() {
    try {
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Supabase 컬럼명을 프론트엔드에서 기대하는 필드명으로 변환
      return (data || []).map(ad => ({
        ...ad,
        view_count: ad.impressions || 0,
        click_count: ad.clicks || 0
      }));
    } catch (error) {
      console.error('광고 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 목록 조회 (페이징 및 정렬 지원)
   * @param {Object} options - 조회 옵션
   */
  async getAdsWithOptions(options = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      // 총 개수 조회
      const { count, error: countError } = await supabase
        .from('ads')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;

      // 데이터 조회
      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .order(sortBy, { ascending: sortOrder.toLowerCase() === 'asc' })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw error;

      // Supabase 컬럼명을 프론트엔드에서 기대하는 필드명으로 변환
      const transformedAds = (data || []).map(ad => ({
        ...ad,
        view_count: ad.impressions || 0,
        click_count: ad.clicks || 0
      }));

      return {
        ads: transformedAds,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };
    } catch (error) {
      console.error('광고 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 생성
   */
  async createAd(adData) {
    try {
      // snake_case로 변환
      const insertData = {
        title: adData.title || '',
        content: adData.content || '',
        image_url: adData.image_url || null,
        link_url: adData.link_url || null,
        start_date: adData.start_date || null,
        end_date: adData.end_date || null,
        is_active: adData.is_active !== undefined ? adData.is_active : true,
        priority: adData.priority_boost || adData.priority || 0,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('ads')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('광고 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 수정
   */
  async updateAd(adId, updates) {
    try {
      // snake_case로 변환 및 존재하는 필드만 추가
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.content !== undefined) updateData.content = updates.content;
      if (updates.image_url !== undefined) updateData.image_url = updates.image_url;
      if (updates.link_url !== undefined) updateData.link_url = updates.link_url || null;
      // 빈 문자열은 null로 변환 (PostgreSQL date 타입은 빈 문자열 불가)
      if (updates.start_date !== undefined) updateData.start_date = updates.start_date || null;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date || null;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.priority_boost !== undefined) updateData.priority = updates.priority_boost;

      const { data, error } = await supabase
        .from('ads')
        .update(updateData)
        .eq('id', adId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('광고 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 삭제 (Storage 파일도 함께 삭제)
   */
  async deleteAd(adId) {
    try {
      // 1. 광고 정보 조회 (이미지 URL 확인)
      const { data: ad, error: fetchError } = await supabase
        .from('ads')
        .select('image_url')
        .eq('id', adId)
        .maybeSingle();

      if (fetchError) {
        console.warn('광고 조회 실패:', fetchError);
      }

      // 2. 이미지 파일 삭제
      if (ad?.image_url) {
        try {
          if (isR2Url(ad.image_url)) {
            // R2 URL에서 키 추출 후 삭제
            const key = ad.image_url.split('.r2.dev/')[1] || ad.image_url.split('r2.cloudflarestorage.com/')[1];
            if (key) {
              await deleteFromR2(key);
            }
          } else if (ad.image_url.includes('supabase.co/storage')) {
            // Supabase Storage URL 처리
            const match = ad.image_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
            if (match) {
              const [, bucket, path] = match;
              const { error: storageError } = await supabase.storage.from(bucket).remove([path]);
              if (storageError) {
                console.warn('Supabase Storage 삭제 실패:', storageError);
              }
            }
          }
        } catch (mediaError) {
          // 이미지 삭제 실패해도 DB 삭제는 진행
          console.warn('광고 이미지 삭제 실패:', mediaError);
        }
      }

      // 3. DB에서 광고 레코드 삭제
      const { error } = await supabase
        .from('ads')
        .delete()
        .eq('id', adId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('광고 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 활성화 상태 토글
   */
  async toggleAdStatus(adId) {
    try {
      // 현재 상태 조회
      const { data: currentAd, error: fetchError } = await supabase
        .from('ads')
        .select('is_active')
        .eq('id', adId)
        .single();

      if (fetchError) throw fetchError;

      // 상태 반전
      const { data, error } = await supabase
        .from('ads')
        .update({
          is_active: !currentAd.is_active,
          updated_at: new Date().toISOString()
        })
        .eq('id', adId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('광고 상태 토글 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 클릭 추적
   */
  async trackAdClick(adId) {
    try {
      const { error: rpcError } = await supabase
        .rpc('increment_ad_clicks', { ad_id_param: adId });

      if (rpcError) {
        console.warn('클릭 카운터 RPC 실패:', rpcError.message);
      }

      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      await supabase
        .from('ad_clicks')
        .insert([{
          ad_id: adId,
          user_id: user?.id || null,
          clicked_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        }]);

      return { success: true };
    } catch {
      return { success: false };
    }
  },

  /**
   * 광고 노출 추적 (메모리 캐시 + DB 중복 체크)
   * - 1차: 메모리 캐시 (Set) → 같은 세션 내 즉시 차단 (레이스 컨디션 방지)
   * - 2차: DB ad_views 테이블 → 페이지 새로고침 후에도 하루 1회 보장
   * - 3차: Promise 잠금 → 동시 호출 시 하나만 실행
   */
  async trackAdImpression(adId) {
    const todayKey = `${adId}_${_getKstToday()}`;

    // 1차: 메모리 캐시 (즉시 차단, 레이스 컨디션 방지)
    if (_trackedImpressions.has(todayKey)) {
      return { success: true, skipped: true };
    }

    // 2차: 이미 진행 중인 동일 광고 추적이 있으면 대기 후 스킵
    if (_pendingImpressions.has(todayKey)) {
      await _pendingImpressions.get(todayKey).catch(() => {});
      return { success: true, skipped: true };
    }

    // 즉시 캐시에 등록 (다른 동시 호출 차단)
    _trackedImpressions.add(todayKey);

    const trackPromise = this._doTrackImpression(adId, todayKey);
    _pendingImpressions.set(todayKey, trackPromise);

    try {
      return await trackPromise;
    } finally {
      _pendingImpressions.delete(todayKey);
    }
  },

  /** 실제 노출 추적 로직 (내부용) */
  async _doTrackImpression(adId, todayKey) {
    try {
      const sessionId = this._getSessionId();
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      // KST 자정을 UTC로 변환 (정확한 날짜 비교)
      const kstToday = _getKstToday();
      const kstMidnightUtc = new Date(`${kstToday}T00:00:00+09:00`).toISOString();

      // DB 중복 체크 (페이지 새로고침 대응)
      let query = supabase
        .from('ad_views')
        .select('id')
        .eq('ad_id', adId)
        .gte('viewed_at', kstMidnightUtc);

      if (user?.id) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.eq('session_id', sessionId);
      }

      const { data: existingView } = await query.limit(1);

      if (existingView && existingView.length > 0) {
        return { success: true, skipped: true };
      }

      // 카운터 증가 + 기록 삽입
      await supabase.rpc('increment_ad_impressions', { ad_id_param: adId });

      await supabase
        .from('ad_views')
        .insert([{
          ad_id: adId,
          user_id: user?.id || null,
          session_id: sessionId,
          viewed_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        }]);

      return { success: true };
    } catch {
      // 실패 시 캐시에서 제거 (다음 기회에 재시도 가능)
      _trackedImpressions.delete(todayKey);
      return { success: false };
    }
  },

  /**
   * 세션 ID 가져오기 (비로그인 사용자 식별)
   */
  _getSessionId() {
    let sessionId = localStorage.getItem('ad_session_id');
    if (!sessionId) {
      sessionId = 'ad_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('ad_session_id', sessionId);
    }
    return sessionId;
  },

  /**
   * 배치 추적 (여러 이벤트를 한 번에 전송)
   * @param {Object} batchData - 배치 데이터
   * @param {string} batchData.sessionId - 세션 ID
   * @param {Array} batchData.events - 이벤트 배열
   */
  async trackBatch(batchData) {
    try {
      const promises = batchData.events.map(event => {
        if (event.type === 'view') {
          return this.trackAdImpression(event.adId);
        } else if (event.type === 'click') {
          return this.trackAdClick(event.adId);
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      return { success: true };
    } catch {
      return { success: false };
    }
  },

  /**
   * 광고 미디어 목록 조회
   * @param {string} adId - 광고 ID
   */
  async getAdMedia(adId) {
    try {
      const { data, error } = await supabase
        .from('ad_media')
        .select('*')
        .eq('ad_id', adId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('광고 미디어 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 미디어 추가
   * @param {string} adId - 광고 ID
   * @param {Array} mediaUrls - 미디어 URL 배열
   */
  async addAdMedia(adId, mediaUrls) {
    try {
      // 현재 최대 순서 번호 조회
      const { data: existingMedia } = await supabase
        .from('ad_media')
        .select('display_order')
        .eq('ad_id', adId)
        .order('display_order', { ascending: false })
        .limit(1);

      const startOrder = existingMedia && existingMedia.length > 0
        ? existingMedia[0].display_order + 1
        : 0;

      // 미디어 데이터 생성
      const mediaData = mediaUrls.map((url, index) => ({
        ad_id: adId,
        media_url: url,
        media_type: url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image',
        display_order: startOrder + index,
        created_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('ad_media')
        .insert(mediaData)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('광고 미디어 추가 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 미디어 삭제
   * @param {string} mediaId - 미디어 ID
   */
  async deleteAdMedia(mediaId) {
    try {
      const { error } = await supabase
        .from('ad_media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('광고 미디어 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 광고 미디어 순서 변경
   * @param {Array} mediaOrder - 순서 정보 배열 [{ id, display_order }]
   */
  async updateMediaOrder(mediaOrder) {
    try {
      // 각 미디어의 순서를 개별적으로 업데이트
      const promises = mediaOrder.map(item =>
        supabase
          .from('ad_media')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
      );

      await Promise.all(promises);
      return { success: true };
    } catch (error) {
      console.error('미디어 순서 변경 오류:', error);
      throw error;
    }
  }
};

export default adService;
