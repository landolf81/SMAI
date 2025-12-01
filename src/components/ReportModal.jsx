import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reportService } from '../services';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  TextField,
  Alert,
  CircularProgress,
  Typography,
  Box,
  Divider
} from '@mui/material';
import {
  Report as ReportIcon,
  Warning as WarningIcon,
  Close as CloseIcon
} from '@mui/icons-material';

const ReportModal = ({ open = false, onClose, postId, commentId, postAuthor, targetType = 'post', isOpen, onSubmit, targetId }) => {
  // 호환성을 위해 다양한 prop 이름 지원
  const isModalOpen = open || isOpen || false;
  const actualTargetId = postId || commentId || targetId;
  const actualTargetType = targetType;
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  // 신고 사유 카테고리 조회
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['reportCategories'],
    queryFn: () => reportService.getReportCategories(),
    enabled: isModalOpen,
    staleTime: 10 * 60 * 1000, // 10분간 캐시
  });

  // 신고 접수 뮤테이션
  const reportMutation = useMutation({
    mutationFn: (reportData) => reportService.createReport(reportData),
    onSuccess: () => {
      // 성공 토스트
      const successToast = document.createElement('div');
      successToast.className = 'toast toast-top toast-center';
      successToast.innerHTML = `
        <div class="alert alert-success">
          <span>✅ 신고가 접수되었습니다.</span>
        </div>
      `;
      document.body.appendChild(successToast);
      setTimeout(() => document.body.removeChild(successToast), 3000);

      // 모달 닫기 및 상태 초기화
      handleClose();
      
      // 게시물/댓글 목록 새로고침 (신고된 항목이 숨겨질 수 있음)
      if (actualTargetType === 'post') {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
        queryClient.invalidateQueries({ queryKey: ['enhanced-instagram-posts'] });
      } else if (actualTargetType === 'comment') {
        queryClient.invalidateQueries({ queryKey: ['comments'] });
      }
    },
    onError: (error) => {
      console.error('신고 접수 실패:', error);

      let errorMessage = '신고 접수 중 오류가 발생했습니다.';

      if (error.message?.includes('이미')) {
        errorMessage = actualTargetType === 'comment' ? '이미 신고한 댓글입니다.' : '이미 신고한 게시물입니다.';
      } else if (error.message?.includes('제한')) {
        errorMessage = '일일 신고 횟수 제한에 도달했습니다. (10회)';
      } else if (error.message?.includes('찾을 수 없습니다')) {
        errorMessage = actualTargetType === 'comment' ? '해당 댓글을 찾을 수 없습니다.' : '해당 게시물을 찾을 수 없습니다.';
      } else if (error.message?.includes('인증')) {
        errorMessage = '로그인이 필요합니다.';
      } else if (error.message?.includes('권한')) {
        errorMessage = '권한이 없습니다.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      console.log('Setting error message:', errorMessage);
      setError(errorMessage);

      // 에러 토스트도 표시
      const errorToast = document.createElement('div');
      errorToast.innerHTML = `
        <div style="
          position: fixed; 
          top: 20px; 
          right: 20px; 
          background: #f44336; 
          color: white; 
          padding: 16px 24px; 
          border-radius: 8px; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
          z-index: 10000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 400px;
        ">
          <strong>신고 실패</strong><br/>
          ${errorMessage}
        </div>
      `;
      document.body.appendChild(errorToast);
      setTimeout(() => {
        if (document.body.contains(errorToast)) {
          document.body.removeChild(errorToast);
        }
      }, 5000);
    },
  });

  const handleClose = () => {
    setSelectedCategory('');
    setCustomReason('');
    setError('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('ReportModal: handleSubmit called');
    setError('');

    if (!selectedCategory) {
      setError('신고 사유를 선택해주세요.');
      return;
    }

    // '기타' 선택 시 상세 사유 입력 필수
    const isOtherCategory = categories.find(cat => cat.id == selectedCategory)?.name === '기타';
    if (isOtherCategory && !customReason.trim()) {
      setError('기타 사유를 선택하신 경우 상세 내용을 입력해주세요.');
      return;
    }

    // onSubmit prop이 전달된 경우 해당 함수 호출
    if (onSubmit) {
      onSubmit(parseInt(selectedCategory), customReason.trim() || null);
      return;
    }

    // 기본 동작: API 직접 호출
    // 선택된 카테고리의 이름 가져오기
    const selectedCategoryData = categories.find(cat => cat.id == selectedCategory);
    const categoryName = selectedCategoryData?.name || '기타';

    const reportData = {
      categoryId: parseInt(selectedCategory),
      category: categoryName, // 카테고리 이름 추가
      reason: customReason.trim() || null,
      description: customReason.trim() || null // description 필드도 추가
    };

    // 대상에 따라 postId 또는 commentId 추가
    if (actualTargetType === 'post') {
      reportData.postId = actualTargetId;
    } else if (actualTargetType === 'comment') {
      reportData.commentId = actualTargetId;
    }

    console.log('ReportModal: Submitting report data:', reportData);
    reportMutation.mutate(reportData);
  };

  if (categoriesLoading) {
    return (
      <Dialog open={isModalOpen} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" py={4}>
            <CircularProgress />
            <Typography ml={2}>신고 사유를 불러오는 중...</Typography>
          </Box>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isModalOpen} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <ReportIcon color="error" />
          <Typography variant="h6" component="span">
            {actualTargetType === 'comment' ? '댓글 신고' : '게시물 신고'}
          </Typography>
          <Button
            onClick={handleClose}
            sx={{ ml: 'auto', minWidth: 'auto', p: 0.5 }}
          >
            <CloseIcon />
          </Button>
        </Box>
      </DialogTitle>

      <Divider />

      <form onSubmit={handleSubmit}>
        <DialogContent>
          {/* 경고 메시지 */}
          <Alert severity="warning" sx={{ mb: 3 }}>
            <Box>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                신고 전 확인사항
              </Typography>
              <Typography variant="body2" component="div">
                • 허위 신고 시 신고 기능 사용이 제한될 수 있습니다<br />
                • 신고는 하루 최대 10회까지 가능합니다<br />
                • 관리자 검토 후 적절한 조치가 취해집니다
              </Typography>
            </Box>
          </Alert>

          {/* 신고 대상 정보 */}
          <Box mb={3} p={2} bgcolor="grey.50" borderRadius={1}>
            <Typography variant="body2" color="text.secondary">
              신고 대상: <strong>{postAuthor}</strong>님의 게시물
            </Typography>
          </Box>

          {/* 에러 메시지 */}
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              icon={<WarningIcon />}
            >
              <Typography variant="body2" fontWeight="medium">
                {error}
              </Typography>
            </Alert>
          )}

          {/* 디버깅: 현재 에러 상태 */}
          {process.env.NODE_ENV === 'development' && error && (
            <Box mb={2} p={1} bgcolor="red.50" borderRadius={1}>
              <Typography variant="caption" color="error.main">
                Debug: Error = "{error}"
              </Typography>
            </Box>
          )}

          {/* 신고 사유 선택 */}
          <FormControl component="fieldset" fullWidth>
            <FormLabel component="legend" sx={{ mb: 2, fontWeight: 'bold' }}>
              신고 사유를 선택해주세요 *
            </FormLabel>
            <RadioGroup
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((category) => (
                <FormControlLabel
                  key={category.id}
                  value={category.id.toString()}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight="medium">
                        {category.name}
                      </Typography>
                      {category.description && (
                        <Typography variant="body2" color="text.secondary">
                          {category.description}
                        </Typography>
                      )}
                    </Box>
                  }
                  sx={{ mb: 1, alignItems: 'flex-start' }}
                />
              ))}
            </RadioGroup>
          </FormControl>

          {/* 상세 사유 입력 (기타 선택 시 또는 추가 설명) */}
          {(selectedCategory && categories.find(cat => cat.id == selectedCategory)?.name === '기타') && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="상세 사유 *"
              placeholder="구체적인 신고 사유를 입력해주세요..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              sx={{ mt: 2 }}
              required
            />
          )}

          {(selectedCategory && categories.find(cat => cat.id == selectedCategory)?.name !== '기타') && (
            <TextField
              fullWidth
              multiline
              rows={2}
              label="추가 설명 (선택사항)"
              placeholder="추가적인 설명이 있다면 입력해주세요..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              sx={{ mt: 2 }}
            />
          )}
        </DialogContent>

        <Divider />

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={handleClose} disabled={reportMutation.isPending}>
            취소
          </Button>
          <Button
            type="submit"
            variant="contained"
            color="error"
            disabled={reportMutation.isPending || !selectedCategory}
            startIcon={reportMutation.isPending ? <CircularProgress size={16} /> : <ReportIcon />}
          >
            {reportMutation.isPending ? '신고 중...' : '신고하기'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ReportModal;