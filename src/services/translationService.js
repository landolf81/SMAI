/**
 * 번역 히스토리 서비스
 */

import { supabase } from '../config/supabase.js';
import { r2Service } from './r2Service.js';

export const translationService = {
  /**
   * 번역 히스토리 저장
   * @param {Object} data - 번역 데이터
   * @param {Blob} audioBlob - 오디오 Blob
   * @returns {Promise<Object>} 저장된 히스토리
   */
  async saveHistory(data, audioBlob, userId) {
    if (!userId) throw new Error('로그인이 필요합니다.');

    let audioUrl = null;

    // 오디오를 R2에 업로드
    if (audioBlob) {
      try {
        // Blob을 File 객체로 변환 (Azure TTS는 MP3 반환)
        const fileName = `${userId}_${Date.now()}.mp3`;
        const audioFile = new File([audioBlob], fileName, { type: 'audio/mpeg' });

        // R2에 업로드 (folder: 'translation-audio')
        const result = await r2Service.upload(audioFile, 'translation-audio');
        audioUrl = result.url;
      } catch (error) {
        console.error('오디오 업로드 실패:', error);
        // 오디오 업로드 실패해도 텍스트는 저장
      }
    }

    // 히스토리 저장
    const { data: history, error } = await supabase
      .from('translation_history')
      .insert({
        user_id: userId,
        input_text: data.inputText,
        input_lang: data.inputLang,
        target_lang: data.targetLang,
        target_translation: data.targetTranslation,
        back_translation: data.backTranslation,
        audio_url: audioUrl
      })
      .select()
      .single();

    if (error) throw error;
    return history;
  },

  /**
   * 번역 히스토리 목록 조회
   * @param {number} limit - 조회 개수
   * @param {string} userId - 사용자 ID
   * @returns {Promise<Array>} 히스토리 목록
   */
  async getHistory(limit = 100, userId) {
    if (!userId) throw new Error('로그인이 필요합니다.');

    const { data, error } = await supabase
      .from('translation_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * 번역 히스토리 삭제
   * @param {string} historyId - 히스토리 ID
   * @param {string} userId - 사용자 ID
   */
  async deleteHistory(historyId, userId) {
    if (!userId) throw new Error('로그인이 필요합니다.');

    // 히스토리 조회 (오디오 URL 확인용)
    const { data: history } = await supabase
      .from('translation_history')
      .select('audio_url')
      .eq('id', historyId)
      .eq('user_id', userId)
      .single();

    // R2에서 오디오 삭제
    if (history?.audio_url) {
      try {
        const key = r2Service.extractKey(history.audio_url);
        if (key) {
          await r2Service.delete(key);
        }
      } catch (error) {
        console.error('오디오 삭제 실패:', error);
      }
    }

    // DB에서 히스토리 삭제
    const { error } = await supabase
      .from('translation_history')
      .delete()
      .eq('id', historyId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  /**
   * 히스토리 개수 조회
   * @param {string} userId - 사용자 ID
   */
  async getHistoryCount(userId) {
    if (!userId) throw new Error('로그인이 필요합니다.');

    const { count, error } = await supabase
      .from('translation_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw error;
    return count || 0;
  }
};
