/**
 * pesticideService
 * 역할: 참외 등록 농약 정보 조회 (pesticide_registry 테이블)
 * 데이터 소스: 식품안전나라 Open API → Edge Function으로 DB 동기화
 */

import { supabase } from '../config/supabase.js';

export const pesticideService = {
  /**
   * 참외 농약 전체 목록 조회
   * @returns {Promise<Array>} 농약 목록
   */
  async getAll() {
    const { data, error } = await supabase
      .from('pesticide_registry')
      .select('*')
      .eq('crop_name', '참외')
      .order('pest_disease', { ascending: true });

    if (error) {
      console.error('농약 목록 조회 오류:', error);
      return [];
    }
    return data || [];
  },

  /**
   * 키워드 검색 (농약명/상표명/병해충명)
   * @param {string} keyword 검색어
   * @returns {Promise<Array>}
   */
  async search(keyword) {
    if (!keyword || keyword.trim().length === 0) return this.getAll();

    const term = `%${keyword.trim()}%`;
    const { data, error } = await supabase
      .from('pesticide_registry')
      .select('*')
      .eq('crop_name', '참외')
      .or(`pesticide_name.ilike.${term},brand_name.ilike.${term},pest_disease.ilike.${term}`)
      .order('pest_disease', { ascending: true });

    if (error) {
      console.error('농약 검색 오류:', error);
      return [];
    }
    return data || [];
  },

  /**
   * 병해충별 필터
   * @param {string} pestDisease 병해충명
   * @returns {Promise<Array>}
   */
  async getByPestDisease(pestDisease) {
    const { data, error } = await supabase
      .from('pesticide_registry')
      .select('*')
      .eq('crop_name', '참외')
      .eq('pest_disease', pestDisease)
      .order('brand_name', { ascending: true });

    if (error) {
      console.error('병해충별 농약 조회 오류:', error);
      return [];
    }
    return data || [];
  },

  /**
   * 용도별 필터 (살균제/살충제 등)
   * @param {string} purpose 용도
   * @returns {Promise<Array>}
   */
  async getByPurpose(purpose) {
    const { data, error } = await supabase
      .from('pesticide_registry')
      .select('*')
      .eq('crop_name', '참외')
      .eq('purpose', purpose)
      .order('pest_disease', { ascending: true });

    if (error) {
      console.error('용도별 농약 조회 오류:', error);
      return [];
    }
    return data || [];
  },

  /**
   * 고유 병해충 목록 조회 (필터 칩용)
   * @returns {Promise<string[]>}
   */
  async getPestDiseaseList() {
    const { data, error } = await supabase
      .from('pesticide_registry')
      .select('pest_disease')
      .eq('crop_name', '참외')
      .order('pest_disease', { ascending: true });

    if (error) {
      console.error('병해충 목록 조회 오류:', error);
      return [];
    }

    // 고유값 추출
    const unique = [...new Set((data || []).map(d => d.pest_disease).filter(Boolean))];
    return unique;
  },
};
