import React, { useEffect, useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import CampaignIcon from '@mui/icons-material/Campaign';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { AdminOnly } from '../../components/PermissionComponents';
import { bannerAdService, BANNER_SLOT_LABELS } from '../../services/bannerAdService';
import BannerAdForm from '../../components/admin/BannerAdForm';
import BannerAdStatsRow from '../../components/admin/BannerAdStatsRow';

/**
 * AdminBannerAds - 배너 광고 관리 페이지
 * 경로: /admin/banner-ads
 *
 * 기능:
 *  - 목록 (slot 필터, 활성 토글)
 *  - 생성/수정 (폼 + 미리보기)
 *  - 삭제
 *  - 광고별 노출/클릭/CTR (날짜 필터)
 */
const AdminBannerAds = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | create | edit
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [slotFilter, setSlotFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // all | active | inactive | expired

  // 통계 날짜 필터
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadAds = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bannerAdService.listAll(slotFilter ? { slot: slotFilter } : {});
      setAds(data);
    } catch (err) {
      console.error(err);
      toast.error('목록 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [slotFilter]);

  useEffect(() => { loadAds(); }, [loadAds]);

  const { filteredAds, statusCounts } = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const counts = { all: ads.length, active: 0, inactive: 0, expired: 0 };
    const categorized = ads.map((ad) => {
      const expired = !!ad.end_date && ad.end_date < today;
      let status;
      if (!ad.is_active) status = 'inactive';
      else if (expired) status = 'expired';
      else status = 'active';
      counts[status] += 1;
      return { ad, status };
    });
    const filtered = activeFilter === 'all'
      ? ads
      : categorized.filter((x) => x.status === activeFilter).map((x) => x.ad);
    return { filteredAds: filtered, statusCounts: counts };
  }, [ads, activeFilter]);

  const handleCreate = async (form) => {
    try {
      setSaving(true);
      await bannerAdService.create(form);
      toast.success('배너 광고가 생성되었습니다.');
      setView('list');
      setEditing(null);
      loadAds();
    } catch (err) {
      console.error(err);
      toast.error(err.message || '생성에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form) => {
    if (!editing) return;
    try {
      setSaving(true);
      await bannerAdService.update(editing.id, form);
      toast.success('배너 광고가 수정되었습니다.');
      setView('list');
      setEditing(null);
      loadAds();
    } catch (err) {
      console.error(err);
      toast.error(err.message || '수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ad) => {
    try {
      await bannerAdService.toggleActive(ad.id);
      toast.success(`광고를 ${ad.is_active ? '비활성화' : '활성화'}했습니다.`);
      loadAds();
    } catch (err) {
      console.error(err);
      toast.error('상태 변경에 실패했습니다.');
    }
  };

  const handleDelete = async (ad) => {
    if (!window.confirm(`"${ad.name}" 광고를 삭제하시겠습니까?`)) return;
    try {
      await bannerAdService.remove(ad.id);
      toast.success('삭제되었습니다.');
      loadAds();
    } catch (err) {
      console.error(err);
      toast.error('삭제에 실패했습니다.');
    }
  };

  return (
    <AdminOnly>
      <div className="min-h-screen bg-base-200 pt-16 pb-24">
        <div className="max-w-screen-xl mx-auto px-4">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CampaignIcon className="text-[#004225]" />
              <h1 className="text-xl font-bold">배너 광고 관리</h1>
            </div>
            {view === 'list' && (
              <button
                onClick={() => { setEditing(null); setView('create'); }}
                className="btn btn-primary btn-sm"
              >
                <AddIcon fontSize="small" /> 새 광고
              </button>
            )}
            {view !== 'list' && (
              <button
                onClick={() => { setView('list'); setEditing(null); }}
                className="btn btn-ghost btn-sm"
              >
                목록으로
              </button>
            )}
          </div>

          {view === 'list' && (
            <div className="space-y-4">
              {/* 필터 */}
              <div className="bg-base-100 rounded-xl p-4 border border-base-300 flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">slot 필터</label>
                  <select
                    value={slotFilter}
                    onChange={(e) => setSlotFilter(e.target.value)}
                    className="select select-bordered select-sm"
                  >
                    <option value="">전체</option>
                    {Object.entries(BANNER_SLOT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">상태 필터</label>
                  <select
                    value={activeFilter}
                    onChange={(e) => setActiveFilter(e.target.value)}
                    className="select select-bordered select-sm"
                  >
                    <option value="all">전체 ({statusCounts.all})</option>
                    <option value="active">활성 ({statusCounts.active})</option>
                    <option value="inactive">비활성 ({statusCounts.inactive})</option>
                    <option value="expired">기간 종료 ({statusCounts.expired})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">통계 시작일</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input input-bordered input-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-base-content/60 mb-1">통계 종료일</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input input-bordered input-sm"
                  />
                </div>
                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="btn btn-ghost btn-sm"
                  >
                    날짜 초기화
                  </button>
                )}
              </div>

              {/* 목록 */}
              {loading ? (
                <div className="text-center py-12 text-base-content/60">불러오는 중…</div>
              ) : ads.length === 0 ? (
                <div className="text-center py-12 text-base-content/60">
                  등록된 배너 광고가 없습니다. 우측 상단 "새 광고"를 눌러 추가하세요.
                </div>
              ) : filteredAds.length === 0 ? (
                <div className="text-center py-12 text-base-content/60">
                  조건에 맞는 광고가 없습니다.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredAds.map((ad) => (
                    <AdCard
                      key={ad.id}
                      ad={ad}
                      startDate={startDate}
                      endDate={endDate}
                      onEdit={() => { setEditing(ad); setView('edit'); }}
                      onToggle={() => handleToggle(ad)}
                      onDelete={() => handleDelete(ad)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {(view === 'create' || view === 'edit') && (
            <div className="bg-base-100 rounded-xl p-4 border border-base-300">
              <h2 className="text-lg font-semibold mb-4">
                {view === 'create' ? '새 배너 광고' : `광고 수정: ${editing?.name || ''}`}
              </h2>
              <BannerAdForm
                initial={editing || undefined}
                saving={saving}
                onSubmit={view === 'create' ? handleCreate : handleUpdate}
                onCancel={() => { setView('list'); setEditing(null); }}
              />
            </div>
          )}
        </div>
      </div>
    </AdminOnly>
  );
};

const AdCard = ({ ad, startDate, endDate, onEdit, onToggle, onDelete }) => {
  const isExpired = ad.end_date && new Date(ad.end_date) < new Date(new Date().toISOString().split('T')[0]);
  return (
    <div className={`bg-base-100 rounded-xl border ${ad.is_active && !isExpired ? 'border-base-300' : 'border-base-300 opacity-70'} overflow-hidden`}>
      <div className="relative bg-base-200" style={{ aspectRatio: '8/3' }}>
        {ad.image_url ? (
          <img src={ad.image_url} alt={ad.alt_text || ad.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-base-content/40 text-sm">이미지 없음</div>
        )}
        <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
          {BANNER_SLOT_LABELS[ad.slot] || ad.slot}
        </span>
        {!ad.is_active && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded">비활성</span>
        )}
        {isExpired && ad.is_active && (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded">기간 종료</span>
        )}
      </div>

      <div className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{ad.name}</h3>
            <p className="text-xs text-base-content/60 truncate">
              {ad.advertiser_name || '광고주 미입력'} · 우선순위 {ad.priority || 0}
            </p>
          </div>
        </div>

        <div className="text-xs text-base-content/60">
          기간: {ad.start_date || '제한없음'} ~ {ad.end_date || '제한없음'}
        </div>

        {(ad.landing_slug || ad.external_url) && (
          <div className="text-xs text-base-content/60 truncate">
            링크: {ad.external_url || `/sponsor/${ad.landing_slug}`}
          </div>
        )}

        <div className="pt-2 border-t border-base-200">
          <BannerAdStatsRow adId={ad.id} startDate={startDate} endDate={endDate} />
        </div>

        <div className="flex gap-1 pt-2">
          <button onClick={onEdit} className="btn btn-xs btn-ghost flex-1">
            <EditIcon style={{ fontSize: 14 }} /> 수정
          </button>
          <button onClick={onToggle} className="btn btn-xs btn-ghost flex-1">
            {ad.is_active ? <><VisibilityOffIcon style={{ fontSize: 14 }} /> 숨김</> : <><VisibilityIcon style={{ fontSize: 14 }} /> 노출</>}
          </button>
          <button onClick={onDelete} className="btn btn-xs btn-ghost text-red-500 flex-1">
            <DeleteIcon style={{ fontSize: 14 }} /> 삭제
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminBannerAds;
