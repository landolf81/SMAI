import { supabase } from '../config/supabase.js';
import { deleteFromR2, isR2Url } from './r2Service.js';

/**
 * 광고 서비스
 */
export const adService = {
  /**
   * 활성 광고 목록 조회
   */
  async getActiveAds() {
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('ads')
        .select('*')
        .eq('is_active', true)
        .or(`end_date.is.null,end_date.gte.${now}`)
        .order('priority', { ascending: false });

      if (error) throw error;

      console.log('🎯 활성 광고 조회 결과:', {
        total: data?.length || 0,
        ads: data?.map(ad => ({
          id: ad.id,
          title: ad.title,
          priority: ad.priority,
          is_active: ad.is_active,
          end_date: ad.end_date
        }))
      });

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

      console.log('광고 생성 Supabase 데이터:', insertData);

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
      if (updates.link_url !== undefined) updateData.link_url = updates.link_url;
      if (updates.start_date !== undefined) updateData.start_date = updates.start_date;
      if (updates.end_date !== undefined) updateData.end_date = updates.end_date;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.priority_boost !== undefined) updateData.priority = updates.priority_boost;

      console.log('광고 업데이트 Supabase 데이터:', updateData);

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
        .single();

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
              console.log('✅ R2 광고 이미지 삭제:', key);
            }
          } else if (ad.image_url.includes('supabase.co/storage')) {
            // Supabase Storage URL 처리
            const match = ad.image_url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
            if (match) {
              const [, bucket, path] = match;
              const { error: storageError } = await supabase.storage.from(bucket).remove([path]);
              if (storageError) {
                console.warn('Supabase Storage 삭제 실패:', storageError);
              } else {
                console.log('✅ Supabase Storage 광고 이미지 삭제:', path);
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
      // RPC 함수로 클릭 카운터 증가
      const { error: rpcError } = await supabase
        .rpc('increment_ad_clicks', { ad_id_param: adId });

      if (rpcError) {
        console.warn('광고 클릭 카운터 증가 실패 (RPC 함수 미설치):', rpcError.message);
        // RPC 함수가 없어도 계속 진행
      }

      // ad_clicks 테이블에 상세 클릭 기록 추가
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('ad_clicks')
        .insert([{
          ad_id: adId,
          user_id: user?.id || null,
          clicked_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        }]);

      // ad_clicks 삽입 실패는 무시 (테이블이 없어도 계속)
      if (insertError) {
        console.warn('광고 클릭 상세 기록 실패 (테이블 미생성):', insertError.message);
      }

      return { success: true };
    } catch (error) {
      console.warn('광고 클릭 추적 오류 (무시됨):', error);
      // 에러 발생해도 throw 하지 않음
      return { success: false };
    }
  },

  /**
   * 광고 노출 추적
   */
  async trackAdImpression(adId) {
    try {
      // 1. RPC 함수로 노출 카운터 증가
      const { error: rpcError } = await supabase
        .rpc('increment_ad_impressions', { ad_id_param: adId });

      if (rpcError) {
        console.warn('광고 노출 카운터 증가 실패 (RPC 함수 미설치):', rpcError.message);
        // RPC 함수가 없어도 계속 진행 (에러 무시)
      }

      // 2. ad_views 테이블에 상세 노출 기록 추가
      const { data: { user } } = await supabase.auth.getUser();

      const { error: insertError } = await supabase
        .from('ad_views')
        .insert([{
          ad_id: adId,
          user_id: user?.id || null,
          viewed_at: new Date().toISOString(),
          user_agent: navigator.userAgent
        }]);

      // ad_views 삽입 실패는 무시 (테이블이 없어도 계속)
      if (insertError) {
        console.warn('광고 노출 상세 기록 실패 (테이블 미생성):', insertError.message);
      }

      return { success: true };
    } catch (error) {
      console.warn('광고 노출 추적 오류 (무시됨):', error);
      // 에러 발생해도 throw 하지 않음 (광고 표시는 계속)
      return { success: false };
    }
  },

  /**
   * 배치 추적 (여러 이벤트를 한 번에 전송)
   * @param {Object} batchData - 배치 데이터
   * @param {string} batchData.sessionId - 세션 ID
   * @param {Array} batchData.events - 이벤트 배열
   */
  async trackBatch(batchData) {
    try {
      // TODO: ad_events 테이블이 있다면 여기에 이벤트 기록
      // 현재는 간단하게 노출/클릭만 업데이트
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
    } catch (error) {
      console.error('배치 추적 오류:', error);
      throw error;
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
