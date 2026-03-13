import React, { useState, useEffect, useRef, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import TranslateIcon from '@mui/icons-material/Translate';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import HistoryIcon from '@mui/icons-material/History';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import CloseIcon from '@mui/icons-material/Close';
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

const Translate = ({ embedded = false }) => {
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
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [voiceInputText, setVoiceInputText] = useState(''); // 음성 입력 중 임시 텍스트
  const [showTranslationModal, setShowTranslationModal] = useState(false); // 번역 결과 모달
  const recognitionRef = useRef(null);
  const audioCache = useRef(null); // TTS 오디오 캐시
  const currentAudio = useRef(null); // 현재 재생 중인 오디오
  const historySaved = useRef(false); // 히스토리 저장 여부
  const modalAudioIntervalRef = useRef(null); // 모달 음성 반복 재생 인터벌
  const isModalOpenRef = useRef(false); // 모달 열림 상태 ref

  // 광고 조회
  const { data: adsData } = useQuery({
    queryKey: ['active-ads'],
    queryFn: adService.getActiveAds,
    staleTime: 5 * 60 * 1000 // 5분
  });

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
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        // 중간 결과를 모달에 표시
        if (interimTranscript) {
          setVoiceInputText(interimTranscript);
        }
        // 최종 결과를 입력창에 추가
        if (finalTranscript) {
          setInputText(prev => prev + (prev ? ' ' : '') + finalTranscript);
          setVoiceInputText(''); // 임시 텍스트 초기화
        }
      };
      recognition.onerror = (event) => {
        console.error('음성 인식 오류:', event.error);
        setIsListening(false);
        setShowVoiceModal(false);
        setVoiceInputText('');
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
        setShowVoiceModal(false);
        setVoiceInputText('');
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

  const startVoiceInput = () => {
    if (!speechSupported) {
      toast.error('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }
    setShowVoiceModal(true);
    setVoiceInputText('');
    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopVoiceInput = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setShowVoiceModal(false);
    setVoiceInputText('');
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

  // 번역 결과 모달 열기
  const openTranslationModal = async () => {
    isModalOpenRef.current = true;
    setShowTranslationModal(true);

    // 히스토리 저장 (로그인한 경우 & 아직 저장되지 않은 경우)
    if (currentUser && !historySaved.current && translations.target) {
      try {
        // TTS 오디오 생성 (캐시 확인)
        let audioBlob;
        if (audioCache.current?.blob && audioCache.current?.text === translations.target) {
          audioBlob = audioCache.current.blob;
        } else {
          audioBlob = await geminiService.textToSpeech(translations.target, targetLang);
          audioCache.current = { text: translations.target, blob: audioBlob };
        }

        // 히스토리 저장
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
        // 저장 실패해도 모달은 열림
      }
    }

    // 1초 후 음성 재생 시작 (반복)
    setTimeout(() => {
      startModalAudioLoop();
    }, 1000);
  };

  // 번역 결과 모달 닫기
  const closeTranslationModal = () => {
    isModalOpenRef.current = false;
    setShowTranslationModal(false);
    stopModalAudioLoop();
  };

  // 모달 음성 반복 재생 시작
  const startModalAudioLoop = async () => {
    if (!translations.target) return;

    const playOnce = async () => {
      // ref로 모달 상태 확인
      if (!isModalOpenRef.current) return;

      try {
        let audioBlob;

        // 캐시에 오디오가 있으면 재사용
        if (audioCache.current?.blob) {
          audioBlob = audioCache.current.blob;
        } else {
          audioBlob = await geminiService.textToSpeech(translations.target, targetLang);
          audioCache.current = { text: translations.target, blob: audioBlob };
        }

        // 현재 재생 중인 오디오가 있으면 중지
        if (currentAudio.current) {
          currentAudio.current.pause();
          URL.revokeObjectURL(currentAudio.current.src);
        }

        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        currentAudio.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          // 모달이 열려있으면 1초 후 다시 재생 (ref로 확인)
          if (isModalOpenRef.current) {
            modalAudioIntervalRef.current = setTimeout(() => {
              playOnce();
            }, 1000);
          }
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
        };

        audio.play().catch(err => {
          console.error('모달 오디오 재생 오류:', err);
        });
      } catch (error) {
        console.error('모달 TTS 오류:', error);
      }
    };

    playOnce();
  };

  // 모달 음성 반복 재생 중지
  const stopModalAudioLoop = () => {
    if (modalAudioIntervalRef.current) {
      clearTimeout(modalAudioIntervalRef.current);
      modalAudioIntervalRef.current = null;
    }
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }
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
    <div className={embedded ? 'bg-base-200 px-4 pb-4' : 'min-h-screen bg-base-200 pt-16 px-4 pb-4'}>
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-emerald-600 to-blue-600 rounded-xl shadow-lg px-4 py-3 mb-4 text-white">
          <div className="flex items-center gap-2">
            <TranslateIcon fontSize="small" />
            <h1 className="text-lg font-bold">AI 번역기</h1>
          </div>
        </div>

        {/* 언어 선택 */}
        <div className="bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-base-content/70 mb-2">입력 언어</label>
              <select
                value={inputLang}
                onChange={(e) => setInputLang(e.target.value)}
                className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium"
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
              <label className="block text-xs font-medium text-base-content/70 mb-2">번역 언어</label>
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="w-full px-4 py-3 bg-base-100 border-2 border-base-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.flag} {lang.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 입력 영역 */}
        <div className="bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
          <label className="block text-sm font-bold text-base-content mb-3">
            {LANGUAGES.find(l => l.code === inputLang)?.flag} {LANGUAGES.find(l => l.code === inputLang)?.name}
          </label>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full h-36 p-4 bg-base-100 border-2 border-base-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none text-lg"
            placeholder="번역할 텍스트를 입력하세요..."
          />
          <div className="flex gap-3 mt-4 relative z-10">
            <button
              type="button"
              onClick={handleTranslate}
              disabled={!inputText.trim() || isTranslating}
              className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-blue-600 text-white rounded-xl font-bold hover:from-emerald-700 hover:to-blue-700 disabled:from-base-content/30 disabled:to-base-content/40 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg text-lg"
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
                onClick={startVoiceInput}
                className="px-6 py-4 rounded-xl font-bold transition-all shadow-md bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600"
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
            <div className="bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-bold text-base-content">
                  {LANGUAGES.find(l => l.code === targetLang)?.flag} {LANGUAGES.find(l => l.code === targetLang)?.name}
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handleTTS}
                    disabled={isSpeaking}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all shadow-md ${
                      isSpeaking
                        ? 'bg-base-300 text-base-content/50 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                    }`}
                  >
                    <VolumeUpIcon fontSize="small" />
                    {isSpeaking ? '재생 중...' : '음성 듣기'}
                  </button>
                </div>
              </div>
              <div
                onClick={openTranslationModal}
                className="p-5 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 rounded-xl border-2 border-blue-500/30 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all active:scale-[0.99]"
              >
                <p className="text-base-content whitespace-pre-wrap text-lg leading-relaxed">{translations.target}</p>
                <p className="text-xs text-blue-500 mt-2 text-center">👆 터치하여 크게 보기</p>
              </div>

              {/* 복사하기 & 공유하기 버튼 */}
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-base-200 to-base-300 hover:from-base-300 hover:to-base-300 text-base-content rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
                >
                  <ContentCopyIcon fontSize="small" />
                  복사하기
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500/15 to-emerald-500/15 hover:from-blue-500/20 hover:to-emerald-500/20 text-base-content rounded-xl font-medium transition-all shadow-sm hover:shadow-md"
                >
                  <ShareIcon fontSize="small" />
                  공유하기
                </button>
              </div>
            </div>

            <div className="bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mb-5">
              <label className="block text-sm font-bold text-base-content mb-3">
                {LANGUAGES.find(l => l.code === inputLang)?.flag} 역번역 (품질 검증)
              </label>
              <div className="p-5 bg-gradient-to-br from-base-200 to-blue-500/10 rounded-xl border-2 border-base-300">
                <p className="text-base-content whitespace-pre-wrap text-lg leading-relaxed">{translations.backTranslation}</p>
              </div>
              <p className="text-xs text-base-content/50 mt-3 flex items-center gap-1">
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
          <div className="bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-lg p-5 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-2 rounded-lg">
                <HistoryIcon className="text-white" fontSize="small" />
              </div>
              <h2 className="text-lg font-bold text-base-content">번역 기록</h2>
              <span className="text-sm text-base-content/50 font-medium">({historyCount}/100)</span>
            </div>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-base-300 scrollbar-track-base-200">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedHistory(item)}
                  className="p-4 bg-gradient-to-br from-base-100 to-base-200 hover:from-blue-500/10 hover:to-emerald-500/10 rounded-xl cursor-pointer transition-all border-2 border-base-300 hover:border-blue-400 hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-medium text-base-content">
                      <span className="text-lg">{LANGUAGES.find(l => l.code === item.input_lang)?.flag}</span>
                      <span className="text-emerald-600">→</span>
                      <span className="text-lg">{LANGUAGES.find(l => l.code === item.target_lang)?.flag}</span>
                    </div>
                    <span className="text-xs text-base-content/40 font-medium">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="text-sm text-base-content line-clamp-2 font-medium leading-relaxed">{item.input_text}</p>
                  <p className="text-xs text-base-content/50 mt-2 line-clamp-1 leading-relaxed">{item.target_translation}</p>
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

      {/* 음성 입력 모달 */}
      {showVoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-base-100 rounded-3xl shadow-2xl w-full max-w-sm p-6 relative animate-in fade-in zoom-in duration-200">
            {/* 닫기 버튼 */}
            <button
              onClick={stopVoiceInput}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-base-200 transition-colors"
            >
              <CloseIcon className="text-base-content/50" />
            </button>

            {/* 헤더 */}
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-base-content">음성 입력</h3>
              <p className="text-sm text-base-content/50 mt-1">
                {LANGUAGES.find(l => l.code === inputLang)?.flag} {LANGUAGES.find(l => l.code === inputLang)?.name}로 말씀하세요
              </p>
            </div>

            {/* 마이크 애니메이션 */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                {/* 파동 효과 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 bg-red-500/20 rounded-full animate-ping"></div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 bg-red-500/30 rounded-full animate-pulse"></div>
                </div>
                {/* 마이크 아이콘 */}
                <div className="relative w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                  <MicIcon className="text-white" style={{ fontSize: '2.5rem' }} />
                </div>
              </div>
            </div>

            {/* 음성 인식 상태 */}
            <div className="text-center mb-6">
              <p className="text-sm font-medium text-red-500 animate-pulse">
                🎤 듣고 있습니다...
              </p>
              {/* 인식 중인 텍스트 표시 */}
              {voiceInputText && (
                <div className="mt-3 p-3 bg-base-200 rounded-xl">
                  <p className="text-base-content/70 text-sm">{voiceInputText}</p>
                </div>
              )}
            </div>

            {/* 입력된 텍스트 미리보기 */}
            {inputText && (
              <div className="mb-6 p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/30">
                <p className="text-xs text-emerald-600 font-medium mb-1">입력된 텍스트</p>
                <p className="text-base-content/70 text-sm line-clamp-3">{inputText}</p>
              </div>
            )}

            {/* 중지 버튼 */}
            <button
              onClick={stopVoiceInput}
              className="w-full py-4 bg-gradient-to-r from-base-content/60 to-base-content/70 text-white rounded-xl font-bold hover:from-base-content/70 hover:to-base-content/80 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <MicOffIcon />
              음성 입력 중지
            </button>
          </div>
        </div>
      )}

      {/* 번역 결과 모달 */}
      {showTranslationModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeTranslationModal}
        >
          <div
            className="bg-base-100 rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 안내 */}
            <div className="text-center mb-4">
              <p className="text-sm text-base-content/40">화면을 터치하면 닫힙니다</p>
            </div>

            {/* 번역 결과 - 큰 폰트 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{LANGUAGES.find(l => l.code === targetLang)?.flag}</span>
                <span className="text-lg font-bold text-base-content">{LANGUAGES.find(l => l.code === targetLang)?.name}</span>
              </div>
              <div className="p-6 bg-gradient-to-br from-blue-500/10 to-emerald-500/10 rounded-2xl border-2 border-blue-500/30">
                <p className="text-base-content whitespace-pre-wrap text-2xl md:text-3xl leading-relaxed font-medium">
                  {translations.target}
                </p>
              </div>
            </div>

            {/* 역번역 결과 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{LANGUAGES.find(l => l.code === inputLang)?.flag}</span>
                <span className="text-sm font-bold text-base-content/70">역번역 (품질 검증)</span>
              </div>
              <div className="p-4 bg-gradient-to-br from-base-200 to-blue-500/10 rounded-xl border-2 border-base-300">
                <p className="text-base-content whitespace-pre-wrap text-lg leading-relaxed">
                  {translations.backTranslation}
                </p>
              </div>
            </div>

            {/* 음성 재생 상태 표시 */}
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/15 text-green-600 dark:text-green-400 rounded-full text-sm">
                <VolumeUpIcon fontSize="small" className="animate-pulse" />
                <span>음성 반복 재생 중...</span>
              </div>
            </div>

            {/* 닫기 버튼 */}
            <button
              onClick={closeTranslationModal}
              className="mt-6 w-full py-4 bg-gradient-to-r from-base-content/60 to-base-content/70 text-white rounded-xl font-bold hover:from-base-content/70 hover:to-base-content/80 transition-all shadow-md flex items-center justify-center gap-2"
            >
              <CloseIcon />
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Translate;
