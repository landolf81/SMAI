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
    refetchInterval: 10000 // 10초마다 상태 확인
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
              <h4 className="text-sm font-medium text-yellow-800">인증이 필요합니다</h4>
              <p className="text-xs text-yellow-700 mt-1">
                별명 수정 및 일부 기능을 사용하려면 인증이 필요합니다.
              </p>
              <button
                onClick={() => setShowRequestModal(true)}
                className="mt-2 text-sm font-medium text-yellow-700 underline hover:text-yellow-800"
              >
                인증 요청하기
              </button>
            </div>
          </div>
        </div>
      );
    }

    switch (request.status) {
      case 'pending':
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-yellow-800">SMS 발송에 문제가 발생했습니다</h4>
                <p className="text-xs text-yellow-700 mt-1">
                  인증번호 발송 중 오류가 발생했습니다. 아래 버튼을 눌러 다시 시도해주세요.
                </p>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="mt-2 text-sm font-medium text-yellow-700 underline hover:text-yellow-800"
                >
                  다시 인증번호 받기
                </button>
              </div>
            </div>
          </div>
        );

      case 'code_sent': {
        const isExpired = request.code_expires_at && new Date(request.code_expires_at) < new Date();
        return isExpired ? (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-orange-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-orange-800">인증 코드가 만료되었습니다</h4>
                <p className="text-xs text-orange-700 mt-1">
                  10분이 지나 코드가 만료되었습니다. 새 인증번호를 받아주세요.
                </p>
                <button
                  onClick={() => setShowRequestModal(true)}
                  className="mt-2 px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
                >
                  인증번호 재발송
                </button>
              </div>
            </div>
          </div>
        ) : (
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
      }

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

      {/* 인증 요청 모달 — SMS 발송 성공 시 코드 입력 모달로 즉시 전환 */}
      <VerificationRequestModal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSmsSent={() => {
          setShowRequestModal(false);
          setShowCodeModal(true);
        }}
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
