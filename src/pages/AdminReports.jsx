import React, { useState, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportService, postService, commentService } from '../services';
import { AuthContext } from '../context/AuthContext';
import { useAdminPermissions } from '../hooks/usePermissions';
import PostDetailModal from '../components/PostDetailModal';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Pagination,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Report as ReportIcon,
  Visibility as ViewIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon,
  Article as ArticleIcon
} from '@mui/icons-material';

const AdminReports = () => {
  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();
  const adminPermissions = useAdminPermissions();

  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processAction, setProcessAction] = useState('');
  const [processNotes, setProcessNotes] = useState('');
  const [isFalseReport, setIsFalseReport] = useState(false);
  const [disableReporterOnFalse, setDisableReporterOnFalse] = useState(false);

  // 게시물 상세 모달 상태
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);

  // 신고 목록 조회
  const { data: reportsData, isLoading, error } = useQuery({
    queryKey: ['adminReports', statusFilter, page],
    queryFn: async () => {
      const allReports = await reportService.getReports();

      // 상태 필터링
      let filtered = allReports;
      if (statusFilter !== 'all') {
        filtered = allReports.filter(report => report.status === statusFilter);
      }

      // 페이지네이션 (클라이언트 측)
      const limit = 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      return {
        reports: filtered.slice(startIndex, endIndex),
        total: filtered.length,
        totalPages: Math.ceil(filtered.length / limit)
      };
    },
    enabled: adminPermissions.isAdmin,
  });

  // 신고 처리 뮤테이션
  const processReportMutation = useMutation({
    mutationFn: async ({ reportId, action, notes, isFalseReport, disableReporter }) => {
      // 허위 신고인 경우 별도 처리
      if (isFalseReport) {
        return reportService.markAsFalseReport(reportId, disableReporter);
      }

      // action에 따라 status와 adminAction 결정
      let status = 'pending';
      let adminAction = action || 'no_action';

      if (action === 'approve' || action === 'hide_post' || action === 'hide_comment' ||
          action === 'delete_post' || action === 'delete_comment' ||
          action === 'warn_user' || action === 'suspend_user') {
        status = 'resolved';
      } else if (action === 'dismiss' || action === 'no_action') {
        status = 'dismissed';
        adminAction = 'no_action';
      } else if (action === 'review') {
        status = 'reviewing';
      }

      // updateReportStatus(reportId, status, adminAction, adminNotes, isFalseReport)
      return reportService.updateReportStatus(reportId, status, adminAction, notes || '', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });
      setShowProcessModal(false);
      setSelectedReport(null);
      setProcessAction('');
      setProcessNotes('');
      setIsFalseReport(false);
      setDisableReporterOnFalse(false);

      // 성공 토스트
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-center';
      toast.innerHTML = `
        <div class="alert alert-success">
          <span>✅ 신고가 처리되었습니다.</span>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    },
    onError: (error) => {
      console.error('신고 처리 실패:', error);
      
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-center';
      toast.innerHTML = `
        <div class="alert alert-error">
          <span>❌ ${error.response?.data?.error || '신고 처리 중 오류가 발생했습니다.'}</span>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    },
  });

  // 신고자 신고 권한 토글 뮤테이션
  const toggleReportPermissionMutation = useMutation({
    mutationFn: async ({ userId, canReport }) => {
      return reportService.toggleUserReportPermission(userId, canReport);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminReports'] });

      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-center';
      toast.innerHTML = `
        <div class="alert alert-success">
          <span>✅ 신고 기능이 ${variables.canReport ? '활성화' : '비활성화'}되었습니다.</span>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    },
    onError: (error) => {
      console.error('신고 권한 변경 실패:', error);
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-center';
      toast.innerHTML = `
        <div class="alert alert-error">
          <span>❌ 신고 권한 변경 중 오류가 발생했습니다.</span>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    },
  });

  const handleProcessReport = (report) => {
    setSelectedReport(report);
    setShowProcessModal(true);
  };

  const handleSubmitProcess = async () => {
    if (!selectedReport || !processAction) return;

    try {
      // 선택한 액션에 따라 실제 숨김/삭제 처리
      if (processAction === 'hide_post' && selectedReport.post_id) {
        await postService.hidePost(selectedReport.post_id, true);
      } else if (processAction === 'hide_comment' && selectedReport.comment_id) {
        await commentService.hideComment(selectedReport.comment_id, true);
      } else if (processAction === 'delete_post' && selectedReport.post_id) {
        await postService.deletePost(selectedReport.post_id);
      } else if (processAction === 'delete_comment' && selectedReport.comment_id) {
        await commentService.deleteCommentAdmin(selectedReport.comment_id);
      }

      // 신고 상태 업데이트
      processReportMutation.mutate({
        reportId: selectedReport.id,
        action: processAction,
        notes: processNotes,
        isFalseReport,
        disableReporter: disableReporterOnFalse
      });
    } catch (error) {
      console.error('처리 중 오류:', error);
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-center';
      toast.innerHTML = `
        <div class="alert alert-error">
          <span>❌ 처리 중 오류가 발생했습니다: ${error.message}</span>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => document.body.removeChild(toast), 3000);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'warning';
      case 'reviewing': return 'info';
      case 'resolved': return 'success';
      case 'dismissed': return 'default';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'reviewing': return '검토중';
      case 'resolved': return '처리완료';
      case 'dismissed': return '기각';
      default: return status;
    }
  };

  const getSeverityColor = (level) => {
    switch (level) {
      case 1: return 'success';
      case 2: return 'warning';
      case 3: return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (!adminPermissions.isAdmin) {
    return (
      <div className="p-6">
        <Alert severity="error">
          관리자 권한이 필요합니다.
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <CircularProgress />
        <Typography ml={2}>신고 목록을 불러오는 중...</Typography>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Alert severity="error">
          신고 목록을 불러오는데 실패했습니다: {error.message}
        </Alert>
      </div>
    );
  }

  const reports = reportsData?.reports || [];
  const totalReports = reportsData?.total || 0;
  const totalPages = reportsData?.totalPages || 1;

  return (
    <div className="p-6">
      <Box mb={3}>
        <Typography variant="h4" component="h1" gutterBottom>
          <ReportIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          신고 관리
        </Typography>
        <Typography variant="body1" color="text.secondary">
          사용자 신고를 검토하고 적절한 조치를 취하세요.
        </Typography>
      </Box>

      {/* 필터 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" gap={2} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>상태</InputLabel>
              <Select
                value={statusFilter}
                label="상태"
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <MenuItem value="all">전체</MenuItem>
                <MenuItem value="pending">대기중</MenuItem>
                <MenuItem value="reviewing">검토중</MenuItem>
                <MenuItem value="resolved">처리완료</MenuItem>
                <MenuItem value="dismissed">기각</MenuItem>
              </Select>
            </FormControl>
            
            <Typography variant="body2" color="text.secondary">
              총 {totalReports}건의 신고
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* 신고 목록 */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>신고 ID</TableCell>
              <TableCell>카테고리</TableCell>
              <TableCell>신고자</TableCell>
              <TableCell>대상</TableCell>
              <TableCell>신고일</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>심각도</TableCell>
              <TableCell>액션</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id} hover>
                <TableCell>#{report.id}</TableCell>
                <TableCell>
                  <Typography variant="body2" fontWeight="medium">
                    {report.category_name}
                  </Typography>
                  {report.custom_reason && (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {report.custom_reason.length > 50 
                        ? `${report.custom_reason.substring(0, 50)}...` 
                        : report.custom_reason}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box>
                    {report.reporter_username}
                    {report.reporter_can_report === false && (
                      <Chip
                        label="신고 차단됨"
                        color="error"
                        size="small"
                        sx={{ ml: 1, fontSize: '0.65rem', height: 18 }}
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  {report.comment_id 
                    ? `${report.comment_author_username} (댓글)`
                    : `${report.post_author_username} (게시물)`}
                </TableCell>
                <TableCell>{formatDate(report.created_at)}</TableCell>
                <TableCell>
                  <Chip 
                    label={getStatusLabel(report.status)} 
                    color={getStatusColor(report.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={`Level ${report.severity_level}`}
                    color={getSeverityColor(report.severity_level)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Box display="flex" gap={1}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ViewIcon />}
                      onClick={() => handleProcessReport(report)}
                      disabled={report.status === 'resolved'}
                    >
                      {report.status === 'resolved' ? '처리완료' : '처리하기'}
                    </Button>
                    {report.post_id && (
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<ArticleIcon />}
                        onClick={() => {
                          setSelectedPostId(report.post_id);
                          setShowPostModal(true);
                        }}
                        title="게시물 보기"
                      >
                        게시물
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={3}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(event, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}

      {/* 신고 처리 모달 */}
      <Dialog open={showProcessModal} onClose={() => setShowProcessModal(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          신고 처리 - #{selectedReport?.id}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              {/* 신고 정보 */}
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      신고 정보
                    </Typography>
                    {selectedReport.post_id && (
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<ArticleIcon />}
                        onClick={() => {
                          setSelectedPostId(selectedReport.post_id);
                          setShowPostModal(true);
                        }}
                      >
                        원본 게시물 보기
                      </Button>
                    )}
                  </Box>
                  <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">카테고리</Typography>
                      <Typography variant="body1">{selectedReport.category_name}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">신고자</Typography>
                      <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
                        <Typography variant="body1">{selectedReport.reporter_username}</Typography>
                        {selectedReport.reporter_can_report === false ? (
                          <>
                            <Chip
                              label="신고 차단됨"
                              color="error"
                              size="small"
                              sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                            <Button
                              size="small"
                              variant="outlined"
                              color="success"
                              onClick={() => toggleReportPermissionMutation.mutate({
                                userId: selectedReport.reporter_id,
                                canReport: true
                              })}
                              disabled={toggleReportPermissionMutation.isPending}
                            >
                              {toggleReportPermissionMutation.isPending ? '처리중...' : '신고 재활성화'}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={() => toggleReportPermissionMutation.mutate({
                              userId: selectedReport.reporter_id,
                              canReport: false
                            })}
                            disabled={toggleReportPermissionMutation.isPending}
                          >
                            {toggleReportPermissionMutation.isPending ? '처리중...' : '신고 차단'}
                          </Button>
                        )}
                      </Box>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">대상 작성자</Typography>
                      <Typography variant="body1">
                        {selectedReport.comment_id 
                          ? selectedReport.comment_author_username
                          : selectedReport.post_author_username}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="body2" color="text.secondary">신고일</Typography>
                      <Typography variant="body1">{formatDate(selectedReport.created_at)}</Typography>
                    </Box>
                    {(selectedReport.post_report_count > 0 || selectedReport.comment_report_count > 0) && (
                      <Box>
                        <Typography variant="body2" color="text.secondary">총 신고 횟수</Typography>
                        <Typography variant="body1" color="error">
                          {selectedReport.comment_id 
                            ? `${selectedReport.comment_report_count}회`
                            : `${selectedReport.post_report_count}회`}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                  
                  {selectedReport.custom_reason && (
                    <Box mt={2}>
                      <Typography variant="body2" color="text.secondary">상세 사유</Typography>
                      <Typography variant="body1">{selectedReport.custom_reason}</Typography>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* 컨텐츠 내용 */}
              {(selectedReport.post_content || selectedReport.comment_content) && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      신고된 {selectedReport.comment_id ? '댓글' : '게시물'} 내용
                    </Typography>
                    
                    {/* 게시물 이미지 표시 */}
                    {!selectedReport.comment_id && selectedReport.post_image && (
                      <Box mb={2}>
                        {selectedReport.post_image.includes(',') ? (
                          // 여러 이미지가 있는 경우
                          <Box display="flex" gap={1} flexWrap="wrap">
                            {selectedReport.post_image.split(',').map((img, index) => (
                              <Box key={index} sx={{ maxWidth: 200, maxHeight: 200 }}>
                                <img 
                                  src={`/uploads/posts/${img.trim()}`}
                                  alt={`Post image ${index + 1}`}
                                  style={{ 
                                    width: '100%', 
                                    height: '100%', 
                                    objectFit: 'cover',
                                    borderRadius: '8px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={() => window.open(`/uploads/posts/${img.trim()}`, '_blank')}
                                />
                              </Box>
                            ))}
                          </Box>
                        ) : (
                          // 단일 이미지
                          <Box sx={{ maxWidth: 400 }}>
                            <img 
                              src={`/uploads/posts/${selectedReport.post_image}`}
                              alt="Post image"
                              style={{ 
                                width: '100%', 
                                height: 'auto', 
                                borderRadius: '8px',
                                cursor: 'pointer'
                              }}
                              onClick={() => window.open(`/uploads/posts/${selectedReport.post_image}`, '_blank')}
                            />
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    {/* 텍스트 내용 표시 (전체 내용 표시) */}
                    <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedReport.comment_id 
                        ? selectedReport.comment_content
                        : selectedReport.post_content}
                    </Typography>
                    
                    {(selectedReport.post_is_hidden || selectedReport.comment_is_hidden) && (
                      <Alert severity="info" sx={{ mt: 2 }}>
                        이 {selectedReport.comment_id ? '댓글은' : '게시물은'} 현재 숨김 처리되어 있습니다.
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              <Divider sx={{ my: 3 }} />

              {/* 처리 옵션 */}
              <Box>
                <Typography variant="h6" gutterBottom>
                  처리 방법
                </Typography>
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel required>조치 선택</InputLabel>
                  <Select
                    value={processAction}
                    label="조치 선택"
                    onChange={(e) => setProcessAction(e.target.value)}
                    required
                  >
                    <MenuItem value="no_action">조치 없음</MenuItem>
                    {selectedReport.comment_id ? (
                      <>
                        <MenuItem value="hide_comment">댓글 숨김</MenuItem>
                        <MenuItem value="delete_comment">댓글 삭제</MenuItem>
                      </>
                    ) : (
                      <>
                        <MenuItem value="hide_post">게시물 숨김</MenuItem>
                        <MenuItem value="delete_post">게시물 삭제</MenuItem>
                      </>
                    )}
                    <MenuItem value="warn_user">사용자 경고</MenuItem>
                    <MenuItem value="suspend_user">사용자 정지 (7일)</MenuItem>
                  </Select>
                </FormControl>

                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="처리 메모"
                  placeholder="처리 사유나 추가 설명을 입력하세요..."
                  value={processNotes}
                  onChange={(e) => setProcessNotes(e.target.value)}
                  sx={{ mb: 2 }}
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={isFalseReport}
                      onChange={(e) => {
                        setIsFalseReport(e.target.checked);
                        if (!e.target.checked) {
                          setDisableReporterOnFalse(false);
                        }
                      }}
                    />
                  }
                  label="허위 신고로 판단"
                />

                {isFalseReport && (
                  <Box ml={4} mt={1}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={disableReporterOnFalse}
                          onChange={(e) => setDisableReporterOnFalse(e.target.checked)}
                          color="error"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" color="error">
                            신고자의 신고 기능 비활성화
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            해당 사용자는 더 이상 신고할 수 없게 됩니다
                          </Typography>
                        </Box>
                      }
                    />
                    {selectedReport?.reporter_can_report === false && (
                      <Alert severity="info" sx={{ mt: 1 }}>
                        이 신고자는 이미 신고 기능이 비활성화되어 있습니다.
                      </Alert>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowProcessModal(false)}>
            취소
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitProcess}
            disabled={!processAction || processReportMutation.isPending}
            startIcon={processReportMutation.isPending ? <CircularProgress size={16} /> : <CheckIcon />}
          >
            {processReportMutation.isPending ? '처리 중...' : '처리 완료'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 게시물 상세 모달 */}
      <PostDetailModal
        isOpen={showPostModal}
        onClose={() => {
          setShowPostModal(false);
          setSelectedPostId(null);
        }}
        postId={selectedPostId}
      />
    </div>
  );
};

export default AdminReports;