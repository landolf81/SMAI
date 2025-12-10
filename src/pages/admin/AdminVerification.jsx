import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SendIcon from "@mui/icons-material/Send";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { AdminOnly } from '../../components/PermissionComponents';
import { verificationService } from '../../services';

const AdminVerification = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [rejectModal, setRejectModal] = useState({ open: false, requestId: null });
  const [rejectReason, setRejectReason] = useState('');
  const [generatedCode, setGeneratedCode] = useState({ code: null, phone: null });

  // 인증 요청 목록 조회
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['adminVerificationRequests', filterStatus, page, searchTerm],
    queryFn: () => verificationService.getAllRequests({
      status: filterStatus,
      page,
      limit: 20,
      search: searchTerm
    })
  });

  // 통계 조회
  const { data: stats } = useQuery({
    queryKey: ['verificationStats'],
    queryFn: () => verificationService.getStats()
  });

  // 코드 생성 뮤테이션
  const generateCodeMutation = useMutation({
    mutationFn: (requestId) => verificationService.generateCode(requestId),
    onSuccess: (result) => {
      setGeneratedCode({ code: result.code, phone: result.request?.phone_number });
      queryClient.invalidateQueries(['adminVerificationRequests']);
      queryClient.invalidateQueries(['verificationStats']);
    },
    onError: (error) => {
      alert(error.message || '코드 생성에 실패했습니다.');
    }
  });

  // 직접 승인 뮤테이션
  const approveMutation = useMutation({
    mutationFn: (requestId) => verificationService.approveRequest(requestId),
    onSuccess: () => {
      alert('인증이 승인되었습니다.');
      queryClient.invalidateQueries(['adminVerificationRequests']);
      queryClient.invalidateQueries(['verificationStats']);
    },
    onError: (error) => {
      alert(error.message || '승인에 실패했습니다.');
    }
  });

  // 거부 뮤테이션
  const rejectMutation = useMutation({
    mutationFn: ({ requestId, reason }) => verificationService.rejectRequest(requestId, reason),
    onSuccess: () => {
      alert('인증 요청이 거부되었습니다.');
      setRejectModal({ open: false, requestId: null });
      setRejectReason('');
      queryClient.invalidateQueries(['adminVerificationRequests']);
      queryClient.invalidateQueries(['verificationStats']);
    },
    onError: (error) => {
      alert(error.message || '거부 처리에 실패했습니다.');
    }
  });

  const handleSearch = () => {
    setSearchTerm(searchInput);
    setPage(1);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleGenerateCode = (requestId) => {
    if (confirm('인증 코드를 생성하시겠습니까? 코드는 24시간 동안 유효합니다.')) {
      generateCodeMutation.mutate(requestId);
    }
  };

  const handleApprove = (requestId) => {
    if (confirm('이 사용자를 직접 승인하시겠습니까?')) {
      approveMutation.mutate(requestId);
    }
  };

  const handleReject = () => {
    if (!rejectReason.trim()) {
      alert('거부 사유를 입력해주세요.');
      return;
    }
    rejectMutation.mutate({ requestId: rejectModal.requestId, reason: rejectReason });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('클립보드에 복사되었습니다.');
  };

  // 전화번호 마스킹 (010-****-1234 형식)
  const maskPhoneNumber = (phone) => {
    if (!phone) return '-';
    // 010-1234-5678 형식에서 중간 4자리를 마스킹
    const parts = phone.replace(/-/g, '');
    if (parts.length >= 11) {
      return `${parts.slice(0, 3)}-****-${parts.slice(7, 11)}`;
    }
    // 다른 형식일 경우 뒷 4자리만 보이게
    return phone.replace(/\d(?=\d{4})/g, '*');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'code_sent': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'approved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return '대기';
      case 'code_sent': return '코드발송';
      case 'approved': return '승인';
      case 'rejected': return '거부';
      default: return status;
    }
  };

  const requests = data?.requests || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  if (isLoading && requests.length === 0) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg text-[#004225]"></div>
            <p className="mt-4 text-gray-600">인증 요청 목록을 불러오는 중...</p>
          </div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#004225] rounded-xl flex items-center justify-center">
              <VerifiedUserIcon className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">신원 인증 관리</h1>
              <p className="text-gray-500 text-sm">사용자 신원 인증 요청 처리</p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="btn bg-[#004225] hover:bg-[#003018] text-white border-none gap-2"
            disabled={isLoading}
          >
            <RefreshIcon className={isLoading ? 'animate-spin' : ''} fontSize="small" />
            새로고침
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">전체</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{stats?.total || 0}</p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <VerifiedUserIcon className="text-gray-600" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">대기</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats?.pending || 0}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <HourglassEmptyIcon className="text-amber-600" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">코드발송</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats?.code_sent || 0}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <SendIcon className="text-blue-600" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">승인</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.approved || 0}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="text-emerald-600" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">거부</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats?.rejected || 0}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <CancelIcon className="text-red-600" fontSize="small" />
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="실명 또는 연락처로 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                검색
              </button>
            </div>

            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">모든 상태</option>
                <option value="pending">대기</option>
                <option value="code_sent">코드발송</option>
                <option value="approved">승인</option>
                <option value="rejected">거부</option>
              </select>
            </div>
          </div>
        </div>

        {/* 생성된 코드 표시 */}
        {generatedCode.code && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-blue-800">인증 코드가 생성되었습니다</h4>
                <p className="text-xs text-blue-700 mt-1">
                  아래 코드를 <span className="font-medium">{generatedCode.phone}</span>로 SMS 발송해주세요.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-3xl font-bold text-blue-900 tracking-widest">{generatedCode.code}</span>
                  <button
                    onClick={() => copyToClipboard(generatedCode.code)}
                    className="p-2 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                    title="복사"
                  >
                    <ContentCopyIcon className="text-blue-600" fontSize="small" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => setGeneratedCode({ code: null, phone: null })}
                className="text-blue-600 hover:text-blue-800"
              >
                <CancelIcon />
              </button>
            </div>
          </div>
        )}

        {/* 인증 요청 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">사용자</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">실명</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">연락처</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">요청일</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100">
                          <img
                            src={request.users?.profile_pic || '/default/default_profile.png'}
                            alt="프로필"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = '/default/default_profile.png';
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{request.users?.username || request.users?.name || '-'}</div>
                          <div className="text-xs text-gray-500">{request.users?.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{request.real_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-mono">{maskPhoneNumber(request.phone_number)}</span>
                        <button
                          onClick={() => copyToClipboard(request.phone_number)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="실제 번호 복사"
                        >
                          <ContentCopyIcon className="text-gray-400" style={{ fontSize: 16 }} />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                      {request.status === 'rejected' && request.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">사유: {request.rejection_reason}</p>
                      )}
                      {request.status === 'code_sent' && request.verification_code && (
                        <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          코드: <span className="font-mono font-medium">{request.verification_code}</span>
                          <button
                            onClick={() => copyToClipboard(request.verification_code)}
                            className="p-0.5 hover:bg-blue-100 rounded"
                          >
                            <ContentCopyIcon style={{ fontSize: 12 }} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(request.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-2">
                        {(request.status === 'pending' || request.status === 'code_sent') && (
                          <>
                            <button
                              className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                              onClick={() => handleGenerateCode(request.id)}
                              title="코드 생성"
                              disabled={generateCodeMutation.isPending}
                            >
                              <SendIcon fontSize="small" />
                            </button>
                            <button
                              className="p-2 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200 transition-colors"
                              onClick={() => handleApprove(request.id)}
                              title="직접 승인"
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircleIcon fontSize="small" />
                            </button>
                            <button
                              className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                              onClick={() => setRejectModal({ open: true, requestId: request.id })}
                              title="거부"
                            >
                              <CancelIcon fontSize="small" />
                            </button>
                          </>
                        )}
                        {request.status === 'approved' && (
                          <span className="text-sm text-emerald-600 font-medium">승인됨</span>
                        )}
                        {request.status === 'rejected' && (
                          <span className="text-sm text-red-600 font-medium">거부됨</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {requests.length === 0 && !isLoading && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100 mt-6">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <VerifiedUserIcon className="text-gray-400 text-3xl" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">인증 요청이 없습니다</h3>
            <p className="text-gray-500">검색 조건을 확인하거나 필터를 변경해보세요.</p>
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="text-sm text-gray-600">
              전체 <span className="font-medium">{pagination.total}</span>건 중{' '}
              <span className="font-medium">{((pagination.page - 1) * 20) + 1}</span>-
              <span className="font-medium">{Math.min(pagination.page * 20, pagination.total)}</span>건 표시
            </div>

            <div className="flex items-center gap-1">
              <button
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page === 1 || isLoading}
                onClick={() => setPage(1)}
              >
                ««
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page === 1 || isLoading}
                onClick={() => setPage(p => p - 1)}
              >
                «
              </button>

              {(() => {
                const currentPage = pagination.page;
                const totalPages = pagination.totalPages;
                const pages = [];

                let start = Math.max(1, currentPage - 2);
                let end = Math.min(totalPages, start + 4);

                if (end - start < 4) {
                  start = Math.max(1, end - 4);
                }

                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        i === currentPage
                          ? 'bg-[#004225] text-white'
                          : 'border border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                      onClick={() => setPage(i)}
                      disabled={isLoading}
                    >
                      {i}
                    </button>
                  );
                }

                return pages;
              })()}

              <button
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => setPage(p => p + 1)}
              >
                »
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => setPage(pagination.totalPages)}
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 거부 사유 모달 */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">인증 요청 거부</h3>
            <p className="text-sm text-gray-600 mb-4">거부 사유를 입력해주세요.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="예: 제출된 정보가 일치하지 않습니다."
              className="w-full p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows={3}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setRejectModal({ open: false, requestId: null });
                  setRejectReason('');
                }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {rejectMutation.isPending ? '처리 중...' : '거부'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminOnly>
  );
};

export default AdminVerification;
