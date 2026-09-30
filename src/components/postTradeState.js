// 게시물 거래 상태 mutation과 미노출 전환 액션을 보존한다. 메뉴 활성화는 하지 않는다.
import { useMutation } from '@tanstack/react-query';
import { postService } from '../services';

export function usePostTradeState({ post, currentUser, featurePermissions, queryClient }) {
  const canManageTrade = currentUser && (post.userId === currentUser.id || featurePermissions.canDeleteAnyPost);
  const tradeStatusMutation = useMutation({
    mutationFn: ({ postId, status }) =>
      postService.updateTradeStatus(postId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["enhanced-instagram-posts"] });

      const successToast = document.createElement('div');
      successToast.className = 'toast toast-top toast-center z-50';
      successToast.innerHTML = `
        <div class="alert alert-success">
          <span>✅ 거래 상태가 업데이트되었습니다.</span>
        </div>
      `;
      document.body.appendChild(successToast);
      setTimeout(() => document.body.removeChild(successToast), 3000);
    },
    onError: (error) => {
      console.error('❌ 거래 상태 업데이트 실패:', error);

      const errorToast = document.createElement('div');
      errorToast.className = 'toast toast-top toast-center z-50';
      errorToast.innerHTML = `
        <div class="alert alert-error">
          <span>❌ 거래 상태 업데이트에 실패했습니다.</span>
        </div>
      `;
      document.body.appendChild(errorToast);
      setTimeout(() => document.body.removeChild(errorToast), 5000);
    }
  });

  const handleTradeStatusToggle = () => {
    if (!post.tradeInfo || !canManageTrade) return;
    const newStatus = post.tradeInfo.status === 'completed' ? 'available' : 'completed';
    tradeStatusMutation.mutate({ postId: post.id, status: newStatus });
  };
  return { canManageTrade, tradeStatusMutation, handleTradeStatusToggle };
}
