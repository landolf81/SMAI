/**
 * PesticideInfo 컴포넌트
 * 역할: 참외 전용 농약정보 검색 UI
 * 데이터 소스: pesticide_registry 테이블 (식품안전나라 API 동기화)
 * 기능: 통합 검색 + 용도/병해충 필터 + 아코디언 카드
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { pesticideService } from '../services';

/** 용도 필터 칩 */
const PURPOSE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: '살균', label: '살균제' },
  { key: '살충', label: '살충제' },
  { key: '균충', label: '살충살균' },
];

/** 용도별 뱃지 색상 */
const purposeColor = (purpose) => {
  if (purpose?.includes('살균')) return 'bg-red-500/15 text-red-600 dark:text-red-400';
  if (purpose?.includes('살충')) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
  return 'bg-base-300 text-base-content/60';
};

/** 독성 뱃지 색상 */
const toxicityColor = (toxicity) => {
  if (toxicity?.includes('맹독성') || toxicity?.includes('고독성')) return 'bg-red-500 text-white';
  if (toxicity?.includes('보통독성')) return 'bg-orange-500/15 text-orange-600 dark:text-orange-400';
  if (toxicity?.includes('저독성')) return 'bg-green-500/15 text-green-600 dark:text-green-400';
  return 'bg-base-300 text-base-content/60';
};

/** 농약 카드 (아코디언) */
const PesticideCard = ({ item, isOpen, onToggle }) => (
  <div className="border border-base-300 rounded-xl overflow-hidden">
    <button
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
        isOpen ? 'bg-teal-500/10' : 'bg-base-100 hover:bg-base-200'
      }`}
      onClick={onToggle}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-base-content truncate">
            {item.brand_name || item.pesticide_name}
          </span>
          <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${purposeColor(item.purpose)}`}>
            {item.purpose}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-teal-600 font-medium">{item.pest_disease}</span>
          {item.brand_name && item.brand_name !== item.pesticide_name && (
            <span className="text-xs text-base-content/40">({item.pesticide_name})</span>
          )}
        </div>
      </div>
      <ExpandMoreIcon
        className={`text-base-content/40 transition-transform duration-200 flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        fontSize="small"
      />
    </button>

    {isOpen && (
      <div className="border-t border-base-200 bg-base-200/50 px-4 py-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          <DetailItem label="희석배수" value={item.dilution ? (item.dilution.includes('배') ? item.dilution : `${item.dilution}배`) : '-'} />
          <DetailItem label="사용시기" value={item.usage_timing || '-'} />
          <DetailItem label="사용횟수" value={item.usage_count || '-'} />
          <DetailItem label="사용방법" value={item.usage_method || '-'} />
          <DetailItem label="제제형태" value={item.formulation || '-'} />
          <DetailItem label="회사" value={item.company || '-'} />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-base-300">
          {item.toxicity && (
            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${toxicityColor(item.toxicity)}`}>
              {item.toxicity}
            </span>
          )}
          {item.eco_toxicity && (
            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-sky-500/15 text-sky-600 dark:text-sky-400">
              어독성 {item.eco_toxicity}
            </span>
          )}
          {item.reg_status && (
            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-base-300 text-base-content/60">
              {item.reg_status}
            </span>
          )}
        </div>
      </div>
    )}
  </div>
);

/** 상세 항목 행 */
const DetailItem = ({ label, value }) => (
  <div>
    <p className="text-xs text-base-content/40 mb-0.5">{label}</p>
    <p className="text-sm text-base-content/80">{value}</p>
  </div>
);

// ── 메인 컴포넌트 ──

const PesticideInfo = () => {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [pestFilter, setPestFilter] = useState('all');
  const [openCard, setOpenCard] = useState(null);

  // 데이터 로드 (전체 한번만)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await pesticideService.getAll();
      setAllData(data);
      setLoading(false);
    })();
  }, []);

  // 고유 병해충 목록 추출
  const pestList = useMemo(() => {
    const unique = [...new Set(allData.map(d => d.pest_disease).filter(Boolean))];
    return unique.sort();
  }, [allData]);

  // 필터링된 결과
  const filtered = useMemo(() => {
    let result = allData;

    // 검색어 필터
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(
        (d) =>
          d.pesticide_name?.toLowerCase().includes(term) ||
          d.brand_name?.toLowerCase().includes(term) ||
          d.pest_disease?.toLowerCase().includes(term) ||
          d.company?.toLowerCase().includes(term)
      );
    }

    // 용도 필터
    if (purposeFilter !== 'all') {
      result = result.filter((d) => d.purpose?.includes(purposeFilter));
    }

    // 병해충 필터
    if (pestFilter !== 'all') {
      result = result.filter((d) => d.pest_disease === pestFilter);
    }

    return result;
  }, [allData, searchTerm, purposeFilter, pestFilter]);

  // 병해충별 그룹화
  const grouped = useMemo(() => {
    const groups = {};
    for (const item of filtered) {
      const key = item.pest_disease || '기타';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    return groups;
  }, [filtered]);

  const toggleCard = useCallback((id) => {
    setOpenCard((prev) => (prev === id ? null : id));
  }, []);

  const clearSearch = () => {
    setSearchTerm('');
    setPurposeFilter('all');
    setPestFilter('all');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="loading loading-spinner loading-md text-teal-500"></span>
      </div>
    );
  }

  if (allData.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mb-4">
            <span className="text-3xl">🧪</span>
          </div>
          <p className="text-base-content/60 font-medium mb-1">데이터 동기화가 필요합니다</p>
          <p className="text-sm text-base-content/40">관리자에게 농약 데이터 동기화를 요청하세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      {/* 헤더 */}
      <div>
        <h2 className="text-lg font-bold text-base-content mb-0.5">참외 등록 농약 정보</h2>
        <p className="text-xs text-base-content/40">출처: 농촌진흥청 농약안전정보시스템 | 총 {allData.length}건</p>
      </div>

      {/* 검색바 - flex 레이아웃 */}
      <div className="flex items-center gap-2 rounded-xl border border-base-300 focus-within:border-teal-500 focus-within:ring-2 focus-within:ring-teal-200 px-3 py-2.5 bg-base-100">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="농약명, 상표명, 병해충명 검색..."
          className="flex-1 min-w-0 outline-none text-sm bg-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="flex-shrink-0 text-base-content/40 hover:text-base-content/60"
          >
            <CloseIcon fontSize="small" />
          </button>
        )}
      </div>

      {/* 용도 필터 칩 */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {PURPOSE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setPurposeFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              purposeFilter === f.key
                ? 'bg-teal-500 text-white'
                : 'bg-base-300 text-base-content/60 hover:bg-base-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 병해충 필터 (드롭다운) */}
      <select
        value={pestFilter}
        onChange={(e) => setPestFilter(e.target.value)}
        className="w-full border border-base-300 rounded-xl px-3 py-2 text-sm bg-base-100 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
      >
        <option value="all">병해충 전체</option>
        {pestList.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      {/* 결과 카운트 + 초기화 */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-base-content/50">
          {filtered.length}건 {filtered.length !== allData.length && `(전체 ${allData.length}건)`}
        </p>
        {(searchTerm || purposeFilter !== 'all' || pestFilter !== 'all') && (
          <button
            onClick={clearSearch}
            className="text-xs text-teal-600 font-medium hover:underline"
          >
            필터 초기화
          </button>
        )}
      </div>

      {/* 결과 목록 (병해충별 그룹) */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-base-content/50 font-medium mb-1">검색 결과가 없습니다</p>
          <p className="text-sm text-base-content/40">다른 검색어나 필터를 시도해 보세요.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([pestName, items]) => (
            <div key={pestName}>
              <h3 className="text-sm font-bold text-base-content/80 border-l-4 border-teal-500 pl-2 mb-2">
                {pestName}
                <span className="text-xs text-base-content/40 font-normal ml-2">{items.length}건</span>
              </h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <PesticideCard
                    key={item.id}
                    item={item}
                    isOpen={openCard === item.id}
                    onToggle={() => toggleCard(item.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 공공누리 제3유형 출처표시 */}
      <div className="mt-6 pt-4 border-t border-base-300">
        <div className="flex items-start gap-2">
          <img
            src="/images/img_opentype01.jpg"
            alt="공공누리 제1유형"
            className="w-16 h-auto flex-shrink-0"
          />
          <p className="text-[10px] text-base-content/40 leading-relaxed">
            본 저작물은 '농촌진흥청 농약안전정보시스템'에서 작성하여 공공누리 제1유형으로 개방한 '농약등록정보'를 이용하였으며,
            해당 저작물은{' '}
            <a href="https://psis.rda.go.kr" target="_blank" rel="noopener noreferrer" className="text-teal-500 underline">
              농약안전정보시스템(psis.rda.go.kr)
            </a>
            에서 무료로 다운받으실 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PesticideInfo;
