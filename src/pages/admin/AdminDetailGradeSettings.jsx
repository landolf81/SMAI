/**
 * AdminDetailGradeSettings.jsx
 * 도매시장 법인별 등급/크기규격 정렬 순서 관리
 * - 왼쪽: 법인 목록 선택
 * - 오른쪽: 선택된 법인의 등급 순서 + 크기규격 순서
 * - app_settings 테이블에 법인별로 저장
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';

const SETTINGS_KEY = 'detail_grade_display_settings';

const AdminDetailGradeSettings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // 법인 목록
  const [corporationList, setCorporationList] = useState([]);
  const [selectedCorp, setSelectedCorp] = useState(null);

  // 법인별 DB 원본 데이터 (등급/크기규격 목록)
  const [corpDataMap, setCorpDataMap] = useState({});

  // 법인별 정렬 설정 { "㈜중앙청과": { grade_order: [], size_order: [] }, ... }
  const [corpSettings, setCorpSettings] = useState({});

  // 드래그 상태
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedType, setDraggedType] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);

      // 1. 저장된 설정 조회
      let savedSettings = null;
      if (!forceRefresh) {
        const { data } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', SETTINGS_KEY)
          .maybeSingle();
        savedSettings = data?.value?.corporations || {};
      }

      // 2. DB에서 법인별 고유 등급/크기규격 조회
      const { data: rawData } = await supabase
        .from('market_detail_grade')
        .select('market_name, grade, size_name');

      // 법인별로 그룹핑
      const dataMap = {};
      (rawData || []).forEach((row) => {
        if (!dataMap[row.market_name]) {
          dataMap[row.market_name] = { grades: new Set(), sizes: new Set() };
        }
        dataMap[row.market_name].grades.add(row.grade);
        dataMap[row.market_name].sizes.add(row.size_name);
      });

      // Set → 정렬된 배열로 변환
      const corpList = Object.keys(dataMap).sort();
      const processedMap = {};
      corpList.forEach((corp) => {
        processedMap[corp] = {
          grades: [...dataMap[corp].grades].sort(),
          sizes: [...dataMap[corp].sizes].sort((a, b) => {
            const numA = parseInt(a) || 999;
            const numB = parseInt(b) || 999;
            return numA - numB;
          }),
        };
      });

      setCorporationList(corpList);
      setCorpDataMap(processedMap);

      // 3. 저장된 설정 병합 (새 항목은 뒤에 추가)
      const mergedSettings = {};
      corpList.forEach((corp) => {
        const saved = savedSettings?.[corp] || {};
        const dbGrades = processedMap[corp].grades;
        const dbSizes = processedMap[corp].sizes;

        const savedGrades = saved.grade_order || [];
        const savedSizes = saved.size_order || [];

        mergedSettings[corp] = {
          grade_order: forceRefresh
            ? dbGrades
            : [...savedGrades.filter((g) => dbGrades.includes(g)), ...dbGrades.filter((g) => !savedGrades.includes(g))],
          size_order: forceRefresh
            ? dbSizes
            : [...savedSizes.filter((s) => dbSizes.includes(s)), ...dbSizes.filter((s) => !savedSizes.includes(s))],
        };
      });

      setCorpSettings(mergedSettings);
      if (corpList.length > 0 && !selectedCorp) {
        setSelectedCorp(corpList[0]);
      }
    } catch (error) {
      console.error('데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  // 저장
  const handleSave = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key: SETTINGS_KEY,
          value: { corporations: corpSettings },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'key' });

      if (error) throw error;
      setSuccessMessage('설정이 저장되었습니다');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('저장 오류:', error);
      alert('저장 실패: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // 현재 선택된 법인의 등급/크기규격 순서
  const currentGradeOrder = selectedCorp ? (corpSettings[selectedCorp]?.grade_order || []) : [];
  const currentSizeOrder = selectedCorp ? (corpSettings[selectedCorp]?.size_order || []) : [];

  // 순서 변경 헬퍼
  const updateOrder = (type, newOrder) => {
    if (!selectedCorp) return;
    setCorpSettings((prev) => ({
      ...prev,
      [selectedCorp]: {
        ...prev[selectedCorp],
        [type === 'grade' ? 'grade_order' : 'size_order']: newOrder,
      },
    }));
  };

  // 드래그 핸들러
  const handleDragStart = (e, index, type) => {
    setDraggedItem(index);
    setDraggedType(type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index, type) => {
    e.preventDefault();
    if (draggedType !== type || draggedItem === index) return;

    const list = type === 'grade' ? [...currentGradeOrder] : [...currentSizeOrder];
    const dragged = list[draggedItem];
    list.splice(draggedItem, 1);
    list.splice(index, 0, dragged);
    updateOrder(type, list);
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedType(null);
  };

  const moveUp = (index, type) => {
    if (index === 0) return;
    const list = type === 'grade' ? [...currentGradeOrder] : [...currentSizeOrder];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    updateOrder(type, list);
  };

  const moveDown = (index, type) => {
    const list = type === 'grade' ? [...currentGradeOrder] : [...currentSizeOrder];
    if (index === list.length - 1) return;
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    updateOrder(type, list);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 정렬 아이템 렌더링
  const renderSortableItem = (item, index, type, listLength) => (
    <li
      key={item}
      draggable
      onDragStart={(e) => handleDragStart(e, index, type)}
      onDragOver={(e) => handleDragOver(e, index, type)}
      onDragEnd={handleDragEnd}
      className={`flex items-center gap-1.5 px-2 py-1.5 bg-base-200 rounded-md cursor-move hover:bg-base-300 transition-colors text-sm ${
        draggedItem === index && draggedType === type ? 'opacity-50' : ''
      }`}
    >
      <DragIndicatorIcon className="text-base-content/40" style={{ fontSize: 16 }} />
      <span className="flex-1 font-medium text-base-content">
        {item === '.' ? '미분류' : item}
      </span>
      <span className="text-base-content/40 text-xs">#{index + 1}</span>
      <div className="flex">
        <button
          onClick={() => moveUp(index, type)}
          disabled={index === 0}
          className="btn btn-ghost btn-xs px-1 min-h-0 h-5"
        >
          ▲
        </button>
        <button
          onClick={() => moveDown(index, type)}
          disabled={index === listLength - 1}
          className="btn btn-ghost btn-xs px-1 min-h-0 h-5"
        >
          ▼
        </button>
      </div>
    </li>
  );

  return (
    <div className="min-h-screen bg-base-200 p-4 pt-16 pb-24">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-base-300 rounded-full transition-colors"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="text-lg font-bold text-base-content">등급 세부 정렬 설정</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => loadData(true)}
            className="btn btn-sm btn-ghost"
            title="DB에서 새로고침"
          >
            <RefreshIcon style={{ fontSize: 18 }} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-sm btn-primary"
          >
            {saving ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <SaveIcon style={{ fontSize: 18 }} />
            )}
            저장
          </button>
        </div>
      </div>

      {/* 성공 토스트 (화면 상단 중앙, 자동 사라짐) */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {successMessage}
          </div>
        </div>
      )}

      {/* 3열 레이아웃: 법인 | 등급 | 크기규격 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {/* 법인 목록 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-lg text-blue-600 mb-2">도매법인</h2>
            <p className="text-xs text-base-content/60 mb-2">
              법인을 선택하면 등급/크기규격 순서 설정
            </p>
            {corporationList.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                <p>법인 데이터가 없습니다</p>
                <p className="text-sm mt-1">market_detail_grade에 데이터를 먼저 업로드하세요</p>
              </div>
            ) : (
              <ul className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                {corporationList.map((corp) => (
                  <li
                    key={corp}
                    onClick={() => setSelectedCorp(corp)}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded-md cursor-pointer transition-colors text-sm ${
                      selectedCorp === corp
                        ? 'bg-blue-100 border border-blue-400 text-blue-700 font-bold'
                        : 'bg-base-200 hover:bg-base-300 text-base-content'
                    }`}
                  >
                    <span className="flex-1 font-medium">{corp}</span>
                    <span className="text-xs text-base-content/40">
                      {corpDataMap[corp]?.grades.length || 0}등급
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* 등급 순서 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-lg text-green-600 mb-2">
              {selectedCorp ? `등급 순서` : '등급 순서'}
            </h2>
            {!selectedCorp ? (
              <div className="text-center py-8 text-base-content/40">
                <p>법인을 선택하세요</p>
              </div>
            ) : currentGradeOrder.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                <p>등급 데이터 없음</p>
              </div>
            ) : (
              <ul className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                {currentGradeOrder.map((grade, index) =>
                  renderSortableItem(grade, index, 'grade', currentGradeOrder.length)
                )}
              </ul>
            )}
          </div>
        </div>

        {/* 크기규격 순서 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-lg text-orange-500 mb-2">
              {selectedCorp ? `크기규격 순서` : '크기규격 순서'}
            </h2>
            {!selectedCorp ? (
              <div className="text-center py-8 text-base-content/40">
                <p>법인을 선택하세요</p>
              </div>
            ) : currentSizeOrder.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                <p>크기규격 데이터 없음</p>
              </div>
            ) : (
              <ul className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                {currentSizeOrder.map((size, index) =>
                  renderSortableItem(size, index, 'size', currentSizeOrder.length)
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDetailGradeSettings;
