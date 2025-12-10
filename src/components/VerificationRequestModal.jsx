import { useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { verificationService } from '../services';

const VerificationRequestModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    realName: '',
    phoneNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const queryClient = useQueryClient();

  // 전화번호 형식 변환 (자동 하이픈)
  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phoneNumber') {
      setFormData({ ...formData, [name]: formatPhoneNumber(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.realName || formData.realName.trim().length < 2) {
      newErrors.realName = '실명을 2자 이상 입력해주세요';
    }

    const phonePattern = /^010-\d{4}-\d{4}$/;
    if (!phonePattern.test(formData.phoneNumber)) {
      newErrors.phoneNumber = '올바른 휴대폰 번호를 입력해주세요 (010-0000-0000)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const mutation = useMutation({
    mutationFn: (data) => verificationService.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myVerificationRequest'] });
      onClose();
      alert('인증 요청이 접수되었습니다. 관리자 검토 후 SMS로 인증 코드가 발송됩니다.');
    },
    onError: (error) => {
      setErrors({ submit: error.message || '인증 요청 중 오류가 발생했습니다.' });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!privacyAgreed) {
      setErrors({ ...errors, privacy: '개인정보 수집 및 이용에 동의해주세요.' });
      return;
    }
    mutation.mutate(formData);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* 헤더 */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">신원 인증 요청</h2>
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
            별명을 수정하려면 신원 인증이 필요합니다. 아래 정보를 입력하면 관리자 검토 후 SMS로 인증 코드가 발송됩니다.
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errors.submit && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}

          {/* 실명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              실명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="realName"
              value={formData.realName}
              onChange={handleChange}
              placeholder="홍길동"
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
                errors.realName ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.realName && (
              <p className="text-red-500 text-xs mt-1">{errors.realName}</p>
            )}
          </div>

          {/* 휴대폰 번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              휴대폰 번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="010-0000-0000"
              maxLength={13}
              className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
                errors.phoneNumber ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.phoneNumber && (
              <p className="text-red-500 text-xs mt-1">{errors.phoneNumber}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              이 번호로 인증 코드가 발송됩니다.
            </p>
          </div>

          {/* 개인정보 수집 동의 */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h4 className="text-sm font-medium text-gray-800 mb-2">개인정보 수집 및 이용 동의</h4>
            <div className="text-xs text-gray-600 space-y-1 mb-3">
              <p><strong>수집항목:</strong> 성명, 휴대폰 번호</p>
              <p><strong>수집목적:</strong> 신원 인증 및 별명 변경 허용</p>
              <p><strong>보유기간:</strong> 회원 탈퇴 시까지</p>
              <p className="text-gray-500">※ 회원 탈퇴 시 수집된 개인정보는 즉시 삭제됩니다.</p>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={privacyAgreed}
                onChange={(e) => {
                  setPrivacyAgreed(e.target.checked);
                  if (errors.privacy) {
                    setErrors({ ...errors, privacy: null });
                  }
                }}
                className="mt-0.5 w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
              />
              <span className="text-sm text-gray-700">
                위 개인정보 수집 및 이용에 동의합니다. <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.privacy && (
              <p className="text-red-500 text-xs mt-2">{errors.privacy}</p>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? '요청 중...' : '인증 요청'}
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

VerificationRequestModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export default VerificationRequestModal;
