/**
 * AdminAuctionTimes - 공판장 경매시간 관리 페이지
 * 관리자가 공판장별 기간별 경매시간을 등록/수정/삭제할 수 있음
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { marketService } from '../../services';

const AdminAuctionTimes = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [auctionTimes, setAuctionTimes] = useState([]);
  const [marketList, setMarketList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  // 폼 상태
  const [formData, setFormData] = useState({
    market_name: '',
    auction_time: '',
    effective_from: '',
    effective_to: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [times, settings, dbMarkets] = await Promise.all([
        marketService.getAuctionTimes(),
        marketService.getMarketSettings(),
        marketService.getAllMarkets(),
      ]);
      setAuctionTimes(times);

      // 설정에 저장된 market_order + DB market_data 합쳐서 전체 목록 구성
      const savedMarkets = settings?.market_order || [];
      const allMarkets = [...new Set([...savedMarkets, ...dbMarkets])];
      setMarketList(allMarkets);
    } catch (error) {
      console.error('경매시간 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ market_name: '', auction_time: '', effective_from: '', effective_to: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (item) => {
    setFormData({
      market_name: item.market_name,
      auction_time: item.auction_time,
      effective_from: item.effective_from,
      effective_to: item.effective_to || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.market_name || !formData.auction_time || !formData.effective_from) {
      alert('공판장, 경매시간, 적용 시작일은 필수입니다.');
      return;
    }

    try {
      setSaving(true);
      await marketService.upsertAuctionTime({
        id: editingId,
        ...formData,
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

  const handleDelete = async (id) => {
    if (!confirm('이 경매시간을 삭제하시겠습니까?')) return;

    try {
      await marketService.deleteAuctionTime(id);
      await loadData();
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  // 공판장별로 그룹화
  const groupedTimes = auctionTimes.reduce((acc, item) => {
    if (!acc[item.market_name]) acc[item.market_name] = [];
    acc[item.market_name].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-600 dark:text-gray-300">
            <ArrowBackIcon />
          </button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">경매시간 관리</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 추가 버튼 */}
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          <AddIcon fontSize="small" />
          경매시간 추가
        </button>

        {/* 추가/수정 폼 */}
        {showForm && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-5 space-y-4">
            <h3 className="font-bold text-gray-800 dark:text-gray-100">
              {editingId ? '경매시간 수정' : '새 경매시간 등록'}
            </h3>

            {/* 공판장 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">공판장</label>
              <select
                value={formData.market_name}
                onChange={(e) => setFormData(prev => ({ ...prev, market_name: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">선택하세요</option>
                {marketList.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* 경매시간 (24시간 텍스트 입력) */}
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">경매시간</label>
              <input
                type="text"
                value={formData.auction_time}
                onChange={(e) => setFormData(prev => ({ ...prev, auction_time: e.target.value }))}
                placeholder="예: 13:00"
                className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* 적용 기간 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">적용 시작일</label>
                <input
                  type="date"
                  value={formData.effective_from}
                  onChange={(e) => setFormData(prev => ({ ...prev, effective_from: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1">적용 종료일</label>
                <input
                  type="date"
                  value={formData.effective_to}
                  onChange={(e) => setFormData(prev => ({ ...prev, effective_to: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm"
                  placeholder="비워두면 계속 적용"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">비워두면 계속 적용</p>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors"
              >
                {saving ? '저장 중...' : (editingId ? '수정' : '등록')}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 등록된 경매시간 목록 (공판장별 그룹) */}
        {Object.keys(groupedTimes).length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <AccessTimeIcon style={{ fontSize: 48 }} className="mb-2" />
            <p>등록된 경매시간이 없습니다</p>
          </div>
        ) : (
          Object.entries(groupedTimes).map(([marketName, times]) => (
            <div key={marketName} className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 overflow-hidden">
              {/* 공판장명 헤더 */}
              <div className="bg-blue-50 dark:bg-blue-950/40 px-4 py-3 border-b border-blue-100 dark:border-blue-900/50">
                <h3 className="font-bold text-blue-800 dark:text-blue-300 text-sm">{marketName}</h3>
              </div>

              {/* 시간 목록 */}
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {times.map((item) => {
                  const today = new Date().toISOString().split('T')[0];
                  const isActive = item.effective_from <= today && (!item.effective_to || item.effective_to >= today);

                  return (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`px-2.5 py-1 rounded-full text-sm font-bold ${
                          isActive
                            ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}>
                          {item.auction_time}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {item.effective_from} ~ {item.effective_to || '계속'}
                        </div>
                        {isActive && (
                          <span className="text-xs bg-green-500 text-white px-1.5 py-0.5 rounded-full">현재</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        >
                          <EditIcon fontSize="small" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        >
                          <DeleteIcon fontSize="small" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminAuctionTimes;
