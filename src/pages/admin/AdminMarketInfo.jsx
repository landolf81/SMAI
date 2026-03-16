/**
 * AdminMarketInfo - 공판장 기본 정보 관리 페이지
 * 관리자가 공판장별 주소, 경매시간, 연락처, 수송팀(복수), 메모를 등록/수정
 * transport_teams: [{name, phone}, ...] JSON 배열로 여러 수송팀 지원
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StoreIcon from '@mui/icons-material/Store';
import { marketService } from '../../services';

const EMPTY_TEAM = { name: '', phone: '' };

const AdminMarketInfo = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [infoList, setInfoList] = useState([]);
  const [marketList, setMarketList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMarketName, setEditingMarketName] = useState(null);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    market_name: '',
    address: '',
    auction_hours: '',
    phone: '',
    transport_teams: [{ ...EMPTY_TEAM }],
    memo: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [infoData, settings, dbMarkets] = await Promise.all([
        marketService.getMarketInfo(),
        marketService.getMarketSettings(),
        marketService.getAllMarkets(),
      ]);
      setInfoList(infoData);
      const savedMarkets = settings?.market_order || [];
      const allMarkets = [...new Set([...savedMarkets, ...dbMarkets])];
      setMarketList(allMarkets);
    } catch (error) {
      console.error('공판장 정보 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      market_name: '',
      address: '',
      auction_hours: '',
      phone: '',
      transport_teams: [{ ...EMPTY_TEAM }],
      memo: '',
    });
    setEditingMarketName(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    const teams = Array.isArray(item.transport_teams) && item.transport_teams.length > 0
      ? item.transport_teams
      : [{ ...EMPTY_TEAM }];
    setFormData({
      market_name: item.market_name,
      address: item.address || '',
      auction_hours: item.auction_hours || '',
      phone: item.phone || '',
      transport_teams: teams.map(t => ({ ...t })),
      memo: item.memo || '',
    });
    setEditingMarketName(item.market_name);
    setShowForm(true);
    setTimeout(() => {
      document.getElementById('market-info-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // 수송팀 관리
  const addTeam = () => {
    setFormData(prev => ({
      ...prev,
      transport_teams: [...prev.transport_teams, { ...EMPTY_TEAM }],
    }));
  };

  const removeTeam = (idx) => {
    setFormData(prev => ({
      ...prev,
      transport_teams: prev.transport_teams.filter((_, i) => i !== idx),
    }));
  };

  const updateTeam = (idx, field, value) => {
    setFormData(prev => ({
      ...prev,
      transport_teams: prev.transport_teams.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }));
  };

  const handleSave = async () => {
    if (!formData.market_name) {
      alert('공판장명은 필수입니다.');
      return;
    }

    // 빈 수송팀 필터링
    const validTeams = formData.transport_teams.filter(t => t.name || t.phone);

    try {
      setSaving(true);
      await marketService.upsertMarketInfo({
        market_name: formData.market_name,
        address: formData.address || null,
        auction_hours: formData.auction_hours || null,
        phone: formData.phone || null,
        transport_teams: validTeams.length > 0 ? validTeams : [],
        memo: formData.memo || null,
      });
      resetForm();
      await loadData();
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* 헤더 */}
      <div className="bg-base-100 shadow-sm border-b border-base-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-base-content/60 hover:text-base-content transition-colors">
            <ArrowBackIcon />
          </button>
          <h1 className="text-lg font-bold text-base-content">공판장 정보 관리</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 추가 버튼 */}
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn btn-primary w-full gap-2"
        >
          <AddIcon fontSize="small" />
          공판장 정보 추가
        </button>

        {/* 추가/수정 폼 */}
        {showForm && (
          <div
            id="market-info-form"
            className="bg-base-100 rounded-2xl shadow-md border border-base-200 p-5 space-y-4"
          >
            <h3 className="font-bold text-base-content">
              {editingMarketName ? `${editingMarketName} 수정` : '새 공판장 정보 등록'}
            </h3>

            {/* 공판장 선택 */}
            <div>
              <label className="block text-sm font-medium text-base-content/70 mb-1">
                공판장명 <span className="text-error">*</span>
              </label>
              {editingMarketName ? (
                <div className="input input-bordered w-full bg-base-200 text-base-content/50 flex items-center text-sm">
                  {editingMarketName}
                </div>
              ) : (
                <select
                  value={formData.market_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, market_name: e.target.value }))}
                  className="select select-bordered w-full text-sm"
                >
                  <option value="">선택하세요</option>
                  {marketList.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              )}
            </div>

            {/* 경매시간 */}
            <div>
              <label className="block text-sm font-medium text-base-content/70 mb-1">경매시간</label>
              <input
                type="text"
                value={formData.auction_hours}
                onChange={(e) => setFormData(prev => ({ ...prev, auction_hours: e.target.value }))}
                placeholder="예: 오전 5시 ~ 오전 8시"
                className="input input-bordered w-full text-sm"
              />
            </div>

            {/* 주소 */}
            <div>
              <label className="block text-sm font-medium text-base-content/70 mb-1">주소</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="도로명 주소 입력"
                className="input input-bordered w-full text-sm"
              />
            </div>

            {/* 공판장 연락처 */}
            <div>
              <label className="block text-sm font-medium text-base-content/70 mb-1">공판장 연락처</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="예: 054-123-4567"
                className="input input-bordered w-full text-sm"
              />
            </div>

            {/* 수송팀 (복수) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-base-content/70">수송팀</label>
                <button onClick={addTeam} className="btn btn-ghost btn-xs gap-1 text-primary">
                  <AddIcon style={{ fontSize: 16 }} />
                  팀 추가
                </button>
              </div>
              <div className="space-y-2">
                {formData.transport_teams.map((team, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => updateTeam(idx, 'name', e.target.value)}
                      placeholder="팀명 (예: 김OO 수송팀)"
                      className="input input-bordered input-sm flex-1 text-sm"
                    />
                    <input
                      type="tel"
                      value={team.phone}
                      onChange={(e) => updateTeam(idx, 'phone', e.target.value)}
                      placeholder="연락처"
                      className="input input-bordered input-sm flex-1 text-sm"
                    />
                    {formData.transport_teams.length > 1 && (
                      <button
                        onClick={() => removeTeam(idx)}
                        className="btn btn-ghost btn-xs text-error"
                      >
                        <DeleteOutlineIcon style={{ fontSize: 18 }} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-sm font-medium text-base-content/70 mb-1">메모</label>
              <textarea
                value={formData.memo}
                onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
                placeholder="추가 정보나 안내사항 입력"
                rows={3}
                className="textarea textarea-bordered w-full text-sm resize-none"
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn btn-primary flex-1"
              >
                {saving ? '저장 중...' : (editingMarketName ? '수정' : '등록')}
              </button>
              <button onClick={resetForm} className="btn btn-ghost px-4">
                취소
              </button>
            </div>
          </div>
        )}

        {/* 등록된 공판장 정보 목록 */}
        {infoList.length === 0 ? (
          <div className="text-center py-12 text-base-content/40">
            <StoreIcon style={{ fontSize: 48 }} className="mb-2" />
            <p>등록된 공판장 정보가 없습니다</p>
            <p className="text-sm mt-1">위 버튼으로 추가해 주세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-base-content/50 font-medium">{infoList.length}개 공판장 등록됨</p>
            {infoList.map((item) => {
              const teams = Array.isArray(item.transport_teams) ? item.transport_teams : [];
              return (
                <div
                  key={item.market_name}
                  className="bg-base-100 rounded-2xl shadow-sm border border-base-200 overflow-hidden"
                >
                  {/* 공판장명 헤더 */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-base-200 bg-primary/5">
                    <div className="flex items-center gap-2">
                      <StoreIcon style={{ fontSize: 18 }} className="text-primary" />
                      <h3 className="font-bold text-base-content text-sm">{item.market_name}</h3>
                    </div>
                    <button onClick={() => handleEdit(item)} className="btn btn-ghost btn-xs gap-1">
                      <EditIcon style={{ fontSize: 16 }} />
                      수정
                    </button>
                  </div>

                  {/* 정보 목록 */}
                  <div className="px-4 py-3 space-y-2">
                    {item.auction_hours && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-base-content/40 w-24 flex-shrink-0">경매시간</span>
                        <span className="text-base-content">{item.auction_hours}</span>
                      </div>
                    )}
                    {item.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-base-content/40 w-24 flex-shrink-0">주소</span>
                        <span className="text-base-content">{item.address}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-base-content/40 w-24 flex-shrink-0">연락처</span>
                        <a href={`tel:${item.phone}`} className="text-primary underline underline-offset-2">
                          {item.phone}
                        </a>
                      </div>
                    )}
                    {teams.length > 0 && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-base-content/40 w-24 flex-shrink-0">수송팀</span>
                        <div className="space-y-1">
                          {teams.map((t, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-base-content">{t.name || `수송팀 ${i + 1}`}</span>
                              <a href={`tel:${t.phone}`} className="text-primary underline underline-offset-2">
                                {t.phone}
                              </a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.memo && (
                      <div className="flex items-start gap-2 text-sm">
                        <span className="text-base-content/40 w-24 flex-shrink-0">메모</span>
                        <span className="text-base-content/70 whitespace-pre-wrap">{item.memo}</span>
                      </div>
                    )}
                    {!item.auction_hours && !item.address && !item.phone && teams.length === 0 && !item.memo && (
                      <p className="text-sm text-base-content/30 italic">등록된 정보 없음</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMarketInfo;
