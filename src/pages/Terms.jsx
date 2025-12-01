import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const Terms = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="flex items-center p-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="ml-2 text-lg font-semibold">이용약관</h1>
        </div>
      </div>

      {/* 내용 */}
      <div className="max-w-3xl mx-auto p-4">
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제1조 (목적)</h2>
            <p className="text-gray-600">
              이 약관은 [서비스명](이하 "서비스")이 제공하는 농업 커뮤니티 서비스의
              이용조건 및 절차, 회원과 서비스 간의 권리, 의무, 책임사항 등을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제2조 (정의)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>"서비스"란 회원이 이용할 수 있는 농업 정보 공유, 커뮤니티, 중고거래, Q&A 등 모든 서비스를 의미합니다.</li>
              <li>"회원"이란 서비스에 가입하여 이용자 아이디(ID)를 부여받은 자를 의미합니다.</li>
              <li>"게시물"이란 회원이 서비스에 게시한 글, 사진, 댓글 등 모든 콘텐츠를 의미합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제3조 (약관의 효력 및 변경)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>본 약관은 서비스를 이용하고자 하는 모든 회원에게 적용됩니다.</li>
              <li>서비스는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 공지사항을 통해 안내합니다.</li>
              <li>변경된 약관에 동의하지 않을 경우 회원은 탈퇴할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제4조 (회원가입)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>회원가입은 카카오 계정을 통한 소셜 로그인으로 진행됩니다.</li>
              <li>회원은 본 약관 및 개인정보 처리방침에 동의해야 합니다.</li>
              <li>만 14세 미만은 서비스를 이용할 수 없습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제5조 (회원의 의무)</h2>
            <p className="text-gray-600 mb-2">회원은 다음 행위를 하여서는 안 됩니다.</p>
            <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
              <li>타인의 정보 도용</li>
              <li>서비스 운영을 방해하는 행위</li>
              <li>타인의 명예를 훼손하거나 불이익을 주는 행위</li>
              <li>음란물, 불법 정보의 게시</li>
              <li>영리 목적의 광고 게시 (승인 없이)</li>
              <li>기타 법령에 위반되는 행위</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제6조 (서비스의 제공 및 변경)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>서비스는 연중무휴, 24시간 제공을 원칙으로 합니다.</li>
              <li>서비스는 운영상 필요에 따라 서비스 내용을 변경할 수 있습니다.</li>
              <li>시스템 점검, 장애 등으로 서비스가 일시 중단될 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제7조 (게시물의 관리)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>회원이 작성한 게시물의 저작권은 해당 회원에게 있습니다.</li>
              <li>서비스는 다음에 해당하는 게시물을 사전 통보 없이 삭제할 수 있습니다.
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>법령 위반 게시물</li>
                  <li>타인의 권리를 침해하는 게시물</li>
                  <li>음란물 또는 불건전한 게시물</li>
                  <li>상업적 광고 게시물</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제8조 (중고거래)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>서비스는 회원 간 중고거래를 위한 플랫폼을 제공합니다.</li>
              <li>거래 당사자 간의 분쟁에 대해 서비스는 책임을 지지 않습니다.</li>
              <li>허위 매물 등록, 사기 행위 등은 이용 제한 사유가 됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제9조 (회원 탈퇴 및 자격 상실)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>회원은 언제든지 탈퇴를 요청할 수 있습니다.</li>
              <li>다음의 경우 서비스는 회원 자격을 제한 또는 상실시킬 수 있습니다.
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>가입 시 허위 내용 등록</li>
                  <li>타인의 서비스 이용 방해</li>
                  <li>법령 또는 본 약관 위반</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제10조 (면책조항)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>서비스는 천재지변 등 불가항력으로 인한 서비스 중단에 책임을 지지 않습니다.</li>
              <li>회원의 귀책사유로 인한 손해에 대해 책임을 지지 않습니다.</li>
              <li>회원 간 또는 회원과 제3자 간의 분쟁에 대해 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">제11조 (분쟁해결)</h2>
            <ul className="list-decimal list-inside text-gray-600 space-y-2">
              <li>서비스와 회원 간 분쟁이 발생할 경우 상호 협의하여 해결합니다.</li>
              <li>협의가 되지 않을 경우 관할 법원에 소를 제기할 수 있습니다.</li>
            </ul>
          </section>

          <div className="pt-4 border-t text-sm text-gray-500">
            <p>시행일: 2024년 ○월 ○일</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
