/**
 * LoungeComposeModal.jsx
 * 역할: 광장 글쓰기 모달 (Lounge.jsx에서 추출)
 * 기능:
 *   - 텍스트 입력 (최대 300자)
 *   - 음성입력 (SpeechRecognition API, ko-KR)
 *   - 다중 이미지 업로드 (최대 5장) + 개별 삭제/추가
 *   - 투표 생성 (PollCreateForm 탭)
 *   - 쿨다운 표시, 로그인 안내
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SendIcon from '@mui/icons-material/Send';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import PollCreateForm from './PollCreateForm';

const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];

const LoungeComposeModal = ({
  isOpen,
  onClose,
  currentUser,
  onSendMessage,
  onSendPoll,
  isSending,
  cooldownLeft,
  isUploading,
  initialText = '',
}) => {
  const navigate = useNavigate();
  const [text, setText] = useState(initialText);
  const [isPollMode, setIsPollMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);     // File[]
  const [imagePreviews, setImagePreviews] = useState([]);       // dataURL[]
  const [selectedVideo, setSelectedVideo] = useState(null);     // File | null
  const [videoPreview, setVideoPreview] = useState(null);       // objectURL
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ── 음성입력 상태 ──
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // initialText 변경 시 반영 (멘션 등)
  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  // ── SpeechRecognition 초기화 ──
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSpeechSupported(true);

    const recognition = new SR();
    recognition.lang = 'ko-KR';
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
        setText((prev) => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
    };
  }, []);

  // 모달 닫힐 때 음성인식 정리
  useEffect(() => {
    if (!isOpen && isListening) {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      setIsListening(false);
    }
  }, [isOpen, isListening]);

  // ── 음성입력 토글 ──
  const toggleSpeech = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // ── 파일 선택 (이미지 다중 + 동영상 1개) ──
  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      // 동영상 파일 처리
      if (file.type.startsWith('video/')) {
        if (selectedVideo) {
          alert('동영상은 1개만 첨부할 수 있어요.');
          break;
        }
        if (selectedImages.length > 0) {
          alert('이미지와 동영상을 함께 첨부할 수 없어요.');
          break;
        }
        if (!SUPPORTED_VIDEO_TYPES.includes(file.type)) {
          alert('MP4, WebM, MOV 형식의 동영상만 첨부할 수 있어요.');
          continue;
        }
        if (file.size > MAX_VIDEO_SIZE) {
          alert('50MB 이하 동영상만 첨부할 수 있어요.');
          continue;
        }
        setSelectedVideo(file);
        setVideoPreview(URL.createObjectURL(file));
        break; // 동영상 1개만
      }

      // 이미지 파일 처리
      if (file.type.startsWith('image/')) {
        if (selectedVideo) {
          alert('동영상과 이미지를 함께 첨부할 수 없어요.');
          break;
        }
        const remaining = MAX_IMAGES - selectedImages.length;
        if (remaining <= 0) {
          alert(`최대 ${MAX_IMAGES}장까지 첨부할 수 있어요.`);
          break;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          alert('10MB 이하 이미지만 첨부할 수 있어요.');
          continue;
        }
        setSelectedImages((prev) => [...prev, file]);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setImagePreviews((prev) => [...prev, ev.target.result]);
        };
        reader.readAsDataURL(file);
      }
    }

    // input 초기화 (같은 파일 재선택 가능)
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [selectedImages.length, selectedVideo]);

  // ── 이미지 개별 삭제 ──
  const removeImage = useCallback((index) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── 미디어 전체 초기화 ──
  const clearMedia = useCallback(() => {
    setSelectedImages([]);
    setImagePreviews([]);
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setSelectedVideo(null);
    setVideoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [videoPreview]);

  // ── 메시지 전송 ──
  const handleSend = useCallback(async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && selectedImages.length === 0 && !selectedVideo) return;
    if (isSending || cooldownLeft > 0) return;

    await onSendMessage(trimmed || null, selectedImages, selectedVideo);
    setText('');
    clearMedia();
  }, [text, selectedImages, selectedVideo, isSending, cooldownLeft, onSendMessage, clearMedia]);

  // ── 투표 전송 ──
  const handlePollSubmit = useCallback(async (pollData) => {
    await onSendPoll(pollData);
  }, [onSendPoll]);

  // ── Enter 전송 ──
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // ── 닫기 ──
  const handleClose = useCallback(() => {
    if (!text.trim() && selectedImages.length === 0 && !selectedVideo) {
      setText('');
      clearMedia();
      setIsPollMode(false);
      onClose();
    }
  }, [text, selectedImages, selectedVideo, clearMedia, onClose]);

  const handleForceClose = useCallback(() => {
    setText('');
    clearMedia();
    setIsPollMode(false);
    if (isListening) {
      try { recognitionRef.current?.stop(); } catch { /* ignore */ }
      setIsListening(false);
    }
    onClose();
  }, [clearMedia, onClose, isListening]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-20">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* 카드 */}
      <div className="relative w-[calc(100%-32px)] bg-base-100 rounded-2xl shadow-xl border border-base-300 overflow-hidden">
        {/* 헤더: 탭 전환 + 닫기 */}
        <div className="px-4 py-3 border-b border-base-200 flex items-center justify-between">
          <div className="flex bg-base-200 rounded-xl p-1 gap-1">
            <button
              onClick={() => setIsPollMode(false)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                !isPollMode
                  ? 'bg-base-100 text-base-content shadow-sm'
                  : 'text-base-content/50 hover:text-base-content/70'
              }`}
            >
              <SendIcon style={{ fontSize: 14 }} />
              글쓰기
            </button>
            <button
              onClick={() => setIsPollMode(true)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
                isPollMode
                  ? 'bg-base-100 text-base-content shadow-sm'
                  : 'text-base-content/50 hover:text-base-content/70'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M3 3a1 1 0 011-1h1a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3zM7 7a1 1 0 011-1h1a1 1 0 011 1v6a1 1 0 01-1 1H8a1 1 0 01-1-1V7zM12 5a1 1 0 00-1 1v7a1 1 0 001 1h1a1 1 0 001-1V6a1 1 0 00-1-1h-1z" />
              </svg>
              투표
            </button>
          </div>
          <button
            onClick={handleForceClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-base-200 text-base-content/50 text-[16px] hover:bg-base-300 transition-colors"
          >
            ×
          </button>
        </div>

        {!currentUser ? (
          <div className="px-5 py-5">
            <button
              onClick={() => navigate('/login')}
              className="w-full py-3 text-[14px] font-medium text-base-content/60 bg-base-200 border border-base-300 rounded-xl hover:bg-base-200 transition-colors"
            >
              로그인하고 이야기 나누기
            </button>
          </div>
        ) : isPollMode ? (
          <PollCreateForm
            onSubmit={handlePollSubmit}
            onCancel={handleForceClose}
            isSubmitting={isSending}
            cooldownLeft={cooldownLeft}
          />
        ) : (
          <>
            {/* 이미지 미리보기 (다중 — 가로 스크롤) */}
            {imagePreviews.length > 0 && (
              <div className="px-5 pt-4 pb-0">
                <div
                  className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
                  style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative flex-shrink-0">
                      <img
                        src={preview}
                        alt={`미리보기 ${i + 1}`}
                        className="w-20 h-20 rounded-xl object-cover border border-base-300"
                      />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center shadow-md"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {/* 추가 버튼 (5장 미만일 때) */}
                  {selectedImages.length < MAX_IMAGES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-20 h-20 rounded-xl border-2 border-dashed border-base-300 flex items-center justify-center text-base-content/30 hover:border-base-content/40 hover:text-base-content/50 transition-colors flex-shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                      </svg>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-base-content/40 mt-1">
                  {selectedImages.length}/{MAX_IMAGES}장
                </p>
              </div>
            )}

            {/* 동영상 미리보기 */}
            {videoPreview && (
              <div className="px-5 pt-4 pb-0">
                <div className="relative inline-block">
                  <video
                    src={videoPreview}
                    className="w-40 h-28 rounded-xl object-cover border border-base-300"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <button
                    onClick={() => { if (videoPreview) URL.revokeObjectURL(videoPreview); setSelectedVideo(null); setVideoPreview(null); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center shadow-md"
                  >
                    ×
                  </button>
                  {/* 동영상 아이콘 오버레이 */}
                  <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path d="M3.25 4A2.25 2.25 0 001 6.25v7.5A2.25 2.25 0 003.25 16h7.5A2.25 2.25 0 0013 13.75v-7.5A2.25 2.25 0 0010.75 4h-7.5zM19 4.75a.75.75 0 00-1.28-.53l-3 3a.75.75 0 00-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 001.28-.53V4.75z" />
                    </svg>
                    동영상
                  </div>
                </div>
                <p className="text-[11px] text-base-content/40 mt-1">
                  {(selectedVideo.size / 1024 / 1024).toFixed(1)}MB
                </p>
              </div>
            )}

            {/* 입력창 */}
            <div className="px-5 pt-4 pb-3">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="이야기를 남겨보세요... (최대 300자)"
                maxLength={300}
                rows={6}
                autoFocus
                className="w-full px-4 py-3 border-2 border-blue-400 rounded-xl focus:ring-2 focus:ring-blue-400 focus:border-blue-500 text-[15px] resize-none leading-relaxed text-base-content placeholder-base-content/40 bg-base-200 outline-none transition-all duration-200"
                style={{ fontSize: '16px', minHeight: '150px', maxHeight: '200px', overflowY: 'auto' }}
              />
            </div>

            {/* 푸터 */}
            <div className="px-5 py-3 bg-base-200 border-t border-base-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* 사진 첨부 버튼 */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={selectedImages.length >= MAX_IMAGES || !!selectedVideo || isSending}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-base-200 text-base-content/50 hover:bg-base-300 disabled:opacity-40 transition-colors"
                  aria-label="사진 첨부"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* 음성입력 버튼 */}
                {speechSupported && (
                  <button
                    onClick={toggleSpeech}
                    disabled={isSending}
                    className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-base-200 text-base-content/50 hover:bg-base-300'
                    } disabled:opacity-40`}
                    aria-label={isListening ? '음성입력 중지' : '음성입력'}
                  >
                    {isListening ? (
                      <MicOffIcon style={{ fontSize: 20 }} />
                    ) : (
                      <MicIcon style={{ fontSize: 20 }} />
                    )}
                  </button>
                )}

                <span className={`text-[12px] transition-colors ${cooldownLeft > 0 ? 'text-orange-400 font-medium' : text.length > 0 ? 'text-base-content/40' : 'text-transparent'}`}>
                  {cooldownLeft > 0 ? `${cooldownLeft}초 후 전송 가능` : `${text.length}/300`}
                </span>
              </div>
              <button
                onClick={handleSend}
                disabled={(!text.trim() && selectedImages.length === 0 && !selectedVideo) || isSending || cooldownLeft > 0}
                className="px-6 py-2.5 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white text-[14px] font-bold rounded-xl shadow-sm disabled:from-base-content/20 disabled:to-base-content/20 disabled:text-base-content/40 disabled:shadow-none disabled:cursor-not-allowed transition-all duration-300"
              >
                {isUploading ? '업로드 중...' : isSending ? '전송 중...' : '전송'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoungeComposeModal;
