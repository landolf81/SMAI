import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { marketService } from '../../services';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// 기본 공판장 목록
const DEFAULT_MARKETS = [
  '성주원예',
  '성주조공',
  '선남',
  '가락',
  '초전',
  '용암'
];

// 기본 등급 목록 (공판장별 등급 조회 실패 시 사용)
const DEFAULT_GRADES = [
  '특품',
  '상품',
  '중품',
  '하품'
];

const AdminMarketSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marketOrder, setMarketOrder] = useState([]);
  const [gradeOrder, setGradeOrder] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedType, setDraggedType] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // 공판장별 등급 정보
  const [marketGrades, setMarketGrades] = useState({});
  const [selectedMarket, setSelectedMarket] = useState(null);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [expandedMarkets, setExpandedMarkets] = useState({});

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
    } catch (error) {
      console.error('등급 목록 조회 오류:', error);
    } finally {
      setLoadingGrades(false);
    }
  };

  // 공판장 펼치기/접기 토글
  const toggleMarketExpand = (marketName) => {
    setExpandedMarkets(prev => ({
      ...prev,
      [marketName]: !prev[marketName]
    }));
  };

  const loadSettings = async () => {
    try {
      setLoading(true);

      // localStorage에서 설정 불러오기 (Supabase 테이블 없이 간단히 구현)
      const savedMarketOrder = localStorage.getItem('market_order');
      const savedGradeOrder = localStorage.getItem('grade_order');

      if (savedMarketOrder) {
        setMarketOrder(JSON.parse(savedMarketOrder));
      } else {
        setMarketOrder(DEFAULT_MARKETS);
      }

      if (savedGradeOrder) {
        setGradeOrder(JSON.parse(savedGradeOrder));
      } else {
        setGradeOrder(DEFAULT_GRADES);
      }
    } catch (error) {
      console.error('설정 불러오기 오류:', error);
      setMarketOrder(DEFAULT_MARKETS);
      setGradeOrder(DEFAULT_GRADES);
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
      localStorage.setItem('grade_order', JSON.stringify(gradeOrder));

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

    const items = type === 'market' ? [...marketOrder] : [...gradeOrder];
    const draggedItemContent = items[draggedItem];

    // 아이템 재배치
    items.splice(draggedItem, 1);
    items.splice(index, 0, draggedItemContent);

    if (type === 'market') {
      setMarketOrder(items);
    } else {
      setGradeOrder(items);
    }
    setDraggedItem(index);
  };

  // 드래그 종료
  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedType(null);
  };

  // 위로 이동
  const moveUp = (index, type) => {
    if (index === 0) return;
    const items = type === 'market' ? [...marketOrder] : [...gradeOrder];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    if (type === 'market') {
      setMarketOrder(items);
    } else {
      setGradeOrder(items);
    }
  };

  // 아래로 이동
  const moveDown = (index, type) => {
    const items = type === 'market' ? [...marketOrder] : [...gradeOrder];
    if (index === items.length - 1) return;
    [items[index], items[index + 1]] = [items[index + 1], items[index]];
    if (type === 'market') {
      setMarketOrder(items);
    } else {
      setGradeOrder(items);
    }
  };

  // 기본값으로 초기화
  const resetToDefault = (type) => {
    if (type === 'market') {
      setMarketOrder(DEFAULT_MARKETS);
    } else {
      setGradeOrder(DEFAULT_GRADES);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
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
          <h1 className="text-2xl font-bold">시장정보 설정</h1>
          <p className="text-gray-500 text-sm">공판장 및 등급 정렬 순서를 설정합니다</p>
        </div>
        <button
          onClick={loadAllMarketGrades}
          disabled={loadingGrades}
          className="btn btn-ghost btn-sm gap-1"
          title="등급 정보 새로고침"
        >
          <RefreshIcon className={loadingGrades ? 'animate-spin' : ''} fontSize="small" />
          <span className="hidden sm:inline">새로고침</span>
        </button>
      </div>

      {/* 성공 메시지 */}
      {successMessage && (
        <div className="alert alert-success mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* 공판장 정렬 순서 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title text-lg">공판장 정렬 순서</h2>
              <button
                onClick={() => resetToDefault('market')}
                className="btn btn-ghost btn-xs"
              >
                기본값
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              드래그하거나 화살표 버튼으로 순서를 변경하세요
            </p>
            <ul className="space-y-2">
              {marketOrder.map((market, index) => (
                <li
                  key={market}
                  className={`bg-gray-50 rounded-lg transition-colors ${
                    draggedItem === index && draggedType === 'market' ? 'opacity-50' : ''
                  }`}
                >
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, index, 'market')}
                    onDragOver={(e) => handleDragOver(e, index, 'market')}
                    onDragEnd={handleDragEnd}
                    className="flex items-center gap-2 p-3 cursor-move hover:bg-gray-100"
                  >
                    <DragIndicatorIcon className="text-gray-400" />
                    <span className="flex-1 font-medium">{market}</span>
                    <span className="text-gray-400 text-sm mr-2">#{index + 1}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => moveUp(index, 'market')}
                        disabled={index === 0}
                        className="btn btn-ghost btn-xs"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveDown(index, 'market')}
                        disabled={index === marketOrder.length - 1}
                        className="btn btn-ghost btn-xs"
                      >
                        ▼
                      </button>
                      <button
                        onClick={() => toggleMarketExpand(market)}
                        className="btn btn-ghost btn-xs"
                        title="등급 목록 보기"
                      >
                        {expandedMarkets[market] ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </button>
                    </div>
                  </div>

                  {/* 공판장별 등급 목록 */}
                  {expandedMarkets[market] && (
                    <div className="px-4 pb-3 border-t border-gray-200 bg-gray-100 rounded-b-lg">
                      <div className="pt-2">
                        <span className="text-xs text-gray-500 font-medium">등급 목록:</span>
                        {loadingGrades ? (
                          <span className="loading loading-spinner loading-xs ml-2"></span>
                        ) : marketGrades[market] && marketGrades[market].length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {marketGrades[market].map((grade, gIndex) => (
                              <span
                                key={gIndex}
                                className="px-2 py-0.5 bg-white text-gray-700 text-xs rounded border border-gray-300"
                              >
                                {grade}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 ml-2">등급 정보 없음</span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 등급 정렬 순서 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <h2 className="card-title text-lg">등급 정렬 순서</h2>
              <button
                onClick={() => resetToDefault('grade')}
                className="btn btn-ghost btn-xs"
              >
                기본값
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              경락가 상세 화면에서 등급 표시 순서입니다.<br/>
              <span className="text-xs text-blue-600">각 공판장의 실제 등급 목록은 왼쪽 공판장을 펼쳐서 확인하세요.</span>
            </p>
            <ul className="space-y-2">
              {gradeOrder.map((grade, index) => (
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
                  <span className="flex-1 font-medium">{grade}</span>
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
                      disabled={index === gradeOrder.length - 1}
                      className="btn btn-ghost btn-xs"
                    >
                      ▼
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="fixed bottom-6 right-6">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn btn-primary gap-2 shadow-lg"
        >
          {saving ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <SaveIcon />
          )}
          {saving ? '저장 중...' : '설정 저장'}
        </button>
      </div>
    </div>
  );
};

export default AdminMarketSettings;
