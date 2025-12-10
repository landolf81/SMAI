import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketService } from '../../services';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
const AdminMarketSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marketOrder, setMarketOrder] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedType, setDraggedType] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // 공판장별 등급 정보
  const [marketGrades, setMarketGrades] = useState({});
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [loadingGrades, setLoadingGrades] = useState(false);

  // 선택된 공판장의 등급 순서 (공판장별로 저장)
  const [marketGradeOrders, setMarketGradeOrders] = useState({});

  // 신규 추가용
  const [newMarketName, setNewMarketName] = useState('');
  const [newGradeName, setNewGradeName] = useState('');
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [showAddGrade, setShowAddGrade] = useState(false);

  // 설정 불러오기
  useEffect(() => {
    loadSettings();
    loadAllMarketGrades();
  }, []);

  // 모든 공판장의 등급 목록 불러오기
  const loadAllMarketGrades = async () => {
    try {
      setLoadingGrades(true);
      const grades = await marketService.getAllMarketGrades();
      setMarketGrades(grades);

      // 저장된 공판장별 등급 순서 불러오기
      const savedGradeOrders = localStorage.getItem('market_grade_orders');
      if (savedGradeOrders) {
        setMarketGradeOrders(JSON.parse(savedGradeOrders));
      }
    } catch (error) {
      console.error('등급 목록 조회 오류:', error);
    } finally {
      setLoadingGrades(false);
    }
  };

  // 공판장 선택
  const handleMarketSelect = (marketName) => {
    setSelectedMarket(marketName);
    setShowAddGrade(false);
  };

  // 현재 선택된 공판장의 등급 순서 가져오기
  const getCurrentGradeOrder = () => {
    if (!selectedMarket) return [];

    // 저장된 순서가 있으면 사용
    if (marketGradeOrders[selectedMarket]) {
      return marketGradeOrders[selectedMarket];
    }

    // 없으면 DB에서 가져온 원본 순서 사용
    return marketGrades[selectedMarket] || [];
  };

  // 등급 순서 업데이트
  const updateGradeOrder = (newOrder) => {
    if (!selectedMarket) return;
    setMarketGradeOrders(prev => ({
      ...prev,
      [selectedMarket]: newOrder
    }));
  };

  const loadSettings = async () => {
    try {
      setLoading(true);

      // localStorage에서 설정 불러오기
      const savedMarketOrder = localStorage.getItem('market_order');

      if (savedMarketOrder) {
        setMarketOrder(JSON.parse(savedMarketOrder));
      } else {
        // 저장된 순서가 없으면 빈 배열 (수기 등록)
        setMarketOrder([]);
      }
    } catch (error) {
      console.error('설정 불러오기 오류:', error);
      setMarketOrder([]);
    } finally {
      setLoading(false);
    }
  };

  // 설정 저장
  const saveSettings = async () => {
    try {
      setSaving(true);

      // localStorage에 저장
      localStorage.setItem('market_order', JSON.stringify(marketOrder));
      localStorage.setItem('market_grade_orders', JSON.stringify(marketGradeOrders));

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

  // 공판장 추가
  const addMarket = () => {
    if (!newMarketName.trim()) return;
    if (marketOrder.includes(newMarketName.trim())) {
      alert('이미 존재하는 공판장입니다.');
      return;
    }
    setMarketOrder([...marketOrder, newMarketName.trim()]);
    setNewMarketName('');
    setShowAddMarket(false);
  };

  // 공판장 삭제
  const deleteMarket = (marketName) => {
    if (!confirm(`"${marketName}" 공판장을 삭제하시겠습니까?`)) return;
    setMarketOrder(marketOrder.filter(m => m !== marketName));
    if (selectedMarket === marketName) {
      setSelectedMarket(null);
    }
    // 해당 공판장의 등급 순서도 삭제
    const newGradeOrders = { ...marketGradeOrders };
    delete newGradeOrders[marketName];
    setMarketGradeOrders(newGradeOrders);
  };

  // 등급 추가
  const addGrade = () => {
    if (!newGradeName.trim() || !selectedMarket) return;
    const currentGrades = getCurrentGradeOrder();
    if (currentGrades.includes(newGradeName.trim())) {
      alert('이미 존재하는 등급입니다.');
      return;
    }
    updateGradeOrder([...currentGrades, newGradeName.trim()]);
    setNewGradeName('');
    setShowAddGrade(false);
  };

  // 등급 삭제
  const deleteGrade = (gradeName) => {
    if (!confirm(`"${gradeName}" 등급을 삭제하시겠습니까?`)) return;
    const currentGrades = getCurrentGradeOrder();
    updateGradeOrder(currentGrades.filter(g => g !== gradeName));
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
          <p className="text-gray-500 text-sm">공판장 및 등급 정렬 순서를 설정합니다</p>
        </div>
        <button
          onClick={loadAllMarketGrades}
          disabled={loadingGrades}
          className="btn btn-ghost btn-sm gap-1 text-blue-600"
          title="등급 정보 새로고침"
        >
          <RefreshIcon className={loadingGrades ? 'animate-spin' : ''} fontSize="small" />
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

      <div className="grid md:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
        {/* 공판장 정렬 순서 */}
        <div className="card bg-base-100 shadow-xl flex flex-col h-full">
          <div className="card-body flex flex-col p-4 h-full">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="card-title text-lg text-blue-600">공판장 목록</h2>
              <button
                onClick={() => setShowAddMarket(!showAddMarket)}
                className="btn btn-ghost btn-xs text-blue-600"
              >
                <AddIcon fontSize="small" /> 추가
              </button>
            </div>

            {/* 신규 공판장 추가 */}
            {showAddMarket && (
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <input
                  type="text"
                  value={newMarketName}
                  onChange={(e) => setNewMarketName(e.target.value)}
                  placeholder="공판장명 입력"
                  className="input input-bordered input-sm flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && addMarket()}
                />
                <button onClick={addMarket} className="btn btn-sm btn-outline text-blue-600 border-blue-600">
                  추가
                </button>
                <button onClick={() => { setShowAddMarket(false); setNewMarketName(''); }} className="btn btn-sm btn-ghost">
                  취소
                </button>
              </div>
            )}

            <p className="text-sm text-gray-500 mb-4 flex-shrink-0">
              공판장을 클릭하면 오른쪽에 등급 목록이 표시됩니다
            </p>

            {marketOrder.length === 0 ? (
              <div className="text-center py-8 text-gray-400 flex-1">
                <p>공판장이 없습니다</p>
                <p className="text-sm mt-2">위 추가 버튼으로 공판장을 등록하세요</p>
              </div>
            ) : (
              <ul className="space-y-2 overflow-y-auto flex-1">
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
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMarket(market); }}
                        className="btn btn-ghost btn-xs text-red-500 hover:bg-red-50"
                        title="삭제"
                      >
                        <DeleteIcon fontSize="small" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 등급 정렬 순서 */}
        <div className="card bg-base-100 shadow-xl flex flex-col h-full">
          <div className="card-body flex flex-col p-4 h-full">
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="card-title text-lg text-blue-600">
                {selectedMarket ? `${selectedMarket} 등급` : '등급 목록'}
              </h2>
              {selectedMarket && (
                <button
                  onClick={() => setShowAddGrade(!showAddGrade)}
                  className="btn btn-ghost btn-xs text-blue-600"
                >
                  <AddIcon fontSize="small" /> 추가
                </button>
              )}
            </div>

            {/* 신규 등급 추가 */}
            {showAddGrade && selectedMarket && (
              <div className="flex gap-2 mb-4 flex-shrink-0">
                <input
                  type="text"
                  value={newGradeName}
                  onChange={(e) => setNewGradeName(e.target.value)}
                  placeholder="등급명 입력"
                  className="input input-bordered input-sm flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && addGrade()}
                />
                <button onClick={addGrade} className="btn btn-sm btn-outline text-blue-600 border-blue-600">
                  추가
                </button>
                <button onClick={() => { setShowAddGrade(false); setNewGradeName(''); }} className="btn btn-sm btn-ghost">
                  취소
                </button>
              </div>
            )}

            {!selectedMarket ? (
              <div className="text-center py-12 text-gray-400 flex-1 flex flex-col justify-center">
                <p className="text-lg mb-2">공판장을 선택하세요</p>
                <p className="text-sm">왼쪽 목록에서 공판장을 클릭하면<br/>해당 공판장의 등급 목록이 표시됩니다</p>
              </div>
            ) : loadingGrades ? (
              <div className="flex justify-center py-12 flex-1">
                <span className="loading loading-spinner loading-lg text-blue-600"></span>
              </div>
            ) : currentGradeOrder.length === 0 ? (
              <div className="text-center py-12 text-gray-400 flex-1 flex flex-col justify-center">
                <p className="text-lg">등급 정보가 없습니다</p>
                <p className="text-sm mt-2">위의 추가 버튼으로 등급을 추가하세요</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4 flex-shrink-0">
                  드래그하거나 화살표로 정렬 순서를 변경하세요
                </p>
                <ul className="space-y-2 overflow-y-auto flex-1">
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
                        <button
                          onClick={() => deleteGrade(grade)}
                          className="btn btn-ghost btn-xs text-red-500 hover:bg-red-50"
                          title="삭제"
                        >
                          <DeleteIcon fontSize="small" />
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
