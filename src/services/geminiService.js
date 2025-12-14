/**
 * Gemini API 서비스
 * 다국어 번역 및 역번역 기능
 */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

const LANG_NAMES = {
  ko: 'Korean',
  vi: 'Vietnamese',
  th: 'Thai',
  lo: 'Lao'
};

export const geminiService = {
  /**
   * 텍스트 번역 (정방향 + 역번역)
   * @param {string} text - 번역할 텍스트
   * @param {string} fromLang - 입력 언어 코드 (ko, vi, th, lo)
   * @param {string} toLang - 번역 언어 코드 (ko, vi, th, lo)
   * @returns {Promise<{targetTranslation: string, backTranslation: string}>}
   */
  async translate(text, fromLang, toLang) {
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
    }

    if (!text || !text.trim()) {
      throw new Error('번역할 텍스트를 입력해주세요.');
    }

    if (fromLang === toLang) {
      throw new Error('입력 언어와 번역 언어가 동일합니다.');
    }

    const fromLangName = LANG_NAMES[fromLang];
    const toLangName = LANG_NAMES[toLang];

    if (!fromLangName || !toLangName) {
      throw new Error('지원하지 않는 언어입니다.');
    }

    const prompt = `You are a professional translator.

Task:
1. First, understand the meaning and context of the original text.
2. Break down complex sentences into simpler, easier-to-understand concepts.
3. Translate the text from ${fromLangName} to ${toLangName} in a natural, easy-to-understand way.
4. Then translate the result back to ${fromLangName} (back-translation for verification).

Original text (${fromLangName}):
${text}

Please respond in the following JSON format:
{
  "targetTranslation": "natural and easy-to-understand translation in ${toLangName}",
  "backTranslation": "back-translation in ${fromLangName}"
}

IMPORTANT:
- Make the translation natural and easy to understand, not literal.
- Use simple, clear language that conveys the meaning effectively.
- Return ONLY the JSON object, no additional text.`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Gemini API 오류:', errorData);

        if (response.status === 400) {
          throw new Error('잘못된 요청입니다. API 키를 확인하세요.');
        } else if (response.status === 403) {
          throw new Error('API 키 권한이 없습니다.');
        } else if (response.status === 429) {
          throw new Error('API 사용량 초과입니다. 잠시 후 다시 시도하세요.');
        } else {
          throw new Error(`API 오류: ${response.status}`);
        }
      }

      const data = await response.json();

      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('번역 결과를 받을 수 없습니다.');
      }

      const responseText = data.candidates[0].content.parts[0].text;

      // JSON 추출 (```json ... ``` 형태일 수 있음)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        console.error('JSON 파싱 실패. 원본 응답:', responseText);
        throw new Error('번역 결과 형식이 올바르지 않습니다.');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.targetTranslation || !parsed.backTranslation) {
        throw new Error('번역 결과가 불완전합니다.');
      }

      return {
        targetTranslation: parsed.targetTranslation,
        backTranslation: parsed.backTranslation
      };

    } catch (error) {
      // JSON 파싱 오류나 네트워크 오류 처리
      if (error.name === 'SyntaxError') {
        throw new Error('번역 결과 파싱에 실패했습니다.');
      }

      if (error.message.includes('Failed to fetch')) {
        throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.');
      }

      throw error;
    }
  },

  /**
   * Azure TTS - 텍스트를 음성으로 변환
   * @param {string} text - 음성으로 변환할 텍스트
   * @param {string} langCode - 언어 코드 (ko, vi, th, lo)
   * @returns {Promise<Blob>} MP3 오디오 Blob
   */
  async textToSpeech(text, langCode) {
    const AZURE_TTS_KEY = import.meta.env.VITE_AZURE_TTS_KEY;
    const AZURE_TTS_REGION = import.meta.env.VITE_AZURE_TTS_REGION;

    if (!AZURE_TTS_KEY || !AZURE_TTS_REGION) {
      throw new Error('Azure TTS API 키 또는 지역이 설정되지 않았습니다.');
    }

    if (!text || !text.trim()) {
      throw new Error('변환할 텍스트를 입력해주세요.');
    }

    // 언어별 음성 설정 (Azure Neural Voice)
    const voiceSettings = {
      ko: { voice: 'ko-KR-SunHiNeural', lang: 'ko-KR' },
      vi: { voice: 'vi-VN-HoaiMyNeural', lang: 'vi-VN' },
      th: { voice: 'th-TH-PremwadeeNeural', lang: 'th-TH' },
      lo: { voice: 'lo-LA-ChanthavongNeural', lang: 'lo-LA' } // 라오어 (테스트)
    };

    const { voice, lang } = voiceSettings[langCode] || voiceSettings.ko;

    const TTS_API_URL = `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

    // XML 이스케이프 처리
    const escapeXml = (str) => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    // SSML 생성 (XML 선언 포함)
    const escapedText = escapeXml(text);
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${lang}'><voice name='${voice}'>${escapedText}</voice></speak>`;

    console.log('🎤 Azure TTS 요청:', { voice, lang, textLength: text.length });

    try {
      const response = await fetch(TTS_API_URL, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_TTS_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        },
        body: ssml
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('Azure TTS API 오류:', errorText);
        throw new Error(`TTS API 오류 (${response.status}): ${errorText || response.statusText}`);
      }

      const audioBlob = await response.blob();
      console.log('✅ Azure TTS 성공, Blob 크기:', audioBlob.size);

      // Blob 크기 검증
      if (audioBlob.size === 0) {
        console.error('❌ Azure TTS가 빈 오디오를 반환했습니다.');
        console.error('요청 SSML:', ssml);
        throw new Error('음성 데이터가 생성되지 않았습니다. 텍스트를 확인하세요.');
      }

      return audioBlob;

    } catch (error) {
      if (error.message.includes('Failed to fetch')) {
        throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인하세요.');
      }
      throw error;
    }
  }
};
