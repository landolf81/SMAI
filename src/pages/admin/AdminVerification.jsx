/**
 * AdminVerification.jsx
 *
 * 역할: 사용자 인증 현황 모니터링 (읽기 전용)
 * - SMS는 자동 발송 (Edge Function send-verification-sms)되므로 수동 버튼 없음
 * - 통계, 검색, 필터, 목록 조회만 제공
 * - 이상 사용자는 DB에서 직접 처리
 */

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import SendIcon from "@mui/icons-material/Send";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { AdminOnly } from '../../components/PermissionComponents';
import { generateDiceBearAvatar, getProfilePic } from '../../utils/userHelper';
import { verificationService } from '../../services';

const AdminVerification = () => {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);

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

  const handleSearch = () => {
    setSearchTerm(searchInput);
    setPage(1);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  // 전화번호 마스킹 (010-****-1234 형식)
  const maskRealName = (name) => {
    if (!name) return '-';
    if (name.length <= 1) return name;
    if (name.length === 2) return name[0] + '*';
    const mid = Math.floor(name.length / 2);
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
  };

  const maskPhoneNumber = (phone) => {
    if (!phone) return '-';
    const parts = phone.replace(/-/g, '');
    if (parts.length >= 11) {
      return `${parts.slice(0, 3)}-****-${parts.slice(7, 11)}`;
    }
    return phone.replace(/\d(?=\d{4})/g, '*');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':   return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'code_sent': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'approved':  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'rejected':  return 'bg-red-100 text-red-700 border-red-200';
      default:          return 'bg-base-200 text-base-content border-base-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':   return 'SMS 오류';
      case 'code_sent': return '코드발송';
      case 'approved':  return '승인';
      case 'rejected':  return '거부';
      default:          return status;
    }
  };

  const requests = data?.requests || [];
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 };

  if (isLoading && requests.length === 0) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen bg-base-200">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg text-[#004225]"></div>
            <p className="mt-4 text-base-content/60">인증 요청 목록을 불러오는 중...</p>
          </div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="p-6 pt-20 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#004225] rounded-xl flex items-center justify-center">
              <VerifiedUserIcon className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-base-content">인증 현황</h1>
              <p className="text-base-content/60 text-sm">사용자 인증 내역 모니터링 (SMS 자동 발송)</p>
            </div>
          </div>

          <button
            onClick={() => {
              refetch();
              queryClient.invalidateQueries(['verificationStats']);
            }}
            className="btn bg-[#004225] hover:bg-[#003018] text-white border-none gap-2"
            disabled={isLoading}
          >
            <RefreshIcon className={isLoading ? 'animate-spin' : ''} fontSize="small" />
            새로고침
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-base-content/60 uppercase tracking-wide">전체</p>
                <p className="text-2xl font-bold text-base-content mt-1">{stats?.total || 0}</p>
              </div>
              <div className="w-10 h-10 bg-base-200 rounded-lg flex items-center justify-center">
                <VerifiedUserIcon className="text-base-content/60" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-base-content/60 uppercase tracking-wide">SMS 오류</p>
                <p className="text-2xl font-bold text-amber-600 mt-1">{stats?.pending || 0}</p>
              </div>
              <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                <HourglassEmptyIcon className="text-amber-600" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-base-content/60 uppercase tracking-wide">코드발송</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{stats?.code_sent || 0}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <SendIcon className="text-blue-600" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-base-content/60 uppercase tracking-wide">승인</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">{stats?.approved || 0}</p>
              </div>
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="text-emerald-600" fontSize="small" />
              </div>
            </div>
          </div>

          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-base-content/60 uppercase tracking-wide">거부</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{stats?.rejected || 0}</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <CancelIcon className="text-red-600" fontSize="small" />
              </div>
            </div>
          </div>
        </div>

        {/* 검색 및 필터 */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/40" />
                <input
                  type="text"
                  placeholder="실명 또는 연락처로 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="w-full pl-10 pr-4 py-2.5 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-base-100 text-base-content"
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
                className="px-4 py-2.5 border border-base-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-base-100 text-base-content"
              >
                <option value="all">모든 상태</option>
                <option value="pending">SMS 오류</option>
                <option value="code_sent">코드발송</option>
                <option value="approved">승인</option>
                <option value="rejected">거부</option>
              </select>
            </div>
          </div>
        </div>

        {/* 인증 요청 목록 */}
        <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-base-200 border-b border-base-300">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">사용자</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">실명</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">연락처</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">상태</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-base-content/60 uppercase tracking-wider">요청일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {requests.map((request) => (
                  <tr key={request.id} className="hover:bg-base-200 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-base-300 bg-base-200">
                          <img
                            src={getProfilePic(request.users)}
                            alt="프로필"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = generateDiceBearAvatar(request.users?.id || request.users?.username || 'default');
                            }}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-base-content">{request.users?.username || request.users?.name || '-'}</div>
                          <div className="text-xs text-base-content/60">{request.users?.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-base-content">{maskRealName(request.real_name)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-base-content font-mono">{maskPhoneNumber(request.phone_number)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${getStatusColor(request.status)}`}>
                        {getStatusText(request.status)}
                      </span>
                      {request.status === 'rejected' && request.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">사유: {request.rejection_reason}</p>
                      )}
                      {request.status === 'code_sent' && request.code_expires_at && (
                        <p className="text-xs text-blue-500 mt-1">
                          만료: {new Date(request.code_expires_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-base-content/60">
                        {new Date(request.created_at).toLocaleDateString('ko-KR')}
                      </span>
                      <p className="text-xs text-base-content/40 mt-0.5">
                        {new Date(request.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {requests.length === 0 && !isLoading && (
          <div className="text-center py-16 bg-base-100 rounded-xl border border-base-300 mt-6">
            <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <VerifiedUserIcon className="text-base-content/40 text-3xl" />
            </div>
            <h3 className="text-lg font-medium text-base-content mb-2">인증 내역이 없습니다</h3>
            <p className="text-base-content/60">검색 조건을 확인하거나 필터를 변경해보세요.</p>
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-col items-center gap-4 mt-6">
            <div className="text-sm text-base-content/60">
              전체 <span className="font-medium">{pagination.total}</span>건 중{' '}
              <span className="font-medium">{((pagination.page - 1) * 20) + 1}</span>-
              <span className="font-medium">{Math.min(pagination.page * 20, pagination.total)}</span>건 표시
            </div>

            <div className="flex items-center gap-1">
              <button
                className="px-3 py-2 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page === 1 || isLoading}
                onClick={() => setPage(1)}
              >
                ««
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                if (end - start < 4) start = Math.max(1, end - 4);
                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        i === currentPage
                          ? 'bg-[#004225] text-white'
                          : 'border border-base-300 bg-base-100 hover:bg-base-200'
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
                className="px-3 py-2 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => setPage(p => p + 1)}
              >
                »
              </button>
              <button
                className="px-3 py-2 rounded-lg border border-base-300 bg-base-100 hover:bg-base-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => setPage(pagination.totalPages)}
              >
                »»
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminOnly>
  );
};

export default AdminVerification;
