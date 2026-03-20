/**
 * AdminDetailGradeSettings.jsx
 * 도매시장 등급별 세부 데이터(market_detail_grade)의 등급 정렬 순서 관리
 * - 등급(특, 상, 보통, 등외 등)의 표시 순서 설정
 * - 크기규격(30내, 40내 등)의 표시 순서 설정
 * - app_settings 테이블에 저장
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
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

  // 등급 순서
  const [gradeOrder, setGradeOrder] = useState([]);
  // 크기규격 순서
  const [sizeOrder, setSizeOrder] = useState([]);

  // 드래그 상태
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedType, setDraggedType] = useState(null);

  // 초기 로드
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
        savedSettings = data?.value;
      }

      // 2. DB에서 고유 등급/크기규격 목록 조회
      const { data: gradeData } = await supabase
        .from('market_detail_grade')
        .select('grade, size_name');

      const uniqueGrades = [...new Set((gradeData || []).map((r) => r.grade))].sort();
      const uniqueSizes = [...new Set((gradeData || []).map((r) => r.size_name))].sort((a, b) => {
        // 숫자 기준 정렬 (30내 < 40내 < 50내...)
        const numA = parseInt(a) || 999;
        const numB = parseInt(b) || 999;
        return numA - numB;
      });

      if (savedSettings && !forceRefresh) {
        // 저장된 순서 사용 (새로 추가된 항목은 뒤에 붙임)
        const savedGrades = savedSettings.grade_order || [];
        const newGrades = uniqueGrades.filter((g) => !savedGrades.includes(g));
        setGradeOrder([...savedGrades.filter((g) => uniqueGrades.includes(g)), ...newGrades]);

        const savedSizes = savedSettings.size_order || [];
        const newSizes = uniqueSizes.filter((s) => !savedSizes.includes(s));
        setSizeOrder([...savedSizes.filter((s) => uniqueSizes.includes(s)), ...newSizes]);
      } else {
        setGradeOrder(uniqueGrades);
        setSizeOrder(uniqueSizes);
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
          value: { grade_order: gradeOrder, size_order: sizeOrder },
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

  // 드래그 핸들러
  const handleDragStart = (e, index, type) => {
    setDraggedItem(index);
    setDraggedType(type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index, type) => {
    e.preventDefault();
    if (draggedType !== type || draggedItem === index) return;

    if (type === 'grade') {
      const items = [...gradeOrder];
      const dragged = items[draggedItem];
      items.splice(draggedItem, 1);
      items.splice(index, 0, dragged);
      setGradeOrder(items);
    } else {
      const items = [...sizeOrder];
      const dragged = items[draggedItem];
      items.splice(draggedItem, 1);
      items.splice(index, 0, dragged);
      setSizeOrder(items);
    }
    setDraggedItem(index);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDraggedType(null);
  };

  // 화살표 이동
  const moveUp = (index, type) => {
    if (index === 0) return;
    if (type === 'grade') {
      const items = [...gradeOrder];
      [items[index - 1], items[index]] = [items[index], items[index - 1]];
      setGradeOrder(items);
    } else {
      const items = [...sizeOrder];
      [items[index - 1], items[index]] = [items[index], items[index - 1]];
      setSizeOrder(items);
    }
  };

  const moveDown = (index, type) => {
    const list = type === 'grade' ? gradeOrder : sizeOrder;
    if (index === list.length - 1) return;
    if (type === 'grade') {
      const items = [...gradeOrder];
      [items[index], items[index + 1]] = [items[index + 1], items[index]];
      setGradeOrder(items);
    } else {
      const items = [...sizeOrder];
      [items[index], items[index + 1]] = [items[index + 1], items[index]];
      setSizeOrder(items);
    }
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

      {/* 성공 메시지 */}
      {successMessage && (
        <div className="alert alert-info mb-4 bg-blue-50 border-blue-200">
          <svg xmlns="http://www.w3.org/2000/svg" className="stroke-blue-600 shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-blue-700">{successMessage}</span>
        </div>
      )}

      <p className="text-sm text-base-content/60 mb-4">
        도매시장 등급별 세부 데이터의 표시 순서를 설정합니다.<br />
        드래그하거나 화살표로 순서를 변경하세요.
      </p>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        {/* 등급 정렬 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-lg text-blue-600 mb-2">등급 순서</h2>
            {gradeOrder.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                <p>등급 데이터가 없습니다</p>
                <p className="text-sm mt-1">market_detail_grade에 데이터를 먼저 업로드하세요</p>
              </div>
            ) : (
              <ul className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                {gradeOrder.map((grade, index) =>
                  renderSortableItem(grade, index, 'grade', gradeOrder.length)
                )}
              </ul>
            )}
          </div>
        </div>

        {/* 크기규격 정렬 */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body p-4">
            <h2 className="card-title text-lg text-green-600 mb-2">크기규격 순서</h2>
            {sizeOrder.length === 0 ? (
              <div className="text-center py-8 text-base-content/40">
                <p>크기규격 데이터가 없습니다</p>
                <p className="text-sm mt-1">market_detail_grade에 데이터를 먼저 업로드하세요</p>
              </div>
            ) : (
              <ul className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
                {sizeOrder.map((size, index) =>
                  renderSortableItem(size, index, 'size', sizeOrder.length)
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
