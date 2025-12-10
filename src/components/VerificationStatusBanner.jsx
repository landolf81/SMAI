import { useState } from 'react';
import PropTypes from 'prop-types';
import { useQuery } from '@tanstack/react-query';
import { verificationService } from '../services';
import VerificationRequestModal from './VerificationRequestModal';
import VerificationCodeModal from './VerificationCodeModal';

const VerificationStatusBanner = ({ user, onVerificationComplete }) => {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);

  // 이미 인증된 사용자는 표시하지 않음
  if (user?.verified) return null;

  // 인증 요청 상태 조회
  const { data: request, isLoading } = useQuery({
    queryKey: ['myVerificationRequest'],
    queryFn: () => verificationService.getMyRequest(),
    enabled: !user?.verified,
    refetchInterval: 30000 // 30초마다 상태 확인
  });

  if (isLoading) return null;

  // 상태별 배너 렌더링
  const renderBanner = () => {
    if (!request) {
      // 인증 요청 없음
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800">신원 인증이 필요합니다</h4>
              <p className="text-xs text-yellow-700 mt-1">
                별명 수정 및 일부 기능을 사용하려면 신원 인증이 필요합니다.
              </p>
              <button
                onClick={() => setShowRequestModal(true)}
                className="mt-2 text-sm font-medium text-yellow-700 underline hover:text-yellow-800"
              >
                신원 인증 요청하기
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (request.status) {
      case 'pending':
        return (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-blue-500 mt-0.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800">인증 요청 검토 중</h4>
                <p className="text-xs text-blue-700 mt-1">
                  관리자가 요청을 검토하고 있습니다. 검토 완료 후 SMS로 인증 코드가 발송됩니다.
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  요청일: {new Date(request.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          </div>
        );

      case 'code_sent':
        return (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-green-800">인증 코드가 발송되었습니다</h4>
                <p className="text-xs text-green-700 mt-1">
                  {request.phone_number}로 인증 코드가 발송되었습니다. 코드를 입력하여 인증을 완료하세요.
                </p>
                <button
                  onClick={() => setShowCodeModal(true)}
                  className="mt-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                >
                  인증 코드 입력
                </button>
              </div>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-red-800">인증 요청이 거부되었습니다</h4>
                {request.rejection_reason && (
                  <p className="text-xs text-red-700 mt-1">
                    사유: {request.rejection_reason}
                  </p>
                )}
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="mt-2 text-sm font-medium text-red-700 underline hover:text-red-800"
                >
                  다시 인증 요청하기
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {renderBanner()}

      {/* 인증 요청 모달 */}
      <VerificationRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
      />

      {/* 인증 코드 입력 모달 */}
      <VerificationCodeModal
        isOpen={showCodeModal}
        onClose={() => setShowCodeModal(false)}
        onSuccess={onVerificationComplete}
      />
    </>
  );
};

VerificationStatusBanner.propTypes = {
  user: PropTypes.object,
  onVerificationComplete: PropTypes.func
};

export default VerificationStatusBanner;
