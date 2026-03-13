/**
 * VinylInfo 컴포넌트
 * 역할: 참외 재배용 비닐 종류 소개
 */

const Section = ({ title, children }) => (
  <section className="mb-6">
    <h3 className="text-base font-bold text-base-content border-l-4 border-teal-500 pl-3 mb-3">{title}</h3>
    {children}
  </section>
);

const VinylInfo = () => {
  return (
    <div className="max-w-3xl mx-auto p-4 space-y-2">
      {/* 헤더 */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-base-content">참외 재배용 비닐 종류</h2>
      </div>

      {/* 필름 종류 */}
      <Section title="필름 종류별 특징">
        <div className="overflow-x-auto rounded-xl border border-base-300">
          <table className="w-full text-sm">
            <thead className="bg-teal-500/10 text-base-content/80">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">종류</th>
                <th className="px-3 py-2.5 text-left font-semibold">장점</th>
                <th className="px-3 py-2.5 text-left font-semibold">단점</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-200">
              {[
                {
                  type: 'PE',
                  pro: '가격 저렴, 구하기 쉬움',
                  con: '보온/내구/방적 성능 낮음',
                },
                {
                  type: 'EVA',
                  pro: 'PE보다 보온·방적·연신성 개선',
                  con: 'PE보다 비쌈',
                },
                {
                  type: 'PO (장기성)',
                  pro: '투광/보온/내구 균형 우수, 장기 사용 유리',
                  con: '초기비용 높음',
                },
                {
                  type: '기능성 다층필름',
                  pro: 'IR보온, 방적/방무, 방진, 연광 등 기능 선택 가능',
                  con: '제품별 성능 편차 큼',
                },
              ].map((row) => (
                <tr key={row.type} className="hover:bg-base-200">
                  <td className="px-3 py-2.5 font-semibold text-teal-700 whitespace-nowrap">{row.type}</td>
                  <td className="px-3 py-2.5 text-base-content/80">{row.pro}</td>
                  <td className="px-3 py-2.5 text-base-content/60">{row.con}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 주요 기능 설명 */}
      <Section title="비닐 주요 기능">
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '🌡️', name: 'IR(보온)', desc: '야간 열손실 저감' },
            { icon: '💧', name: '방적/방무', desc: '결로 물방울 억제' },
            { icon: '☀️', name: 'UV 안정성', desc: '필름 열화(균열/탈색) 지연' },
            { icon: '🌿', name: '광확산(연광)', desc: '식물체 내부 광분포 개선' },
          ].map((f) => (
            <div key={f.name} className="flex items-start gap-2 bg-base-200 rounded-xl p-3 border border-base-200">
              <span className="text-lg leading-none mt-0.5">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-base-content">{f.name}</p>
                <p className="text-sm text-base-content/80">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default VinylInfo;
