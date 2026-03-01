/**
 * VerificationRequestModal.jsx
 *
 * 역할: 사용자가 실명과 전화번호를 입력하면 Twilio SMS로 인증 코드를 즉시 발송하는 모달.
 * - verificationService.sendVerificationSms() 호출 → Edge Function → Twilio SMS
 * - SMS 발송 성공 시 onSmsSent 콜백 실행 (부모에서 인증 코드 입력 모달로 전환)
 * - 실명 2자 이상 / 010-XXXX-XXXX 형식 / 개인정보 동의 필수 검증
 */

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { verificationService } from '../services';

const VerificationRequestModal = ({ isOpen, onClose, onSmsSent }) => {
  const [formData, setFormData] = useState({
    realName: '',
    phoneNumber: ''
  });
  const [errors, setErrors] = useState({});
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const queryClient = useQueryClient();

  // 전화번호 자동 하이픈 포맷 (010-XXXX-XXXX)
  const formatPhoneNumber = (value) => {
    const numbers = value.replace(/[^\d]/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const formatted = name === 'phoneNumber' ? formatPhoneNumber(value) : value;
    setFormData(prev => ({ ...prev, [name]: formatted }));
    // 해당 필드 오류 즉시 초기화
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
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

  // SMS 발송 mutation — Edge Function 호출
  const mutation = useMutation({
    mutationFn: ({ realName, phoneNumber }) =>
      verificationService.sendVerificationSms(realName, phoneNumber),
    onSuccess: () => {
      // 인증 요청 상태 캐시 갱신
      queryClient.invalidateQueries({ queryKey: ['myVerificationRequest'] });
      // 부모에게 성공 신호 전달 (코드 입력 모달로 전환)
      onSmsSent?.();
      onClose();
    },
    onError: (error) => {
      setErrors({ submit: error.message || 'SMS 발송 중 오류가 발생했습니다.' });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!privacyAgreed) {
      setErrors(prev => ({ ...prev, privacy: '개인정보 수집 및 이용에 동의해주세요.' }));
      return;
    }
    mutation.mutate({ realName: formData.realName.trim(), phoneNumber: formData.phoneNumber });
  };

  if (!isOpen) return null;

  const isSubmitting = mutation.isPending;
  const isFormValid =
    formData.realName.trim().length >= 2 &&
    /^010-\d{4}-\d{4}$/.test(formData.phoneNumber) &&
    privacyAgreed;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">

        {/* 헤더 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">전화번호 인증</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-blue-100 text-sm mt-1">
            입력한 전화번호로 인증 코드를 즉시 발송합니다.
          </p>
        </div>

        {/* 폼 본문 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* 서버 오류 메시지 */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* 실명 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              실명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="realName"
              value={formData.realName}
              onChange={handleChange}
              placeholder="실명을 입력해주세요"
              maxLength={20}
              disabled={isSubmitting}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-gray-50 ${
                errors.realName ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.realName && (
              <p className="text-xs text-red-600 mt-1">{errors.realName}</p>
            )}
          </div>

          {/* 전화번호 입력 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              휴대폰 번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              placeholder="010-0000-0000"
              maxLength={13}
              disabled={isSubmitting}
              className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors disabled:bg-gray-50 ${
                errors.phoneNumber ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
            />
            {errors.phoneNumber && (
              <p className="text-xs text-red-600 mt-1">{errors.phoneNumber}</p>
            )}
          </div>

          {/* 개인정보 수집·이용 동의 (개인정보 보호법 제15조) */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-100 px-3 py-2">
              <span className="text-xs font-semibold text-gray-700">[필수] 개인정보 수집·이용 동의</span>
            </div>
            <div className="p-3 bg-white">
              <table className="w-full text-xs text-gray-600 border-collapse">
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 font-medium text-gray-700 whitespace-nowrap align-top w-24">수집 항목</td>
                    <td className="py-1.5">실명, 휴대폰 번호</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 font-medium text-gray-700 whitespace-nowrap align-top">수집 목적</td>
                    <td className="py-1.5">본인 확인 및 서비스 이용 자격 인증</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="py-1.5 pr-3 font-medium text-gray-700 whitespace-nowrap align-top">보유 기간</td>
                    <td className="py-1.5">
                      회원 탈퇴 시까지<br />
                      <span className="text-gray-400">※ 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관</span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1.5 pr-3 font-medium text-gray-700 whitespace-nowrap align-top">거부 권리</td>
                    <td className="py-1.5">
                      동의를 거부할 수 있으나, 거부 시 본인 인증이 불가하여 일부 서비스 이용이 제한됩니다.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200 px-3 py-2.5 bg-gray-50">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="privacyAgreement"
                  checked={privacyAgreed}
                  onChange={(e) => {
                    setPrivacyAgreed(e.target.checked);
                    if (errors.privacy) setErrors(prev => ({ ...prev, privacy: null }));
                  }}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="privacyAgreement" className="text-xs text-gray-700 cursor-pointer">
                  위 개인정보 수집·이용 내용을 확인하였으며, 이에 동의합니다.
                </label>
              </div>
              {errors.privacy && (
                <p className="text-xs text-red-600 mt-1 ml-6">{errors.privacy}</p>
              )}
            </div>
          </div>

          {/* 안내 문구 */}
          <p className="text-xs text-gray-500 text-center">
            인증 코드는 발송 후 <strong>10분간</strong> 유효합니다.
          </p>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting || !isFormValid}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                발송 중...
              </>
            ) : (
              '인증번호 받기'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

VerificationRequestModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  /** SMS 발송 성공 시 호출되는 콜백 (코드 입력 모달로 전환용) */
  onSmsSent: PropTypes.func
};

export default VerificationRequestModal;
