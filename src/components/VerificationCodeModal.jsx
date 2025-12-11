import { useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { verificationService } from '../services';

const VerificationCodeModal = ({ isOpen, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const handleChange = (e) => {
    const value = e.target.value.replace(/[^\d]/g, '').slice(0, 6);
    setCode(value);
    if (error) setError(null);
  };

  const mutation = useMutation({
    mutationFn: (verificationCode) => verificationService.verifyCode(verificationCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVerificationRequest'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.invalidateQueries({ queryKey: ['badges'] });
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        alert('인증이 완료되었습니다! 이제 별명을 수정할 수 있습니다.');
      }
    },
    onError: (err) => {
      setError(err.message || '인증 코드 확인 중 오류가 발생했습니다.');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('6자리 인증 코드를 입력해주세요.');
      return;
    }
    mutation.mutate(code);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">인증 코드 입력</h2>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="p-4 bg-blue-50 border-b border-blue-100">
          <p className="text-sm text-blue-700">
            SMS로 발송된 6자리 인증 코드를 입력해주세요.
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* 코드 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              인증 코드
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={handleChange}
              placeholder="000000"
              className="w-full px-4 py-4 border border-gray-300 rounded-xl text-center text-2xl font-bold tracking-widest focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2 text-center">
              코드는 24시간 동안 유효합니다.
            </p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending || code.length !== 6}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? '확인 중...' : '인증 확인'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={mutation.isPending}
              className="px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

VerificationCodeModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func
};

export default VerificationCodeModal;
