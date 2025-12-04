import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useNavigationType } from 'react-router-dom';
import { qnaService, adService } from '../services';
import { useScrollRestore } from '../hooks/useScrollRestore';
import QnADetail from './QnADetail';
import moment from 'moment';
import 'moment/locale/ko';
import MobileAdDisplay from './MobileAdDisplay';
import { isMobileDevice } from '../utils/deviceDetector';

// 아이콘
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SearchIcon from '@mui/icons-material/Search';
// FilterListIcon 제거됨 - 필터 기능 비활성화

moment.locale('ko');

const QnAList = () => {
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [isMobile] = useState(() => isMobileDevice());
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);

  // 순차적 렌더링을 위한 상태
  const [renderedCount, setRenderedCount] = useState(0);
  const renderIntervalRef = useRef(null);

  // 글쓰기 버튼 회전 애니메이션 상태
  const [isWriteButtonSpinning, setIsWriteButtonSpinning] = useState(false);

  // 스크롤 위치 복원 (statusFilter와 searchTerm별로 개별 관리)
  useScrollRestore('qna', statusFilter, searchTerm);

  // 모달 열릴 때 배경 스크롤 막기
  useEffect(() => {
    if (selectedQuestionId) {
      // 모달이 열리면 body 스크롤 막기
      document.body.style.overflow = 'hidden';
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

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0); // 검색 시 첫 페이지로 이동
  };

  const handleStatusChange = (status) => {
    setStatusFilter(status);
    setPage(0);
  };

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
    <div className="max-w-6xl mx-auto">
      {/* 고정 헤더 (검색창 포함) */}
      <div className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="p-4">
          {/* 타이틀 */}
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Q&A 질문답변</h1>
          </div>

          {/* 검색바 */}
          <form onSubmit={handleSearch}>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none z-10" fontSize="small" />
              <input
                type="text"
                placeholder=""
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-market-500 focus:border-transparent bg-white"
              />
            </div>
          </form>
        </div>
      </div>

      <div className="p-4">

      {/* 인기 질문 (최상단) */}
      {trending && trending.length > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-5 mb-6 border border-yellow-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔥</span>
            <h2 className="text-lg font-bold text-gray-900">인기 질문</h2>
            <span className="text-xs text-gray-500 ml-1">(최근 7일)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {trending.map((question, index) => (
              <div
                key={question.id}
                className="bg-white rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow border border-gray-200"
                onClick={() => setSelectedQuestionId(question.id)}
              >
                <div className="flex items-start gap-2 mb-2">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1">
                    {question.title}
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
                  <span className="flex items-center gap-1">
                    <ChatBubbleOutlineIcon fontSize="inherit" />
                    {question.answers_count}
                  </span>
                  <span className="flex items-center gap-1">
                    <VisibilityIcon fontSize="inherit" />
                    {question.views_count || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
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
                    onClick={() => setSelectedQuestionId(question.id)}
                    style={{
                      animation: navigationType !== 'POP' ? 'fadeInUp 0.3s ease-out forwards' : 'none',
                      animationDelay: navigationType !== 'POP' ? `${index * 30}ms` : '0ms',
                      opacity: navigationType !== 'POP' ? 0 : 1
                    }}
                  >
                  <div className="flex items-start gap-4">
                    {/* 질문 내용 */}
                    <div className="flex-1 min-w-0">
                      {/* 최상단: 프로필과 상태 배지 */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
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

                        {/* 상태 배지 */}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(question.question_status)}`}>
                          {getStatusText(question.question_status)}
                        </span>
                      </div>

                      {/* 제목 */}
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2 mb-2">
                        {question.title}
                      </h3>

                      {/* 질문 내용 미리보기 */}
                      <p className="text-gray-600 line-clamp-2 mb-3">
                        {question.desc}
                      </p>

                      {/* 이미지 미리보기 */}
                      {question.img && (
                        <div className="mb-3">
                          <img
                            src={question.img}
                            alt="첨부 이미지"
                            className="max-w-full h-auto max-h-60 object-contain rounded-lg border"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

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

      {/* QnA 상세보기 모달 */}
      {selectedQuestionId && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={() => setSelectedQuestionId(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto relative"
            onClick={(e) => e.stopPropagation()}
          >
            <QnADetail
              questionId={selectedQuestionId}
              onClose={() => setSelectedQuestionId(null)}
              isModal={true}
            />
          </div>
        </div>
      )}

      {/* 플로팅 글쓰기 버튼 (모바일용) */}
      {isMobile && (
        <button
          onClick={() => {
            if (isWriteButtonSpinning) return;
            setIsWriteButtonSpinning(true);
            setTimeout(() => {
              navigate('/post/new?type=qna');
            }, 300);
          }}
          className="fixed bottom-20 right-4 w-14 h-14 text-white rounded-full transition-all duration-200 hover:scale-110 z-10 flex items-center justify-center border-2 border-white"
          style={{
            background: 'linear-gradient(135deg, #FFCC00 0%, #06b6d4 100%)',
            boxShadow: '0 4px 15px rgba(255, 204, 0, 0.4), 0 8px 25px rgba(6, 182, 212, 0.3)'
          }}
          title="질문하기"
        >
          <svg
            className="w-6 h-6 transition-transform duration-300"
            style={{ transform: isWriteButtonSpinning ? 'rotate(180deg)' : 'rotate(0deg)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default QnAList;