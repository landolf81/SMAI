import React from 'react';
import PolicyIcon from '@mui/icons-material/Policy';
import ShieldIcon from '@mui/icons-material/Shield';
import WarningIcon from '@mui/icons-material/Warning';
import GavelIcon from '@mui/icons-material/Gavel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

const TradingPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 pt-14 pb-20">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <PolicyIcon style={{ fontSize: 48 }} className="mb-2" />
          <h1 className="text-2xl font-bold mb-2">거래 정책</h1>
          <p className="text-purple-50">안전한 거래를 위한 가이드라인</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* 안전 거래 원칙 */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-purple-600 rounded-full"></div>
            <ShieldIcon className="text-purple-600" />
            <h2 className="text-xl font-bold text-gray-800">안전 거래 원칙</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">직거래 권장</h3>
                <p className="text-gray-600 text-sm">
                  가급적 안전한 장소에서 직접 만나 물품을 확인하고 거래하세요.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">공개된 장소에서 거래</h3>
                <p className="text-gray-600 text-sm">
                  CCTV가 설치된 카페, 농협, 주민센터 등 공개된 장소를 이용하세요.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">물품 상태 확인</h3>
                <p className="text-gray-600 text-sm">
                  거래 전 반드시 물품의 상태를 직접 확인하고 테스트하세요.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircleIcon className="text-green-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">현장 결제</h3>
                <p className="text-gray-600 text-sm">
                  물품 인수와 동시에 현장에서 결제하는 것을 원칙으로 하세요.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 주의사항 */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
            <WarningIcon className="text-orange-500" />
            <h2 className="text-xl font-bold text-gray-800">주의사항</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">선입금 거래 금지</h3>
                <p className="text-gray-600 text-sm">
                  물품을 확인하기 전에 절대 선입금하지 마세요. 사기 피해의 주요 원인입니다.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">개인정보 보호</h3>
                <p className="text-gray-600 text-sm">
                  불필요한 개인정보(주민번호, 계좌비밀번호 등)를 요구하는 경우 주의하세요.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">의심스러운 저가 상품</h3>
                <p className="text-gray-600 text-sm">
                  시세보다 지나치게 저렴한 상품은 사기일 가능성이 높으니 주의하세요.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-1" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800">택배 거래 시 주의</h3>
                <p className="text-gray-600 text-sm">
                  부득이하게 택배 거래 시 안전결제 서비스를 이용하고, 물품 수령 후 검수하세요.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 금지 품목 */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-red-600 rounded-full"></div>
            <GavelIcon className="text-red-600" />
            <h2 className="text-xl font-bold text-gray-800">거래 금지 품목</h2>
          </div>
          <div className="bg-red-50 rounded-lg p-4 mb-4">
            <p className="text-red-800 text-sm font-medium mb-2">
              아래 품목은 법률에 의해 거래가 금지되거나 제한됩니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">불법 복제품</h3>
                <p className="text-gray-600 text-xs">위조품, 모조품, 불법 복제 소프트웨어</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">의약품</h3>
                <p className="text-gray-600 text-xs">전문의약품, 한약재 등 허가받지 않은 의약품</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">불법 개조 물품</h3>
                <p className="text-gray-600 text-xs">안전인증 없는 개조 전기제품 등</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">위험물</h3>
                <p className="text-gray-600 text-xs">폭발물, 화약류, 유해화학물질</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">음란물</h3>
                <p className="text-gray-600 text-xs">음란물, 성인용품(일부)</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">야생동물 및 부산물</h3>
                <p className="text-gray-600 text-xs">멸종위기종, 야생동물 및 그 부산물</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">도난·분실 물품</h3>
                <p className="text-gray-600 text-xs">도난당하거나 습득한 물품</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <CancelIcon className="text-red-500 flex-shrink-0 mt-0.5" fontSize="small" />
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">기타 불법 물품</h3>
                <p className="text-gray-600 text-xs">법률로 거래가 금지된 모든 물품</p>
              </div>
            </div>
          </div>
        </section>

        {/* 사기 예방 */}
        <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
            <ShieldIcon className="text-blue-600" />
            <h2 className="text-xl font-bold text-gray-800">사기 예방 체크리스트</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <input type="checkbox" className="checkbox checkbox-primary" disabled />
              <span className="text-gray-700 text-sm">판매자의 프로필과 거래 이력을 확인했나요?</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <input type="checkbox" className="checkbox checkbox-primary" disabled />
              <span className="text-gray-700 text-sm">상품 사진이 실제 촬영한 것인지 확인했나요?</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <input type="checkbox" className="checkbox checkbox-primary" disabled />
              <span className="text-gray-700 text-sm">거래 장소는 안전한 공개된 장소인가요?</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <input type="checkbox" className="checkbox checkbox-primary" disabled />
              <span className="text-gray-700 text-sm">판매자가 선입금을 요구하지 않나요?</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <input type="checkbox" className="checkbox checkbox-primary" disabled />
              <span className="text-gray-700 text-sm">상품 가격이 시세에 비해 적정한가요?</span>
            </div>
          </div>
        </section>

        {/* 신고 안내 */}
        <section className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <WarningIcon style={{ fontSize: 32 }} />
            <h2 className="text-xl font-bold">의심스러운 거래 신고</h2>
          </div>
          <p className="text-amber-50 mb-4">
            사기가 의심되거나 금지 품목 거래를 발견한 경우, 즉시 신고해주세요.
          </p>
          <div className="bg-white/20 rounded-lg p-4">
            <p className="text-sm mb-2">
              <strong>신고 방법:</strong>
            </p>
            <ul className="text-sm space-y-1 text-amber-50">
              <li>• 게시글 우측 상단 ... 메뉴에서 "신고하기" 선택</li>
              <li>• 신고 사유를 상세히 작성</li>
              <li>• 증거 자료(스크린샷, 대화 내용 등) 첨부</li>
            </ul>
          </div>
          <p className="text-xs text-amber-100 mt-4">
            * 신고된 내용은 운영진이 검토 후 조치합니다. 허위 신고 시 이용이 제한될 수 있습니다.
          </p>
        </section>

        {/* 책임 제한 */}
        <section className="bg-gray-100 rounded-lg p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">책임의 제한</h2>
          <div className="text-sm text-gray-600 space-y-2">
            <p>
              • 성주마이는 회원 간 거래를 중개하는 플랫폼으로, 직접적인 거래 당사자가 아닙니다.
            </p>
            <p>
              • 거래로 인한 분쟁, 손해, 피해 등에 대해 성주마이는 법적 책임을 지지 않습니다.
            </p>
            <p>
              • 모든 거래는 회원 간의 자유로운 의사에 따라 진행되며, 그에 대한 책임은 거래 당사자에게 있습니다.
            </p>
            <p>
              • 사기 피해 발생 시 즉시 경찰(112) 또는 사이버범죄신고시스템(police.go.kr)에 신고하시기 바랍니다.
            </p>
          </div>
        </section>

        {/* 문의 안내 */}
        <div className="text-center bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <PolicyIcon className="mx-auto text-purple-600 mb-3" style={{ fontSize: 40 }} />
          <h3 className="text-lg font-bold text-gray-800 mb-2">거래 정책 관련 문의</h3>
          <p className="text-gray-600 mb-4">
            거래 정책에 대해 궁금한 점이 있으신가요?
          </p>
          <button
            onClick={() => window.location.href = '/qna'}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-medium rounded-lg hover:shadow-md transition-all"
          >
            QnA에서 질문하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default TradingPolicy;
