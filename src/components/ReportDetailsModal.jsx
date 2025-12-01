import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faFlag, faExclamationTriangle, faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { reportService } from "../services";
import moment from 'moment';

const ReportDetailsModal = ({ postId, isOpen, onClose }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && postId) {
      fetchReportDetails();
    }
  }, [isOpen, postId]);

  const fetchReportDetails = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await reportService.getReports();
      // postId로 필터링
      const postReports = data.filter(report => report.post_id === postId);
      setReportData({
        reportCount: postReports.length,
        reports: postReports
      });
    } catch (err) {
      console.error('신고 내역 조회 실패:', err);
      setError('신고 내역을 불러올 수 없습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (level) => {
    switch (level) {
      case 3: return 'text-red-600 bg-red-50';
      case 2: return 'text-orange-600 bg-orange-50';
      case 1: return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityIcon = (level) => {
    switch (level) {
      case 3: return faExclamationTriangle;
      case 2: return faFlag;
      case 1: return faInfoCircle;
      default: return faFlag;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'reviewing': return '검토중';
      case 'resolved': return '처리완료';
      case 'dismissed': return '기각됨';
      default: return status;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-blue-600 bg-blue-50';
      case 'reviewing': return 'text-yellow-600 bg-yellow-50';
      case 'resolved': return 'text-green-600 bg-green-50';
      case 'dismissed': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* 배경 오버레이 */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* 모달 콘텐츠 */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* 헤더 */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <FontAwesomeIcon icon={faFlag} className="text-red-500 mr-2" />
                <h3 className="text-lg font-medium text-gray-900">
                  신고 내역
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
              </button>
            </div>

            {/* 로딩 상태 */}
            {loading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-gray-600">로딩 중...</span>
              </div>
            )}

            {/* 에러 상태 */}
            {error && (
              <div className="text-center py-8">
                <p className="text-red-600">{error}</p>
              </div>
            )}

            {/* 신고 내역 */}
            {reportData && !loading && !error && (
              <div>
                {/* 요약 정보 */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">총 신고 수</span>
                    <span className="text-lg font-semibold text-red-600">
                      {reportData.reportCount}건
                    </span>
                  </div>
                </div>

                {/* 신고 목록 */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {reportData.reports.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">
                      신고 내역이 없습니다.
                    </p>
                  ) : (
                    reportData.reports.map((report) => (
                      <div key={report.id} className="border rounded-lg p-3">
                        {/* 신고 헤더 */}
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center">
                            <FontAwesomeIcon 
                              icon={getSeverityIcon(report.severity_level)} 
                              className={`mr-2 ${getSeverityColor(report.severity_level).split(' ')[0]}`}
                            />
                            <div>
                              <p className="font-medium text-sm text-gray-900">
                                {report.category_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {report.reporter_username || '익명'} · {moment(report.created_at).fromNow()}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                            {getStatusText(report.status)}
                          </span>
                        </div>

                        {/* 신고 사유 설명 */}
                        {report.category_description && (
                          <p className="text-xs text-gray-600 mb-2">
                            {report.category_description}
                          </p>
                        )}

                        {/* 추가 사유 */}
                        {report.custom_reason && (
                          <div className="bg-gray-50 rounded p-2">
                            <p className="text-xs text-gray-700">
                              <span className="font-medium">추가 사유:</span> {report.custom_reason}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetailsModal;