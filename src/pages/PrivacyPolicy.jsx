import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cloud-dancer pt-14">
      {/* 내용 */}
      <div className="max-w-3xl mx-auto p-4 pb-20">
        {/* 헤더 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex items-center">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full"
          >
            <ArrowBackIcon />
          </button>
          <h1 className="ml-2 text-lg font-semibold">개인정보 처리방침</h1>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">

          <section>
            <p className="text-gray-600 mb-4">
              참외이야기(이하 "서비스")는 이용자의 개인정보를 중요시하며,
              「개인정보 보호법」을 준수합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">1. 수집하는 개인정보 항목</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>카카오 계정 연동 시: 회원번호(식별자), 닉네임, 프로필 사진</li>
              <li>서비스 이용 시: 작성 게시물, 댓글, 좋아요 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">2. 개인정보 수집 목적</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>회원 식별 및 서비스 제공</li>
              <li>커뮤니티 활동 (게시글, 댓글 작성)</li>
              <li>서비스 개선 및 통계 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">3. 개인정보 보유 및 이용 기간</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>회원 탈퇴 시까지</li>
              <li>단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li>전자상거래법: 계약/청약철회 기록 5년, 소비자 불만 기록 3년</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">4. 개인정보의 제3자 제공</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>원칙적으로 제3자에게 제공하지 않습니다.</li>
              <li>예외: 법령에 의한 요청, 이용자 동의</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">5. 개인정보의 처리 위탁</h2>
            <p className="text-gray-600 mb-2">서비스 제공을 위해 아래와 같이 개인정보를 위탁합니다.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-4 py-2 text-left">수탁업체</th>
                    <th className="border px-4 py-2 text-left">위탁 업무</th>
                    <th className="border px-4 py-2 text-left">보관 국가</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-4 py-2">Supabase Inc.</td>
                    <td className="border px-4 py-2">데이터베이스 호스팅, 인증</td>
                    <td className="border px-4 py-2">미국</td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-2">Vercel Inc.</td>
                    <td className="border px-4 py-2">웹사이트 호스팅, CDN</td>
                    <td className="border px-4 py-2">미국</td>
                  </tr>
                  <tr>
                    <td className="border px-4 py-2">Cloudflare Inc.</td>
                    <td className="border px-4 py-2">CDN, 동영상 스트리밍</td>
                    <td className="border px-4 py-2">미국</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">6. 이용자의 권리</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>개인정보 열람, 정정, 삭제, 처리정지 요청 가능</li>
              <li>회원 탈퇴를 통해 개인정보 삭제 가능</li>
              <li>요청 방법: landolf@naver.com 또는 앱 내 문의</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">7. 개인정보 보호책임자</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>담당자: 정병근</li>
              <li>연락처: landolf@naver.com</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">8. 개인정보 처리방침 변경</h2>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>본 방침은 2025년 1월 1일부터 적용됩니다.</li>
              <li>변경 시 공지사항을 통해 안내합니다.</li>
            </ul>
          </section>

          <div className="pt-4 border-t text-sm text-gray-500">
            <p>시행일: 2025년 1월 1일</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
