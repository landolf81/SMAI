/**
 * PestDiseaseInfo 컴포넌트
 * 역할: 참외 병충해 정보 소개 (병해 6종 + 해충 7종)
 * 출처: 농촌진흥청 농업기술길잡이 105(2018)
 */

import { useState } from 'react';

// ──────────────── 데이터 ────────────────

const COMMON_PRINCIPLES = [
  { num: 1, text: '초기 예찰이 약제보다 중요: 초기 1~2주 대응이 수확량을 좌우' },
  { num: 2, text: '환경관리 우선: 환기·습도·밀식·관수 패턴 조정' },
  { num: 3, text: '농약은 마지막이 아니라 \'정확한 타이밍 도구\'' },
  { num: 4, text: '동일 계통(MoA) 연속 사용 금지: 저항성 관리 필수' },
  { num: 5, text: '등록 약제만 사용: 작물=참외, 대상 병해충, 사용방법 일치 확인' },
];

const DISEASES = [
  {
    id: 'powdery-mildew',
    name: '흰가루병',
    icon: '🍃',
    image: '/images/병충해/disease_powdery_mildew.jpg',
    cause: '곰팡이성 병. 하우스 내 환기 부족 + 주야간 온도변동 + 밀식에서 증가. 잎 표면 건조해도 발생 가능.',
    symptoms: '잎에 흰 밀가루 같은 반점 → 잎 전체 확산. 광합성 저하, 잎 노화, 과실 비대·당도 저하.',
    immediate: '감염 잎 제거/반출. 환기 확대, 하엽 정리. 발생 초기에 등록 살균제 교호살포.',
    prevention: '정식 후 과번무 억제, 덩굴/잎 겹침 최소화. 야간 결로 줄이기(보온 후 아침 환기).',
    pesticide: '동일 작용기작 연속 살포 지양. 예방-초기치료용 제품 구분 사용. PHI(수확전일수) 준수.',
  },
  {
    id: 'downy-mildew',
    name: '노균병',
    icon: '🌿',
    image: '/images/병충해/disease_downy_mildew.jpg',
    cause: '곰팡이성(난균) 병해. 고습·결로·환기불량에서 급증.',
    symptoms: '잎 앞면 황색/담갈색 반점, 뒷면 곰팡이층. 확산 빠르고 잎 고사로 수량 급감.',
    immediate: '야간/새벽 결로 억제(환기 시점 조정). 감염 잎 제거, 물 튀김 관수 피하기. 초기 등록약 즉시 처리 후 교호.',
    prevention: '밀식 금지, 통풍 확보. 하우스 내 장시간 과습 구간 없애기.',
    pesticide: '병반 확인 후 지체 없이 방제. 단일 계통 연속 방제 금지.',
  },
  {
    id: 'gummy-stem',
    name: '덩굴마름병',
    icon: '🌾',
    image: '/images/병충해/disease_gummy_stem_blight.jpg',
    cause: '병든 잔재물, 상처부위 통해 감염. 봄~가을 장기 발생 가능(시설재배 반복).',
    symptoms: '줄기/접목부 황갈색 수침반점. 진전 시 줄기 마름, 잎/과실 피해.',
    immediate: '병든 줄기·식물체 즉시 제거. 작업 도구 소독, 상처 최소화. 등록 살균제 초기 적용.',
    prevention: '잔재물 완전 제거. 관수/작업으로 줄기 상처 만들지 않기.',
    pesticide: '접촉형 + 침투이행형 교호 전략.',
  },
  {
    id: 'fusarium-wilt',
    name: '덩굴쪼김병',
    icon: '🥀',
    image: '/images/병충해/disease_fusarium_wilt.jpg',
    cause: '토양전염성 병원균, 연작 시 누적. 지온/토양수분 불균형에서 피해 확대.',
    symptoms: '한쪽 덩굴부터 시듦, 생육 정지. 뿌리/도관 변색.',
    immediate: '심한 포기는 조기 제거. 관수량 과다·과소 교정. 토양전염 관리(관주형 등록약/토양관리).',
    prevention: '접목 재배, 연작피해 최소화. 토양소독·배수개선.',
    pesticide: '토양병은 경엽살포만으로 해결 안 됨. 토양관리 + 관주 등록약 병행.',
  },
  {
    id: 'damping-off',
    name: '잘록병',
    icon: '🌱',
    image: '/images/병충해/disease_damping_off.jpg',
    cause: '육묘상 과습, 환기부족, 저온/과밀.',
    symptoms: '유묘 지제부 가늘어지며 쓰러짐(육묘기 발생).',
    immediate: '육묘상 온도·습도 즉시 조정. 과습 해소 및 통풍 확보.',
    prevention: '육묘상 온도·습도 관리, 과습 금지. 무적비닐/환기/관수량 조절. 상토 위생관리.',
    pesticide: '필요 시 등록약 관주.',
  },
  {
    id: 'virus',
    name: '바이러스병',
    icon: '🦠',
    image: '/images/병충해/disease_mosaic_virus.jpg',
    cause: '진딧물/총채벌레/가루이 등 매개충. 감염묘 유입, 잡초 기주.',
    symptoms: '모자이크, 잎 변형, 생육 위축, 과실 품질 저하.',
    immediate: '감염주 즉시 제거. 매개충 동시 방제.',
    prevention: '건전묘 사용. 하우스 내외 잡초관리, 방충망 설치.',
    pesticide: '바이러스 자체보다 매개충 관리가 핵심.',
  },
];

const PESTS = [
  {
    id: 'tobacco-whitefly',
    name: '담배가루이',
    icon: '🪰',
    badge: '핵심',
    image: '/images/병충해/pest_bemisia_tabaci.jpg',
    cause: '고온기/시설 내 연속재배에서 세대회전 빠름. 초기 유입 차단 실패 시 급증.',
    symptoms: '흡즙으로 생육저하. 감로/그을음 유발. 바이러스 매개 가능성.',
    immediate: '황색끈끈이트랩 설치·밀도 체크. 발생 초기 약충단계 중심 방제. 심하면 5~7일 간격 재점검.',
    prevention: '방충망, 하우스 주변 잡초 제거. 정식 초기 밀도 억제(예찰 루틴).',
    pesticide: '동일 MoA 연속 금지. 참외-담배가루이 등록약만 사용. MoA 교호 기반 로테이션 적용.',
  },
  {
    id: 'greenhouse-whitefly',
    name: '온실가루이',
    icon: '🪲',
    image: '/images/병충해/pest_greenhouse_whitefly.jpg',
    cause: '담배가루이와 유사. 시설 내 고온기 발생 증가.',
    symptoms: '흡즙, 감로/그을음, 잎 황화, 바이러스 매개.',
    immediate: '종 동정 후 방제전략 조정. 황색끈끈이트랩 병행.',
    prevention: '방충망 설치. 천적(좀벌류) 활용은 초기 밀도에서 효과적.',
    pesticide: '담배가루이와 유사하게 관리. 등록약 교호 사용.',
  },
  {
    id: 'aphid',
    name: '진딧물',
    icon: '🐛',
    image: '/images/병충해/pest_aphid.jpg',
    cause: '신초/연한 조직 많을 때 증가.',
    symptoms: '흡즙, 잎 말림, 바이러스 매개. 감로로 그을음병 유발.',
    immediate: '신초 집중 예찰. 초기 국부 처리 + 확산 전 차단.',
    prevention: '방충망, 잡초관리. 천적(무당벌레류) 서식환경 유지.',
    pesticide: '매개충 관점에서 조기 방제가 중요. 등록약 교호.',
  },
  {
    id: 'thrips',
    name: '총채벌레',
    icon: '🦟',
    image: '/images/병충해/pest_thrips.jpg',
    cause: '건조·고온·밀폐 조건에서 증가.',
    symptoms: '꽃·유과 가해, 흠집/기형. 바이러스 매개.',
    immediate: '청색/황색 트랩 병행. 꽃 주변 집중 예찰. 발생 초기에 빠른 교호방제.',
    prevention: '환기 유지, 방충망. 개화기 집중 예찰.',
    pesticide: '총채벌레 등록약 교호. 꽃 내부 도달성 확보.',
  },
  {
    id: 'spider-mite',
    name: '점박이응애',
    icon: '🕷️',
    image: '/images/병충해/pest_spider_mite.jpg',
    cause: '건조·고온 시 급증.',
    symptoms: '잎 반점/황화, 광합성 저하.',
    immediate: '하엽·잎뒷면 집중 관찰. 약제 도달성(잎뒷면) 확보 후 방제.',
    prevention: '하우스 습도 유지, 하엽 정리.',
    pesticide: '응애 전용 등록약 교호. 살충제와 혼용 금지.',
  },
  {
    id: 'fungus-gnat',
    name: '작은뿌리파리',
    icon: '🪱',
    image: '/images/병충해/pest_fungus_gnat.jpg',
    cause: '육묘상/정식 초기 과습 조건.',
    symptoms: '유묘 뿌리 가해, 활착 저하.',
    immediate: '과습 즉시 해소. 피해 묘 제거.',
    prevention: '과습 억제, 육묘상 위생.',
    pesticide: '토양/육묘상 등록약 사용.',
  },
  {
    id: 'root-knot-nematode',
    name: '뿌리혹선충',
    icon: '🐝',
    image: '/images/병충해/pest_root_knot_nematode.jpg',
    cause: '연작지 토양 내 누적. 뿌리를 통해 감염.',
    symptoms: '뿌리혹 형성, 양수분 흡수 저하, 수량 감소.',
    immediate: '피해 주 주변 토양 관리. 관주형 등록약 적용.',
    prevention: '정식 전 토양관리(소독, 태양열, 윤작). 연작지에서 사전 차단이 핵심.',
    pesticide: '관주/토양처리 등록약 활용. 경엽살포 효과 없음.',
  },
];

const PESTICIDE_TIPS = [
  { num: 1, title: '라벨 5요소 확인', items: ['작물명(참외)', '대상 병해충명', '희석배수/사용량', '사용시기/사용횟수', '수확전일수(PHI)'] },
  { num: 2, title: '교호방제 기본', items: ['같은 MoA 연속 사용 금지', '5~7일 점검 주기 (급증 시 3~5일)'] },
  { num: 3, title: '살포 품질', items: ['잎 뒷면 도달성 확보', '과다농도 금지 (약해/잔류/저항성 유발)'] },
  { num: 4, title: '관주/점적 처리', items: ['\'사용방법=관주(점적)\' 등록된 제품만 사용', '비등록 임의 혼입 금지'] },
];

// ──────────────── 서브 컴포넌트 ────────────────

const Section = ({ title, children }) => (
  <section className="mb-6">
    <h3 className="text-base font-bold text-base-content border-l-4 border-teal-500 pl-3 mb-3">{title}</h3>
    {children}
  </section>
);

const DetailRow = ({ label, text, highlight }) => (
  <div>
    <p className={`text-xs font-semibold mb-0.5 ${highlight ? 'text-orange-700' : 'text-base-content/50'}`}>{label}</p>
    <p className="text-sm text-base-content/80 leading-relaxed">{text}</p>
  </div>
);

const PestCard = ({ item, isOpen, onToggle, accentColor }) => {
  const hoverBg = accentColor === 'red' ? 'hover:bg-red-500/10' : 'hover:bg-teal-500/10';
  const expandedBg = accentColor === 'red' ? 'bg-red-500/10' : 'bg-teal-500/10';
  const badgeCls = accentColor === 'red'
    ? 'bg-red-500/15 text-red-600 dark:text-red-400'
    : 'bg-teal-500/15 text-teal-600 dark:text-teal-400';
  const symptomLabel = accentColor === 'red' ? '주요 증상' : '주요 피해';

  return (
    <div className="border border-base-300 rounded-xl overflow-hidden">
      <button
        className={`w-full flex items-center gap-3 px-4 py-3 bg-base-100 ${hoverBg} transition-colors text-left`}
        onClick={onToggle}
      >
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-base-200"
            onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
        ) : null}
        <span
          className={`text-xl leading-none flex-shrink-0 ${item.image ? 'hidden' : 'flex'} items-center justify-center w-10 h-10`}
          style={{ display: item.image ? 'none' : undefined }}
        >
          {item.icon}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-base-content">{item.name}</span>
          {item.badge && (
            <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full font-medium ${badgeCls}`}>{item.badge}</span>
          )}
        </div>
        <span className={`text-base-content/40 transition-transform duration-200 text-lg leading-none flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {isOpen && (
        <div className={`border-t border-base-200 ${expandedBg}`}>
          {item.image && (
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-44 object-cover"
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          )}
          <div className="px-4 py-3 space-y-3">
            <DetailRow label="원인/발생 조건" text={item.cause} />
            <DetailRow label={symptomLabel} text={item.symptoms} />
            <DetailRow label="즉시 대처" text={item.immediate} highlight />
            <DetailRow label="예방 관리" text={item.prevention} />
            <DetailRow label="농약 원칙" text={item.pesticide} />
          </div>
        </div>
      )}
    </div>
  );
};

const DiseaseCard = (props) => <PestCard {...props} accentColor="red" />;
const InsectCard = (props) => <PestCard {...props} accentColor="teal" />;

// ──────────────── 메인 컴포넌트 ────────────────

const PestDiseaseInfo = () => {
  const [openCard, setOpenCard] = useState(null);

  const toggleCard = (id) => {
    setOpenCard(prev => (prev === id ? null : id));
  };

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-2">
      {/* 헤더 */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-base-content">참외 병충해 관리</h2>
        <p className="text-sm text-base-content/60 mt-1">농촌진흥청 농업기술길잡이 105 기반</p>
      </div>

      {/* 공통 원칙 */}
      <Section title="공통 원칙">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2">
          {COMMON_PRINCIPLES.map((p) => (
            <div key={p.num} className="flex items-start gap-2">
              <span className="flex-shrink-0 w-5 h-5 bg-amber-400 text-white text-xs font-bold rounded-full flex items-center justify-center mt-0.5">
                {p.num}
              </span>
              <p className="text-sm text-base-content/80">{p.text}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 병해 섹션 */}
      <Section title="병해 (질병)">
        <div className="space-y-2">
          {DISEASES.map((item) => (
            <DiseaseCard
              key={item.id}
              item={item}
              isOpen={openCard === item.id}
              onToggle={() => toggleCard(item.id)}
            />
          ))}
        </div>
      </Section>

      {/* 해충 섹션 */}
      <Section title="해충">
        <div className="space-y-2">
          {PESTS.map((item) => (
            <InsectCard
              key={item.id}
              item={item}
              isOpen={openCard === item.id}
              onToggle={() => toggleCard(item.id)}
            />
          ))}
        </div>
      </Section>

      {/* 농약 사용법 */}
      <Section title="농약 사용법 (실무)">
        <div className="space-y-3">
          {PESTICIDE_TIPS.map((tip) => (
            <div key={tip.num} className="bg-base-200 border border-base-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-base-content mb-2">
                <span className="text-teal-600 mr-1">{tip.num}.</span>{tip.title}
              </p>
              <ul className="space-y-1">
                {tip.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-base-content/80">
                    <span className="text-teal-500 mt-0.5 flex-shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* 법·준수사항 */}
      <Section title="농약 관련 법·준수사항">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
          <p className="text-sm text-base-content/80">농약관리법 및 농촌진흥청 고시 기준 준수</p>
          <p className="text-sm text-base-content/80">
            <span className="font-semibold">PLS(농약허용물질목록관리제도)</span>: 등록된 작물·병해충·사용기준 외 사용 금지.
            미준수 시 잔류허용기준 위반으로 출하 제한/행정조치 가능.
          </p>
          <div className="pt-1 flex flex-wrap gap-2">
            <a
              href="https://psis.rda.go.kr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-lg font-medium hover:bg-blue-500/25 transition-colors"
            >
              PSIS 농약안전정보시스템 →
            </a>
            <a
              href="https://www.nongsaro.go.kr/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 bg-green-500/15 text-green-600 dark:text-green-400 rounded-lg font-medium hover:bg-green-500/25 transition-colors"
            >
              농사로 →
            </a>
          </div>
        </div>
      </Section>
    </div>
  );
};

export default PestDiseaseInfo;
