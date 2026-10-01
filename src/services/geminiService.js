/** Authenticated same-origin translation/TTS client. Provider keys live only on the server. */
import { supabase } from '../config/supabase.js';
async function invoke(body) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error('로그인 상태를 확인하지 못했습니다.');
  const response = await fetch('/api/translation', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) }, credentials: 'same-origin',
    body: JSON.stringify(body), signal: AbortSignal.timeout(65000),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '번역·음성 서비스 요청에 실패했습니다.');
  }
  return response;
}
const speechRequests = new Map();
const translationTickets = new Map();
export const geminiService = {
  async translate(text, fromLang, toLang) {
    const result = await (await invoke({ action: 'translate', text, fromLang, toLang, requestId: crypto.randomUUID() })).json();
    if (translationTickets.size >= 10) translationTickets.delete(translationTickets.keys().next().value);
    translationTickets.set(JSON.stringify([result.targetTranslation, toLang]), result.requestId);
    return result;
  },
  async textToSpeech(text, langCode) {
    const key = JSON.stringify([text, langCode]);
    if (speechRequests.has(key)) return speechRequests.get(key);
    const pending = (async () => {
      const requestId = translationTickets.get(key);
      if (!requestId) throw new Error('다시 번역한 뒤 음성을 이용해주세요.');
      const response = await invoke({ action: 'tts', text, langCode, requestId });
      if (!response.headers.get('content-type')?.startsWith('audio/wav')) throw new Error('음성 데이터 형식이 올바르지 않습니다.');
      return response.blob();
    })();
    speechRequests.set(key, pending);
    try { return await pending; } finally { speechRequests.delete(key); }
  },
};
