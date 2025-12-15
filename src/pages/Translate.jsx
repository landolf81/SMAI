import React, { useState, useEffect, useRef, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import TranslateIcon from '@mui/icons-material/Translate';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MicIcon from '@mui/icons-material/Mic';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import HistoryIcon from '@mui/icons-material/History';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import toast from 'react-hot-toast';
import { geminiService, translationService, adService, r2Service } from '../services';
import { supabase } from '../config/supabase';
import { AuthContext } from '../context/AuthContext';
import MobileAdDisplay from '../components/MobileAdDisplay';
import TranslationHistoryModal from '../components/TranslationHistoryModal';
import { isMobileDevice } from '../utils/deviceDetector';

const LANGUAGES = [
  { code: 'ko', name: '한국어', speechLang: 'ko-KR', flag: '🇰🇷' },
  { code: 'vi', name: '베트남어', speechLang: 'vi-VN', flag: '🇻🇳' },
  { code: 'th', name: '태국어', speechLang: 'th-TH', flag: '🇹🇭' },
  { code: 'lo', name: '라오어', speechLang: 'lo-LA', flag: '🇱🇦' }
];

const Translate = () => {
  const { currentUser } = useContext(AuthContext);
  const [isMobile] = useState(() => isMobileDevice());

  // 사용자별 언어 설정 불러오기
  const getUserLangKey = (type) => currentUser ? `translate_${type}_${currentUser.id}` : `translate_${type}_guest`;

  const [inputLang, setInputLang] = useState(() => {
    const saved = localStorage.getItem(getUserLangKey('input'));
    return saved || 'ko';
  });

  const [targetLang, setTargetLang] = useState(() => {
    const saved = localStorage.getItem(getUserLangKey('target'));
    return saved || 'vi';
  });
  const [inputText, setInputText] = useState('');
  const [translations, setTranslations] = useState({ target: '', backTranslation: '' });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [history, setHistory] = useState([]);
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyCount, setHistoryCount] = useState(0);
  const recognitionRef = useRef(null);
  const audioCache = useRef(null); // TTS 오디오 캐시
  const currentAudio = useRef(null); // 현재 재생 중인 오디오
  const historySaved = useRef(false); // 히스토리 저장 여부

  // 광고 조회
  const { data: adsData } = useQuery({
    queryKey: ['active-ads'],
    queryFn: adService.getActiveAds,
    staleTime: 5 * 60 * 1000 // 5분
  });

  // 광고 데이터 디버깅
  useEffect(() => {
    console.log('광고 데이터:', adsData);
  }, [adsData]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      const selectedLang = LANGUAGES.find(l => l.code === inputLang);
      recognition.lang = selectedLang.speechLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInputText(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };
      recognition.onerror = (event) => {
        console.error('음성 인식 오류:', event.error);
        setIsListening(false);
        if (event.error === 'not-allowed') {
          toast.error('마이크 권한이 거부되었습니다.');
        } else if (event.error === 'no-speech') {
          toast.error('음성이 감지되지 않았습니다.');
        } else {
          toast.error('음성 인식 중 오류가 발생했습니다.');
        }
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [inputLang]);

  // 언어 설정 저장
  useEffect(() => {
    const key = currentUser ? `translate_input_${currentUser.id}` : 'translate_input_guest';
    localStorage.setItem(key, inputLang);
  }, [inputLang, currentUser]);

  useEffect(() => {
    const key = currentUser ? `translate_target_${currentUser.id}` : 'translate_target_guest';
    localStorage.setItem(key, targetLang);
  }, [targetLang, currentUser]);

  // 히스토리 로드
  useEffect(() => {
    if (currentUser) {
      loadHistory();
      loadHistoryCount();
    }
  }, [currentUser]);

  const loadHistory = async () => {
    if (!currentUser) return;
    try {
      const data = await translationService.getHistory(100, currentUser.id);
      setHistory(data);
    } catch (error) {
      console.error('히스토리 로드 오류:', error);
    }
  };

  const loadHistoryCount = async () => {
    if (!currentUser) return;
    try {
      const count = await translationService.getHistoryCount(currentUser.id);
      setHistoryCount(count);
    } catch (error) {
      console.error('히스토리 개수 로드 오류:', error);
    }
  };

  const toggleVoiceInput = () => {
    if (!speechSupported) {
      toast.error('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // 언어 교환
  const swapLanguages = () => {
    const temp = inputLang;
    setInputLang(targetLang);
    setTargetLang(temp);
  };

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      toast.error('번역할 텍스트를 입력하세요.');
      return;
    }
    if (inputLang === targetLang) {
      toast.error('입력 언어와 번역 언어가 동일합니다.');
      return;
    }
    if (inputText.length > 5000) {
      toast.error('텍스트는 5000자 이하로 입력해주세요.');
      return;
    }
    setIsTranslating(true);
    setTranslations({ target: '', backTranslation: '' });

    // 새로운 번역 시작 시 오디오 캐시 및 히스토리 저장 플래그 초기화
    audioCache.current = null;
    historySaved.current = false;
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }

    try {
      // 1단계: 번역
      const result = await geminiService.translate(inputText, inputLang, targetLang);
      setTranslations({ target: result.targetTranslation, backTranslation: result.backTranslation });
      toast.success('번역이 완료되었습니다.');

      // 2단계: TTS 생성 (백그라운드, 약간의 딜레이 추가)
      setTimeout(async () => {
        try {
          toast.loading('음성을 생성하는 중...');
          const audioBlob = await geminiService.textToSpeech(result.targetTranslation, targetLang);

          // 오디오 캐시에 저장
          audioCache.current = {
            text: result.targetTranslation,
            blob: audioBlob
          };

          toast.dismiss();
          toast.success('음성 생성이 완료되었습니다.');
        } catch (ttsError) {
          console.error('TTS 생성 오류:', ttsError);
          toast.dismiss();
          toast.error('음성 생성에 실패했습니다. 텍스트 번역만 표시됩니다.');
          // TTS 실패해도 번역 결과는 표시
        }
      }, 500); // 500ms 딜레이

    } catch (error) {
      console.error('번역 오류:', error);
      toast.error(error.message || '번역 중 오류가 발생했습니다.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTTS = async () => {
    if (!translations.target) return;

    // 이미 재생 중이면 중지
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);

    try {
      let audioBlob;

      // 캐시에 오디오가 있으면 재사용, 없으면 생성
      if (audioCache.current?.blob) {
        audioBlob = audioCache.current.blob;
      } else {
        // TTS 생성
        toast.loading('음성을 생성하는 중...');
        audioBlob = await geminiService.textToSpeech(translations.target, targetLang);

        // 오디오 캐시에 저장
        audioCache.current = {
          text: translations.target,
          blob: audioBlob
        };
        toast.dismiss();
      }

      // 로그인한 경우: 히스토리 저장 (아직 저장되지 않은 경우만)
      if (currentUser && !historySaved.current) {
        try {
          // 히스토리 저장 (오디오 포함)
          await translationService.saveHistory({
            inputText,
            inputLang,
            targetLang,
            targetTranslation: translations.target,
            backTranslation: translations.backTranslation
          }, audioBlob, currentUser.id);

          // 히스토리 갱신
          await loadHistory();
          await loadHistoryCount();

          // 저장 완료 플래그 설정
          historySaved.current = true;

        } catch (error) {
          console.error('히스토리 저장 오류:', error);
          toast.error('히스토리 저장에 실패했습니다.');
          // 저장 실패해도 재생은 계속
        }
      }

      // 오디오 재생
      playAudio(audioBlob);

    } catch (error) {
      console.error('음성 생성/재생 오류:', error);
      setIsSpeaking(false);
      toast.dismiss();
      toast.error(error.message || '음성 생성 중 오류가 발생했습니다.');
    }
  };

  const playAudio = (audioBlob) => {
    // 현재 재생 중인 오디오가 있으면 중지
    if (currentAudio.current) {
      currentAudio.current.pause();
      URL.revokeObjectURL(currentAudio.current.src);
    }

    // Blob URL 생성 및 재생
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    currentAudio.current = audio;

    audio.onended = () => {
      setIsSpeaking(false);
      URL.revokeObjectURL(audioUrl);
      currentAudio.current = null;
    };

    audio.onerror = () => {
      setIsSpeaking(false);
      URL.revokeObjectURL(audioUrl);
      currentAudio.current = null;
      toast.error('음성 재생 중 오류가 발생했습니다.');
    };

    setIsSpeaking(true);
    audio.play().catch(error => {
      console.error('오디오 재생 오류:', error);
      setIsSpeaking(false);
      URL.revokeObjectURL(audioUrl);
      currentAudio.current = null;
      toast.error('음성 재생 중 오류가 발생했습니다.');
    });
  };

  const handleDeleteHistory = async (historyId) => {
    if (!currentUser) return;
    try {
      await translationService.deleteHistory(historyId, currentUser.id);
      await loadHistory();
      await loadHistoryCount();
    } catch (error) {
      throw error;
    }
  };

  // 복사하기
  const handleCopy = () => {
    if (!translations.target) return;

    navigator.clipboard.writeText(translations.target)
      .then(() => {
        toast.success('번역 결과가 복사되었습니다.');
      })
      .catch(() => {
        toast.error('복사에 실패했습니다.');
      });
  };

  // 공유하기
  const handleShare = async () => {
    if (!translations.target) return;

    const shareData = {
      title: 'AI 번역 결과',
      text: `${LANGUAGES.find(l => l.code === inputLang)?.name} → ${LANGUAGES.find(l => l.code === targetLang)?.name}\n\n${translations.target}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('공유 오류:', error);
          toast.error('공유에 실패했습니다.');
        }
      }
    } else {
      // 공유 API 미지원 시 복사
      handleCopy();
      toast.success('번역 결과가 복사되었습니다. (공유 기능 미지원)');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;

    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-emerald-50 pt-16 px-4 pb-4">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl shadow-lg px-4 py-3 mb-4 text-white">
          <div className="flex items-center gap-2">
            <TranslateIcon fontSize="small" />
            <h1 className="text-lg font-bold">AI 번역기</h1>
          </div>
        </div>

        {/* 언어 선택 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-2">입력 언어</label>
              <select
                value={inputLang}
                onChange={(e) => setInputLang(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>

            <button
              onClick={swapLanguages}
              className="mt-6 p-3 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-xl hover:from-emerald-600 hover:to-blue-600 transition-all shadow-md hover:shadow-lg"
              title="언어 교환"
            >
              <SwapHorizIcon />
            </button>

            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-2">번역 언어</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
          <label className="block text-sm font-bold text-slate-700 mb-3">
            {LANGUAGES.find(l => l.code === inputLang)?.flag} {LANGUAGES.find(l => l.code === inputLang)?.name}
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-36 p-4 bg-white border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none text-lg"
            placeholder="번역할 텍스트를 입력하세요..."
          />
          <div className="flex gap-3 mt-4 relative z-10">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={!inputText.trim() || isTranslating}
              className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-blue-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg text-lg"
            >
              {isTranslating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loading loading-spinner" style={{ width: '0.5em', height: '0.5em' }}></span>
                  번역 중...
                </span>
              ) : (
                '번역하기'
              )}
            </button>
            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`px-6 py-4 rounded-xl font-bold transition-all shadow-md ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse hover:bg-red-600'
                    : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                }`}
                title="음성으로 입력"
              >
                <MicIcon />
              </button>
            )}
          </div>
        </div>

        {/* 번역 결과 */}
        {translations.target && (
          <>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-slate-700">
                  {LANGUAGES.find(l => l.code === targetLang)?.flag} {LANGUAGES.find(l => l.code === targetLang)?.name}
                </label>
                <div className="flex gap-2">
                  {/* 개발용 TTS 테스트 버튼 */}
                  <button
                    onClick={async () => {
                      try {
                        toast.loading('TTS 테스트 중...');
                        const audioBlob = await geminiService.textToSpeech(translations.target, targetLang);
                        console.log('✅ TTS 테스트 성공, Blob 크기:', audioBlob.size);
                        toast.dismiss();
                        toast.success('TTS 테스트 성공!');
                      } catch (error) {
                        console.error('❌ TTS 테스트 실패:', error);
                        toast.dismiss();
                        toast.error('TTS 테스트 실패: ' + error.message);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl font-medium transition-all shadow-md bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 text-xs"
                  >
                    🧪 TTS 테스트
                  </button>
                  <button
                    onClick={handleTTS}
                    disabled={isSpeaking}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all shadow-md ${
                      isSpeaking
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                    }`}
                  >
                    <VolumeUpIcon fontSize="small" />
                    {isSpeaking ? '재생 중...' : '음성 듣기'}
                  </button>
                </div>
              </div>
              <div className="p-5 bg-gradient-to-br from-blue-50 to-emerald-50 rounded-xl border-2 border-blue-200">
                <p className="text-slate-800 whitespace-pre-wrap text-lg leading-relaxed">{translations.target}</p>
              </div>

              {/* 복사하기 & 공유하기 버튼 */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-100 to-slate-200 hover:from-slate-200 hover:to-slate-300 text-slate-700 rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
                >
                  <ContentCopyIcon fontSize="small" />
                  복사하기
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-100 to-emerald-100 hover:from-blue-200 hover:to-emerald-200 text-slate-700 rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
                >
                  <ShareIcon fontSize="small" />
                  공유하기
                </button>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
              <label className="block text-sm font-bold text-slate-700 mb-3">
                {LANGUAGES.find(l => l.code === inputLang)?.flag} 역번역 (품질 검증)
              </label>
              <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-2 border-slate-200">
                <p className="text-slate-700 whitespace-pre-wrap text-lg leading-relaxed">{translations.backTranslation}</p>
              </div>
              <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                <span className="text-lg">💡</span>
                원문과 역번역을 비교하여 번역 정확도를 확인하세요.
              </p>
            </div>
          </>
        )}

        {/* 광고 */}
        {adsData && adsData.length > 0 && (
          <div className="mb-4">
            <MobileAdDisplay ad={adsData[0]} />
          </div>
        )}

        {/* 번역 히스토리 */}
        {currentUser && history.length > 0 && (
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-2 rounded-lg">
                <HistoryIcon className="text-white" fontSize="small" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">번역 기록</h2>
              <span className="text-sm text-slate-500 font-medium">({historyCount}/100)</span>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedHistory(item)}
                  className="p-4 bg-gradient-to-br from-white to-slate-50 hover:from-blue-50 hover:to-emerald-50 rounded-xl cursor-pointer transition-all border-2 border-slate-200 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <span className="text-lg">{LANGUAGES.find(l => l.code === item.input_lang)?.flag}</span>
                      <span className="text-emerald-600">→</span>
                      <span className="text-lg">{LANGUAGES.find(l => l.code === item.target_lang)?.flag}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm text-slate-800 line-clamp-2 font-medium leading-relaxed">{item.input_text}</p>
                  <p className="text-xs text-slate-500 mt-2 line-clamp-1 leading-relaxed">{item.target_translation}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 히스토리 모달 */}
      {selectedHistory && (
        <TranslationHistoryModal
          history={selectedHistory}
          onClose={() => setSelectedHistory(null)}
          onDelete={handleDeleteHistory}
        />
      )}
    </div>
  );
};

export default Translate;
