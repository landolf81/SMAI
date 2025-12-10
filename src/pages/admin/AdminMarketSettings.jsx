import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketService } from '../../services';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';

const AdminMarketSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // DB에서 가져온 공판장별 등급 정보 (원본)
  const [marketGrades, setMarketGrades] = useState({});

  // 공판장 목록 (DB 기준)
  const [marketList, setMarketList] = useState([]);

  // 선택된 공판장
  const [selectedMarket, setSelectedMarket] = useState(null);

  // 정렬 순서 설정 (DB에 저장될 값)
  const [marketOrder, setMarketOrder] = useState([]); // 공판장 순서
  const [gradeOrders, setGradeOrders] = useState({}); // 공판장별 등급 순서

  // 드래그 상태
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedType, setDraggedType] = useState(null);

  // 초기 로드
  useEffect(() => {
    loadData();
  }, []);

  // 데이터 로드 (설정이 있으면 설정에서, 없으면 DB에서)
  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);

      // 1. 먼저 저장된 설정 조회
      const savedSettings = await marketService.getMarketSettings();

      // 설정이 있고 강제 새로고침이 아니면 설정에서 로드
      if (savedSettings?.market_grades && !forceRefresh) {
        const grades = savedSettings.market_grades;
        setMarketGrades(grades);
        setMarketList(Object.keys(grades).sort());
        setMarketOrder(savedSettings.market_order || Object.keys(grades).sort());
        setGradeOrders(savedSettings.grade_orders || {});
      } else {
        // 설정이 없거나 강제 새로고침이면 DB에서 전체 조회
        const grades = await marketService.getAllMarketGrades();
        setMarketGrades(grades);

        const dbMarkets = Object.keys(grades).sort();
        setMarketList(dbMarkets);

        if (savedSettings) {
          // 저장된 순서가 있으면 사용 (DB에 있는 공판장만 필터링)
          const validMarketOrder = (savedSettings.market_order || []).filter(m => dbMarkets.includes(m));
          const newMarkets = dbMarkets.filter(m => !validMarketOrder.includes(m));
          setMarketOrder([...validMarketOrder, ...newMarkets]);
          setGradeOrders(savedSettings.grade_orders || {});
        } else {
          setMarketOrder(dbMarkets);
          setGradeOrders({});
        }
      }

    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // DB에서 강제로 새로고침
  const handleRefresh = () => {
    loadData(true);
  };

  // 공판장 선택
  const handleMarketSelect = (marketName) => {
    setSelectedMarket(marketName);
  };

  // 현재 선택된 공판장의 등급 순서 가져오기
  const getCurrentGradeOrder = () => {
    if (!selectedMarket) return [];

    // 저장된 순서가 있으면 사용
    if (gradeOrders[selectedMarket] && gradeOrders[selectedMarket].length > 0) {
      // 저장된 순서에 있는 등급만 필터링 + 새로 추가된 등급은 뒤에
      const dbGrades = marketGrades[selectedMarket] || [];
      const savedOrder = gradeOrders[selectedMarket].filter(g => dbGrades.includes(g));
      const newGrades = dbGrades.filter(g => !savedOrder.includes(g));
      return [...savedOrder, ...newGrades];
    }

    // 없으면 DB에서 가져온 원본 순서 사용
    return marketGrades[selectedMarket] || [];
  };

  // 등급 순서 업데이트
  const updateGradeOrder = (newOrder) => {
    if (!selectedMarket) return;
    setGradeOrders(prev => ({
      ...prev,
      [selectedMarket]: newOrder
    }));
  };

  // 설정 저장 (DB에 저장 - 공판장/등급 목록도 함께 저장)
  const saveSettings = async () => {
    try {
      setSaving(true);

      await marketService.saveMarketSettings({
        market_order: marketOrder,
        grade_orders: gradeOrders,
        market_grades: marketGrades  // 공판장/등급 목록도 저장 (다음 로드 시 DB 조회 생략)
      });

      setSuccessMessage('설정이 저장되었습니다.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('설정 저장 오류:', error);
      alert('설정 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 드래그 시작
  const handleDragStart = (e, index, type) => {
    setDraggedItem(index);
    setDraggedType(type);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 드래그 오버
  const handleDragOver = (e, index, type) => {
    e.preventDefault();
    if (draggedType !== type) return;

    if (type === 'market') {
      const items = [...marketOrder];
      const draggedItemContent = items[draggedItem];
      items.splice(draggedItem, 1);
      items.splice(index, 0, draggedItemContent);
      setMarketOrder(items);
      setDraggedItem(index);
    } else if (type === 'grade') {
      const items = [...getCurrentGradeOrder()];
      const draggedItemContent = items[draggedItem];
      items.splice(draggedItem, 1);
      items.splice(index, 0, draggedItemContent);
      updateGradeOrder(items);
      setDraggedItem(index);
    }
  };

  // 드래그 종료
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedType(null);
  };

  // 위로 이동
  const moveUp = (index, type) => {
    if (index === 0) return;
    if (type === 'market') {
      const items = [...marketOrder];
      [items[index - 1], items[index]] = [items[index], items[index - 1]];
      setMarketOrder(items);
    } else if (type === 'grade') {
      const items = [...getCurrentGradeOrder()];
      [items[index - 1], items[index]] = [items[index], items[index - 1]];
      updateGradeOrder(items);
    }
  };

  // 아래로 이동
  const moveDown = (index, type) => {
    if (type === 'market') {
      const items = [...marketOrder];
      if (index === items.length - 1) return;
      [items[index], items[index + 1]] = [items[index + 1], items[index]];
      setMarketOrder(items);
    } else if (type === 'grade') {
      const items = [...getCurrentGradeOrder()];
      if (index === items.length - 1) return;
      [items[index], items[index + 1]] = [items[index + 1], items[index]];
      updateGradeOrder(items);
    }
  };

  const currentGradeOrder = getCurrentGradeOrder();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg text-blue-600"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin')}
          className="btn btn-ghost btn-circle"
        >
          <ArrowBackIcon />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-blue-600">시장정보 설정</h1>
          <p className="text-gray-500 text-sm">공판장 및 등급 정렬 순서를 설정합니다 (모든 사용자에게 적용)</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="btn btn-ghost btn-sm gap-1 text-blue-600"
          title="DB에서 새로고침"
        >
          <RefreshIcon className={loading ? 'animate-spin' : ''} fontSize="small" />
        </button>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn btn-outline btn-sm gap-1 text-blue-600 border-blue-600 hover:bg-blue-600 hover:text-white"
        >
          {saving ? (
            <span className="loading loading-spinner loading-xs"></span>
          ) : (
            <SaveIcon fontSize="small" />
          )}
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>

      {/* 성공 메시지 */}
      {successMessage && (
        <div className="alert alert-info mb-4 bg-blue-50 border-blue-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-blue-600 shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-blue-700">{successMessage}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* 공판장 정렬 순서 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-lg text-blue-600 mb-2">공판장 목록</h2>
            <p className="text-sm text-gray-500 mb-2">
              공판장을 클릭하면 오른쪽에 등급 목록이 표시됩니다
            </p>

            {marketOrder.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>등록된 공판장이 없습니다</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                {marketOrder.map((market, index) => (
                  <li
                    key={market}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index, 'market')}
                    onDragOver={(e) => handleDragOver(e, index, 'market')}
                    onDragEnd={handleDragEnd}
                    onClick={() => handleMarketSelect(market)}
                    className={`flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                      draggedItem === index && draggedType === 'market' ? 'opacity-50' : ''
                    } ${
                      selectedMarket === market
                        ? 'bg-blue-100 border-2 border-blue-400'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <DragIndicatorIcon className="text-gray-400 cursor-move" />
                    <span className={`flex-1 font-medium ${selectedMarket === market ? 'text-blue-700' : 'text-gray-700'}`}>
                      {market}
                    </span>
                    <span className="text-gray-400 text-sm mr-2">#{index + 1}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); moveUp(index, 'market'); }}
                        disabled={index === 0}
                        className="btn btn-ghost btn-xs"
                      >
                        ▲
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); moveDown(index, 'market'); }}
                        disabled={index === marketOrder.length - 1}
                        className="btn btn-ghost btn-xs"
                      >
                        ▼
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 등급 정렬 순서 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-lg text-blue-600 mb-2">
              {selectedMarket ? `${selectedMarket} 등급` : '등급 목록'}
            </h2>

            {!selectedMarket ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg mb-2">공판장을 선택하세요</p>
                <p className="text-sm">왼쪽 목록에서 공판장을 클릭하면<br/>해당 공판장의 등급 목록이 표시됩니다</p>
              </div>
            ) : currentGradeOrder.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-lg">등급 정보가 없습니다</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  드래그하거나 화살표로 정렬 순서를 변경하세요
                </p>
                <ul className="space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
                  {currentGradeOrder.map((grade, index) => (
                    <li
                      key={grade}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index, 'grade')}
                      onDragOver={(e) => handleDragOver(e, index, 'grade')}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 transition-colors ${
                        draggedItem === index && draggedType === 'grade' ? 'opacity-50' : ''
                      }`}
                    >
                      <DragIndicatorIcon className="text-gray-400" />
                      <span className="flex-1 font-medium text-gray-700">{grade}</span>
                      <span className="text-gray-400 text-sm mr-2">#{index + 1}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => moveUp(index, 'grade')}
                          disabled={index === 0}
                          className="btn btn-ghost btn-xs"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveDown(index, 'grade')}
                          disabled={index === currentGradeOrder.length - 1}
                          className="btn btn-ghost btn-xs"
                        >
                          ▼
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMarketSettings;
