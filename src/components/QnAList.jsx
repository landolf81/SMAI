import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { useNavigationType } from 'react-router-dom';
import { qnaService, adService } from '../services';
import { useScrollRestore } from '../hooks/useScrollRestore';
import QnADetail from './QnADetail';
import moment from 'moment';
import 'moment/locale/ko';
import MobileAdDisplay from './MobileAdDisplay';
import { isMobileDevice } from '../utils/deviceDetector';
import ProfileModal from './ProfileModal';

// 아이콘
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';

moment.locale('ko');

const QnAList = ({ hubMode = false, activeTab = 'qna' }) => {
  const navigationType = useNavigationType();
  const [searchTerm, setSearchTerm] = useState(''); // 검색어 (외부에서 설정)
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [isMobile] = useState(() => isMobileDevice());
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);

  // 순차적 렌더링을 위한 상태
  const [renderedCount, setRenderedCount] = useState(0);
  const renderIntervalRef = useRef(null);

  // 프로필 모달 상태
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);

  // 스크롤 위치 복원 (statusFilter와 searchTerm별로 개별 관리)
  // hubMode일 때는 CommunityHub가 스크롤 관리하므로 비활성화
  useScrollRestore('qna', statusFilter, searchTerm, null, !hubMode);

  // 모달 ref
  const modalRef = useRef(null);

  // 모달 열릴 때 배경 스크롤 막기 및 최상단 이동
  useEffect(() => {
    if (selectedQuestionId) {
      // 모달이 열리면 body 스크롤 막기
      document.body.style.overflow = 'hidden';
      // 모달 최상단으로 스크롤
      if (modalRef.current) {
        modalRef.current.scrollTo({ top: 0, behavior: 'instant' });
      }
    } else {
      // 모달이 닫히면 body 스크롤 복원
      document.body.style.overflow = 'unset';
    }

    // 컴포넌트 언마운트 시 정리
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedQuestionId]);

  // QnA 질문 목록 조회
  const { data, isLoading, error } = useQuery({
    queryKey: ['qna-questions', page, statusFilter, searchTerm],
    queryFn: () =>
      qnaService.getQuestions({
        offset: page * 20,
        limit: 20,
        status: statusFilter,
        search: searchTerm
      }),
    keepPreviousData: true
  });

  // 인기 질문 조회 (최근 7일, 3개)
  const { data: trending } = useQuery({
    queryKey: ['qna-trending'],
    queryFn: () => qnaService.getTrendingQuestions(3),
    staleTime: 10 * 60 * 1000 // 10분
  });

  // 광고 조회 (모바일에서만)
  const { data: adsData } = useQuery({
    queryKey: ['active-ads'],
    queryFn: adService.getActiveAds,
    enabled: isMobile,
    staleTime: 5 * 60 * 1000 // 5분
  });

  // 질문 목록에 광고 삽입 (useMemo는 early return 전에 와야 함)
  const questions = data?.questions || [];
  const pagination = data?.pagination || {};

  const questionsWithAds = useMemo(() => {
    const result = [];
    const ads = adsData || [];

    if (ads.length === 0) {
      return questions.map((question, index) => ({ type: 'question', data: question, key: `question-${question.id}-${index}` }));
    }

    let adCounter = 0;

    questions.forEach((question, index) => {
      result.push({ type: 'question', data: question, key: `question-${question.id}-${index}` });

      // 3개마다 광고 삽입
      if ((index + 1) % 3 === 0 && ads.length > 0) {
        const ad = ads[adCounter % ads.length];
        if (ad && ad.id) {
          result.push({
            type: 'ad',
            data: ad,
            key: `ad-${ad.id}-${adCounter}`
          });
          adCounter++;
        }
      }
    });

    // 게시글이 3개 미만이고 광고가 하나도 삽입되지 않았다면 마지막에 광고 추가
    if (questions.length > 0 && questions.length < 3 && ads.length > 0 && adCounter === 0) {
      const ad = ads[0];
      if (ad && ad.id) {
        result.push({
          type: 'ad',
          data: ad,
          key: `ad-${ad.id}-last`
        });
      }
    }

    return result;
  }, [questions, adsData]);

  // 순차적 렌더링: 데이터 로드 후 아이템을 위에서부터 순서대로 표시
  useEffect(() => {
    // 로딩 중이거나 데이터가 없으면 스킵
    if (isLoading || !questionsWithAds.length) {
      setRenderedCount(0);
      return;
    }

    // 뒤로가기(POP)일 때는 즉시 모두 표시
    if (navigationType === 'POP') {
      setRenderedCount(questionsWithAds.length);
      return;
    }

    // 이미 모두 렌더링 완료된 경우
    if (renderedCount >= questionsWithAds.length) {
      return;
    }

    // 기존 인터벌 정리
    if (renderIntervalRef.current) {
      clearInterval(renderIntervalRef.current);
    }

    // 첫 번째 아이템 즉시 표시
    if (renderedCount === 0) {
      setRenderedCount(1);
    }

    // 나머지 아이템 순차적 표시 (50ms 간격)
    renderIntervalRef.current = setInterval(() => {
      setRenderedCount(prev => {
        if (prev >= questionsWithAds.length) {
          clearInterval(renderIntervalRef.current);
          return prev;
        }
        return prev + 1;
      });
    }, 50);

    return () => {
      if (renderIntervalRef.current) {
        clearInterval(renderIntervalRef.current);
      }
    };
  }, [isLoading, questionsWithAds.length, navigationType]);

  // IntersectionObserver 제거 - CSS 애니메이션으로 대체하여 스크롤 성능 향상

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open':
        return <QuestionMarkIcon className="text-blue-500" fontSize="small" />;
      case 'answered':
        return <ChatBubbleOutlineIcon className="text-yellow-500" fontSize="small" />;
      case 'closed':
        return <CheckCircleIcon className="text-green-500" fontSize="small" />;
      default:
        return <QuestionMarkIcon className="text-gray-400" fontSize="small" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'open':
        return '답변대기';
      case 'answered':
        return '답변완료';
      case 'closed':
        return '해결됨';
      default:
        return '알 수 없음';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'open':
        return 'text-blue-600 bg-blue-50';
      case 'answered':
        return 'text-yellow-600 bg-yellow-50';
      case 'closed':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="loading loading-spinner loading-lg"></div>
        <span className="ml-3">질문을 불러오는 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">질문을 불러오는데 실패했습니다.</p>
        <p className="text-gray-500 text-sm mt-2">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pt-2">
      <div className="p-4">

      {/* 인기 질문 (최상단) - 타이틀만 표시 */}
      {trending && trending.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 mb-6 border border-yellow-200">
          <p className="flex items-center gap-2 text-base font-bold text-gray-900 mb-2">
            <span>🔥</span> 인기 질문 <span className="text-xs text-gray-500 font-normal">(최근 7일)</span>
          </p>
          {trending.map((question, index) => (
            <p
              key={question.id}
              className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-white/50 rounded px-2 -mx-2"
              onClick={() => setSelectedQuestionId(question.id)}
            >
              <span className="w-5 h-5 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{index + 1}</span>
              <span className="text-base text-gray-800 line-clamp-1">{question.title}</span>
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {/* 메인 질문 목록 */}
        <div>
          {/* 질문 목록 */}
          <div className="space-y-4">
            {questionsWithAds.length > 0 && (
              questionsWithAds.slice(0, renderedCount).map((item, index) => {
                if (item.type === 'ad') {
                  return (
                    <div
                      key={item.key}
                      style={{
                        animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none',
                        animationDelay: navigationType !== 'POP' ? `${index * 30}ms` : '0ms',
                        opacity: navigationType !== 'POP' ? 0 : 1
                      }}
                    >
                      <MobileAdDisplay ad={item.data} />
                    </div>
                  );
                }

                const question = item.data;
                return (
                  <div
                    key={item.key}
                    className={`rounded-lg p-6 border shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                      question.question_status === 'closed' ? 'bg-green-50/30' :
                      question.question_status === 'answered' ? 'bg-yellow-50/30' :
                      'bg-blue-50/30'
                    }`}
                    style={{
                      animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none',
                      animationDelay: navigationType !== 'POP' ? `${index * 30}ms` : '0ms',
                      opacity: navigationType !== 'POP' ? 0 : 1
                    }}
                    onClick={() => setSelectedQuestionId(question.id)}
                  >
                  <div className="flex items-start gap-4">
                    {/* 질문 내용 */}
                    <div className="flex-1 min-w-0">
                      {/* 최상단: 프로필과 상태 배지 */}
                      <div className="flex items-center justify-between mb-3">
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProfileUser({
                              userId: question.user_id,
                              user_id: question.user_id,
                              id: question.user_id,
                              name: question.user_name || question.username,
                              username: question.username,
                              profilePic: question.profilePic,
                              profile_pic: question.profilePic
                            });
                            setShowProfileModal(true);
                          }}
                        >
                          <img
                            src={question.profilePic ?
                              (question.profilePic.startsWith('http') ? question.profilePic : `/uploads/profiles/${question.profilePic}`) :
                              '/default/default_profile.png'
                            }
                            alt={question.user_name || question.username}
                            className="w-8 h-8 rounded-full object-cover border border-gray-200"
                            onError={(e) => {
                              e.target.src = '/default/default_profile.png';
                            }}
                          />
                          <span className="text-sm font-medium text-gray-700">{question.user_name || question.username}</span>
                        </div>

                        {/* 상태 배지 (답변대기 제외) */}
                        {question.question_status !== 'open' && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(question.question_status)}`}>
                            {getStatusText(question.question_status)}
                          </span>
                        )}
                      </div>

                      {/* 제목 */}
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-2">
                        {question.title}
                      </h3>

                      {/* 질문 내용 미리보기 */}
                      <p className="text-gray-600 line-clamp-2 mb-3">
                        {question.desc}
                      </p>

                      {/* 이미지 미리보기 - 첫 번째 이미지만 표시 */}
                      {question.img && (() => {
                        // JSON 배열 파싱 처리
                        let images = [];
                        try {
                          const parsed = JSON.parse(question.img);
                          images = Array.isArray(parsed) ? parsed : [question.img];
                        } catch {
                          images = [question.img];
                        }

                        if (images.length === 0) return null;

                        return (
                          <div className="mb-3 flex justify-center">
                            <div className="relative inline-block">
                              <img
                                src={images[0]}
                                alt="첨부 이미지"
                                className="max-w-full h-auto max-h-60 object-contain rounded-lg border"
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              {/* 다중 이미지 개수 배지 */}
                              {images.length > 1 && (
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span>1/{images.length}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* 메타 정보 */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <ChatBubbleOutlineIcon fontSize="small" />
                            {question.answers_count}
                          </span>
                          <span className="flex items-center gap-1">
                            <VisibilityIcon fontSize="small" />
                            {question.views_count || 0}
                          </span>
                          {question.tag_display_name && (
                            <span
                              className="px-2 py-1 rounded text-xs"
                              style={{ backgroundColor: question.tag_color + '20', color: question.tag_color }}
                            >
                              {question.tag_display_name}
                            </span>
                          )}
                        </div>

                        {/* 시간 정보만 */}
                        <div className="text-sm text-gray-500">
                          <span>{moment(question.created_at).fromNow()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </div>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                이전
              </button>
              
              <span className="px-3 py-1 text-sm">
                {page + 1} / {pagination.totalPages}
              </span>
              
              <button
                onClick={() => setPage(Math.min(pagination.totalPages - 1, page + 1))}
                disabled={page >= pagination.totalPages - 1}
                className="px-3 py-1 text-sm border rounded disabled:opacity-50"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </div>

      </div>{/* p-4 닫기 */}

      {/* QnA 상세보기 모달 - Portal로 body에 직접 렌더링 */}
      {selectedQuestionId && createPortal(
        <div ref={modalRef} className="fixed inset-0 z-[9999] bg-white overflow-y-auto">
          {/* 헤더 - 닫기 버튼 */}
          <div className="sticky top-0 z-[10000] bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Q&A 상세</h2>
            <button
              onClick={() => setSelectedQuestionId(null)}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              title="닫기"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 콘텐츠 */}
          <QnADetail
            questionId={selectedQuestionId}
            onClose={() => setSelectedQuestionId(null)}
            isModal={true}
          />

          {/* 하단 닫기 버튼 - 콘텐츠 바로 아래 */}
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => setSelectedQuestionId(null)}
              className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              닫기
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* 프로필 모달 */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={selectedProfileUser}
      />
    </div>
  );
};

export default QnAList;