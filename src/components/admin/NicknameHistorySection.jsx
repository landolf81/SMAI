/**
 * NicknameHistorySection - 최근 별명 변경 내역 표시
 * AdminUsers 페이지 하단에 렌더링되는 관리자 전용 컴포넌트
 */
import { useState, useEffect } from 'react';
import HistoryIcon from '@mui/icons-material/History';
import { userService } from '../../services';
import { generateDiceBearAvatar, getProfilePic } from '../../utils/userHelper';

const NicknameHistorySection = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await userService.getNicknameHistory(20);
      setHistory(data);
    } catch {
      console.error('별명 변경 이력 조회 실패');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    if (days < 7) return `${days}일 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="mt-8 bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-base-300 bg-base-200/50">
        <div className="flex items-center gap-2">
          <HistoryIcon className="text-amber-600" fontSize="small" />
          <h3 className="text-sm font-semibold text-base-content">최근 별명 변경 내역</h3>
          {!loading && (
            <span className="text-xs text-base-content/50">({history.length}건)</span>
          )}
        </div>
        <button
          onClick={loadHistory}
          disabled={loading}
          className="text-xs text-primary hover:text-primary-focus font-medium"
        >
          새로고침
        </button>
      </div>

      {/* 로딩 */}
      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-base-300 border-t-base-content rounded-full animate-spin" />
        </div>
      )}

      {/* 빈 상태 */}
      {!loading && history.length === 0 && (
        <div className="text-center py-8 text-base-content/40 text-sm">
          변경 이력이 없습니다.
        </div>
      )}

      {/* 이력 목록 */}
      {!loading && history.length > 0 && (
        <div className="divide-y divide-base-200">
          {history.map((item) => {
            const user = item.users;
            return (
              <div key={item.id} className="flex items-center gap-3 px-6 py-3 hover:bg-base-200/30 transition-colors">
                {/* 프로필 사진 */}
                <div className="w-8 h-8 rounded-full overflow-hidden border border-base-300 flex-shrink-0">
                  <img
                    src={user ? getProfilePic(user) : generateDiceBearAvatar('unknown')}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = generateDiceBearAvatar(user?.id || 'unknown');
                    }}
                  />
                </div>

                {/* 변경 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-medium text-base-content truncate">
                      {user?.username || user?.name || '알 수 없음'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-base-content/60 mt-0.5">
                    <span className="line-through text-red-400 truncate max-w-[120px]">{item.old_name || '(없음)'}</span>
                    <span className="text-base-content/30">→</span>
                    <span className="text-emerald-600 font-medium truncate max-w-[120px]">{item.new_name}</span>
                  </div>
                </div>

                {/* 시간 */}
                <span className="text-[11px] text-base-content/40 flex-shrink-0">
                  {formatDate(item.changed_at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NicknameHistorySection;
