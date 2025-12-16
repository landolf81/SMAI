import React, { useState, useRef, useEffect } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import toast from 'react-hot-toast';

const LANGUAGES = {
  ko: '한국어',
  vi: '베트남어',
  th: '태국어',
  lo: '라오어'
};

const TranslationHistoryModal = ({ history, onClose, onDelete }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showEnlargedView, setShowEnlargedView] = useState(false);
  const audioRef = useRef(null);
  const audioLoopTimeoutRef = useRef(null);
  const isEnlargedViewOpenRef = useRef(false);

  // 확대 보기 모달 열기 - 음성 자동 재생 시작
  const openEnlargedView = () => {
    setShowEnlargedView(true);
    isEnlargedViewOpenRef.current = true;

    // 1초 후 음성 반복 재생 시작
    if (history.audio_url) {
      setTimeout(() => {
        startAudioLoop();
      }, 1000);
    }
  };

  // 확대 보기 모달 닫기 - 음성 재생 중지
  const closeEnlargedView = () => {
    setShowEnlargedView(false);
    isEnlargedViewOpenRef.current = false;
    stopAudioLoop();
  };

  // 음성 반복 재생 시작 (1초 간격)
  const startAudioLoop = async () => {
    if (!history.audio_url) return;

    const playOnce = () => {
      // ref로 모달 상태 확인
      if (!isEnlargedViewOpenRef.current) return;

      try {
        // 현재 재생 중인 오디오가 있으면 중지
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const audio = new Audio(history.audio_url);
        audio.playbackRate = 0.85; // 재생 속도를 85%로 느리게 설정
        audioRef.current = audio;
        setIsPlaying(true);

        audio.onended = () => {
          setIsPlaying(false);
          // 모달이 열려있으면 1초 후 다시 재생
          if (isEnlargedViewOpenRef.current) {
            audioLoopTimeoutRef.current = setTimeout(playOnce, 1000);
          }
        };

        audio.onerror = () => {
          setIsPlaying(false);
          console.error('음성 재생 오류');
        };

        audio.play().catch(error => {
          console.error('음성 재생 오류:', error);
          setIsPlaying(false);
        });
      } catch (error) {
        console.error('음성 재생 오류:', error);
        setIsPlaying(false);
      }
    };

    playOnce();
  };

  // 음성 반복 재생 중지
  const stopAudioLoop = () => {
    if (audioLoopTimeoutRef.current) {
      clearTimeout(audioLoopTimeoutRef.current);
      audioLoopTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  // 컴포넌트 언마운트 시 오디오 정리
  useEffect(() => {
    return () => {
      stopAudioLoop();
    };
  }, []);

  const playAudio = async () => {
    if (!history.audio_url) {
      toast.error('저장된 음성이 없습니다.');
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }

    try {
      setIsPlaying(true);
      const audio = new Audio(history.audio_url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsPlaying(false);
        audioRef.current = null;
        toast.error('음성 재생 중 오류가 발생했습니다.');
      };

      await audio.play();
    } catch (error) {
      console.error('오디오 재생 오류:', error);
      setIsPlaying(false);
      audioRef.current = null;
      toast.error('음성 재생 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 번역 기록을 삭제하시겠습니까?')) return;

    try {
      await onDelete(history.id);
      toast.success('번역 기록이 삭제되었습니다.');
      onClose();
    } catch (error) {
      console.error('삭제 오류:', error);
      toast.error('삭제 중 오류가 발생했습니다.');
    }
  };

  // 복사하기
  const handleCopy = () => {
    if (!history.target_translation) return;

    navigator.clipboard.writeText(history.target_translation)
      .then(() => {
        toast.success('번역 결과가 복사되었습니다.');
      })
      .catch(() => {
        toast.error('복사에 실패했습니다.');
      });
  };

  // 공유하기
  const handleShare = async () => {
    if (!history.target_translation) return;

    const shareData = {
      title: 'AI 번역 결과',
      text: `${LANGUAGES[history.input_lang]} → ${LANGUAGES[history.target_lang]}\n\n${history.target_translation}`
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
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">번역 기록</h2>
            <p className="text-xs text-gray-500 mt-1">{formatDate(history.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="삭제"
            >
              <DeleteIcon fontSize="small" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* 내용 */}
        <div className="p-4 space-y-4">
          {/* 언어 정보 */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">{LANGUAGES[history.input_lang]}</span>
            <span>→</span>
            <span className="font-medium">{LANGUAGES[history.target_lang]}</span>
          </div>

          {/* 입력 텍스트 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              입력 ({LANGUAGES[history.input_lang]})
            </label>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-800 whitespace-pre-wrap">{history.input_text}</p>
            </div>
          </div>

          {/* 번역 결과 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                번역 결과 ({LANGUAGES[history.target_lang]})
              </label>
              {history.audio_url && (
                <button
                  onClick={playAudio}
                  disabled={isPlaying}
                  className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    isPlaying
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  <VolumeUpIcon fontSize="small" />
                  {isPlaying ? '재생 중...' : '음성 듣기'}
                </button>
              )}
            </div>
            <div
              onClick={openEnlargedView}
              className="p-3 bg-indigo-50 rounded-lg border border-indigo-200 cursor-pointer hover:border-indigo-400 hover:shadow-md transition-all active:scale-[0.99]"
            >
              <p className="text-gray-800 whitespace-pre-wrap">{history.target_translation}</p>
              <p className="text-xs text-indigo-500 mt-2 text-center">👆 터치하여 크게 보기</p>
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

          {/* 역번역 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              역번역 ({LANGUAGES[history.input_lang]})
            </label>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-700 whitespace-pre-wrap">{history.back_translation}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 확대 보기 모달 */}
      {showEnlargedView && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={closeEnlargedView}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 닫기 안내 */}
            <div className="text-center mb-4">
              <p className="text-sm text-gray-400">화면을 터치하면 닫힙니다</p>
            </div>

            {/* 번역 결과 - 큰 폰트 */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg font-bold text-slate-700">{LANGUAGES[history.target_lang]}</span>
              </div>
              <div className="p-6 bg-gradient-to-br from-blue-50 to-emerald-50 rounded-2xl border-2 border-blue-200">
                <p className="text-slate-800 whitespace-pre-wrap text-2xl md:text-3xl leading-relaxed font-medium">
                  {history.target_translation}
                </p>
              </div>
            </div>

            {/* 역번역 결과 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-slate-600">역번역 (품질 검증) - {LANGUAGES[history.input_lang]}</span>
              </div>
              <div className="p-4 bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-2 border-slate-200">
                <p className="text-slate-700 whitespace-pre-wrap text-lg leading-relaxed">
                  {history.back_translation}
                </p>
              </div>
            </div>

            {/* 음성 재생 상태 표시 */}
            {history.audio_url && (
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm">
                  <VolumeUpIcon fontSize="small" className="animate-pulse" />
                  <span>음성 반복 재생 중...</span>
                </div>
              </div>
            )}

            {/* 닫기 버튼 */}
            <button
              onClick={closeEnlargedView}
              className="mt-6 w-full py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-bold hover:from-gray-700 hover:to-gray-800 transition-all shadow-md flex items-center justify-center gap-2"
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

export default TranslationHistoryModal;
