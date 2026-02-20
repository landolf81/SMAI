/**
 * DeleteConfirmModal.jsx
 * 게시물 삭제 확인 모달 - 웹앱 테마 반영 디자인
 * 사용처: EnhancedInstagramPost.jsx, Post.jsx
 */
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, loading }) => {
  const scrollYRef = useRef(0);
  const wasOpenRef = useRef(false);

  // 스크롤 잠금 (wasOpenRef로 초기 마운트 시 scrollTo(0,0) 방지)
  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      scrollYRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      document.body.style.top = `-${scrollYRef.current}px`;
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, scrollYRef.current);
    }

    return () => {
      if (wasOpenRef.current) {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[10000]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-6 animate-modal-pop overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 경고 영역 */}
        <div className="flex flex-col items-center pt-7 pb-4 px-6">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">게시물을 삭제할까요?</h3>
          <p className="text-sm text-gray-500 text-center leading-relaxed">
            삭제된 게시물과 댓글은<br />복구할 수 없습니다.
          </p>
        </div>

        {/* 버튼 영역 */}
        <div className="border-t border-gray-100">
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full py-3.5 text-[15px] font-semibold text-red-500 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50 border-b border-gray-100"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                삭제 중...
              </span>
            ) : '삭제'}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="w-full py-3.5 text-[15px] font-medium text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50"
          >
            취소
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modal-pop {
          from {
            transform: scale(0.95);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-modal-pop {
          animation: modal-pop 0.2s ease-out;
        }
      `}</style>
    </div>,
    document.body
  );
};

export default DeleteConfirmModal;
