import React, { useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqData = [
    {
      category: '서비스 이용',
      items: [
        {
          question: '참외이야기는 어떤 서비스인가요?',
          answer: '참외이야기는 성주군 농업인을 위한 종합 커뮤니티 플랫폼입니다. 경락 정보 조회, 커뮤니티 소통, QnA 등 다양한 기능을 제공합니다.'
        },
        {
          question: '회원가입은 어떻게 하나요?',
          answer: '카카오톡 계정으로 간편하게 가입할 수 있습니다. 로그인 버튼을 클릭한 후 카카오 로그인을 진행해주세요.'
        },
        {
          question: '로그인이 안 돼요.',
          answer: '카카오톡 앱이 설치되어 있는지 확인해주세요. 문제가 지속되면 카카오톡 앱을 최신 버전으로 업데이트하거나, 잠시 후 다시 시도해주세요.'
        }
      ]
    },
    {
      category: '경락 정보',
      items: [
        {
          question: '경락 정보는 어디서 확인하나요?',
          answer: '홈 화면에서 날짜를 선택하시면 해당 날짜의 경락 정보를 확인할 수 있습니다. 품종별, 등급별로 상세한 가격 정보를 제공합니다.'
        },
        {
          question: '경락 정보는 언제 업데이트되나요?',
          answer: '경락 정보는 매일 오전 11시 30분부터 순차적으로 업데이트됩니다.'
        },
        {
          question: '과거 경락 정보도 볼 수 있나요?',
          answer: '네, 날짜 선택기에서 과거 날짜를 선택하시면 해당 날짜의 경락 정보를 확인할 수 있습니다.'
        }
      ]
    },
    {
      category: '커뮤니티',
      items: [
        {
          question: '게시글은 어떻게 작성하나요?',
          answer: '커뮤니티 페이지 하단의 + 버튼을 클릭하여 글쓰기를 선택하시면 됩니다. 사진과 동영상도 함께 업로드할 수 있습니다.'
        },
        {
          question: '게시글을 수정하거나 삭제할 수 있나요?',
          answer: '본인이 작성한 게시글은 게시글 우측 상단의 ... 메뉴에서 수정 또는 삭제할 수 있습니다.'
        },
        {
          question: '부적절한 게시글을 신고하고 싶어요.',
          answer: '게시글 우측 상단의 ... 메뉴에서 "신고하기"를 선택하여 신고 사유를 작성해주시면 운영진이 검토 후 조치합니다.'
        }
      ]
    },
    {
      category: 'QnA',
      items: [
        {
          question: 'QnA는 어떻게 사용하나요?',
          answer: 'QnA 페이지에서 질문을 작성하시면 다른 회원들이 답변을 달아줍니다. 농업 관련 궁금한 점을 자유롭게 물어보세요.'
        },
        {
          question: '답변은 어떻게 작성하나요?',
          answer: '질문 상세 페이지 하단의 "답변 작성" 버튼을 클릭하여 답변을 작성할 수 있습니다. 사진도 첨부할 수 있습니다.'
        },
        {
          question: '내가 작성한 질문/답변을 수정할 수 있나요?',
          answer: '네, 본인이 작성한 질문이나 답변은 우측의 ... 메뉴에서 수정하거나 삭제할 수 있습니다.'
        }
      ]
    },
    {
      category: '계정 및 설정',
      items: [
        {
          question: '프로필은 어떻게 수정하나요?',
          answer: '우측 상단의 프로필 아이콘을 클릭한 후 "프로필 수정"을 선택하시면 됩니다.'
        },
        {
          question: '다른 기기에서도 로그인할 수 있나요?',
          answer: '네, 같은 카카오 계정으로 로그인하시면 다른 기기에서도 이용 가능합니다.'
        },
        {
          question: '회원 탈퇴는 어떻게 하나요?',
          answer: '설정 페이지 하단의 "회원 탈퇴"를 선택하시면 됩니다. 탈퇴 시 모든 데이터가 삭제되며 복구할 수 없으니 신중히 결정해주세요.'
        }
      ]
    }
  ];

  const toggleItem = (categoryIndex, itemIndex) => {
    const key = `${categoryIndex}-${itemIndex}`;
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-14 pb-20">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white py-8 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <HelpOutlineIcon style={{ fontSize: 48 }} className="mb-2" />
          <h1 className="text-2xl font-bold mb-2">자주 묻는 질문</h1>
          <p className="text-amber-50">참외 이야기 이용에 대한 궁금증을 해결해드립니다</p>
        </div>
      </div>

      {/* FAQ 리스트 */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {faqData.map((category, categoryIndex) => (
          <div key={categoryIndex} className="mb-8">
            {/* 카테고리 제목 */}
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <div className="w-1 h-6 bg-amber-500 rounded-full"></div>
              {category.category}
            </h2>

            {/* 질문 리스트 */}
            <div className="space-y-2">
              {category.items.map((item, itemIndex) => {
                const key = `${categoryIndex}-${itemIndex}`;
                const isOpen = openIndex === key;

                return (
                  <div
                    key={itemIndex}
                    className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-100"
                  >
                    {/* 질문 */}
                    <button
                      onClick={() => toggleItem(categoryIndex, itemIndex)}
                      className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-amber-500 font-bold flex-shrink-0 mt-0.5">Q.</span>
                        <span className="text-gray-800 font-medium">{item.question}</span>
                      </div>
                      {isOpen ? (
                        <ExpandLessIcon className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <ExpandMoreIcon className="text-gray-400 flex-shrink-0" />
                      )}
                    </button>

                    {/* 답변 */}
                    {isOpen && (
                      <div className="px-4 pb-4 pt-2 bg-amber-50/30 border-t border-gray-100 animate-fade-in-up">
                        <div className="flex items-start gap-3">
                          <span className="text-blue-500 font-bold flex-shrink-0">A.</span>
                          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* 추가 문의 안내 */}
        <div className="mt-12 bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center">
          <HelpOutlineIcon className="text-amber-500 mb-3" style={{ fontSize: 40 }} />
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            더 궁금한 점이 있으신가요?
          </h3>
          <p className="text-gray-600 mb-4">
            QnA 게시판에서 질문하시면 커뮤니티 회원들이 답변해드립니다
          </p>
          <button
            onClick={() => window.location.href = '/qna'}
            className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-medium rounded-lg hover:shadow-md transition-all"
          >
            QnA 게시판 바로가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
