import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postService, commentService } from '../../services';
import ArticleIcon from "@mui/icons-material/Article";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import PushPinIcon from "@mui/icons-material/PushPin";
import CommentIcon from "@mui/icons-material/Comment";
import PersonIcon from "@mui/icons-material/Person";
import BlockIcon from "@mui/icons-material/Block";
import { AdminOnly } from '../../components/PermissionComponents';
import { SUPABASE_URL } from '../../config/supabase';
import CloudflareStreamPlayer from '../../components/CloudflareStreamPlayer';
import { isCloudflareStreamUrl } from '../../utils/mediaUtils';

const AdminPosts = () => {
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showCommentsSection, setShowCommentsSection] = useState(true);

  const queryClient = useQueryClient();

  // 게시글 통계 조회
  const { data: stats = {}, isLoading: statsLoading, error: statsError } = useQuery({
    queryKey: ['posts-stats'],
    queryFn: () => postService.getPostStats(),
    refetchInterval: 30000, // 30초마다 갱신
    retry: false
  });

  // 게시글 목록 조회
  const { data: posts = [], isLoading, error } = useQuery({
    queryKey: ['admin-posts', searchTerm, page],
    queryFn: () => postService.getAdminPosts({
      page,
      limit: 20,
      search: searchTerm || undefined
    }),
    keepPreviousData: true,
    retry: false
  });

  // 게시글 고정 mutation
  const togglePinMutation = useMutation({
    mutationFn: ({ postId, isPinned }) => postService.setPinned(postId, isPinned),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-posts']);
    }
  });

  // 게시글 숨김 mutation
  const hidePostMutation = useMutation({
    mutationFn: ({ postId, isHidden }) => postService.hidePost(postId, isHidden),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-posts']);
      queryClient.invalidateQueries(['posts-stats']);
    }
  });

  // 선택된 게시물의 댓글 조회 (관리자 페이지에서는 숨김 댓글도 포함)
  const { data: postComments = [], isLoading: commentsLoading, refetch: refetchComments } = useQuery({
    queryKey: ['admin-post-comments', selectedPost?.id],
    queryFn: () => commentService.getComments(selectedPost.id, { includeHidden: true }),
    enabled: !!selectedPost?.id && showPostModal,
    retry: false
  });

  // 댓글 숨김 mutation
  const hideCommentMutation = useMutation({
    mutationFn: ({ commentId, isHidden }) => commentService.hideComment(commentId, isHidden),
    onSuccess: () => {
      refetchComments();
      queryClient.invalidateQueries(['admin-posts']);
    }
  });

  // 검색어 변경 시 페이지 리셋
  useEffect(() => {
    setPage(0);
  }, [searchTerm]);

  const handleSearch = () => {
    setSearchTerm(searchInput);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleHidePost = (postId, currentHidden) => {
    const action = currentHidden ? '숨김 해제' : '숨김';
    if (confirm(`이 게시물을 ${action}하시겠습니까?`)) {
      hidePostMutation.mutate({ postId, isHidden: !currentHidden });
    }
  };

  const handleTogglePin = (postId, currentPinned) => {
    togglePinMutation.mutate({ postId, isPinned: !currentPinned });
  };

  const handleViewPost = async (post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleHideComment = (commentId, currentHidden) => {
    const action = currentHidden ? '숨김 해제' : '숨김';
    if (confirm(`이 댓글을 ${action}하시겠습니까?`)) {
      hideCommentMutation.mutate({ commentId, isHidden: !currentHidden });
    }
  };

  // 이미지 URL 처리 함수
  const getImageUrl = (photo) => {
    if (!photo) return null;

    // 이미 전체 URL인 경우
    if (photo.startsWith('http://') || photo.startsWith('https://')) {
      return photo;
    }

    // Supabase Storage URL 구성
    if (photo.startsWith('posts/') || photo.startsWith('profiles/')) {
      return `${SUPABASE_URL}/storage/v1/object/public/${photo}`;
    }

    // 기본 경로 추가
    return `${SUPABASE_URL}/storage/v1/object/public/posts/${photo}`;
  };

  // 프로필 이미지 URL 처리 함수
  const getProfileImageUrl = (profilePic) => {
    if (!profilePic) return null;

    if (profilePic.startsWith('http://') || profilePic.startsWith('https://')) {
      return profilePic;
    }

    if (profilePic.startsWith('profiles/')) {
      return `${SUPABASE_URL}/storage/v1/object/public/${profilePic}`;
    }

    return `${SUPABASE_URL}/storage/v1/object/public/profiles/${profilePic}`;
  };

  // 게시물 이미지 배열 추출
  const getPostImages = (post) => {
    if (!post.photo) return [];

    // photo가 JSON 배열 문자열인 경우
    if (typeof post.photo === 'string') {
      try {
        const parsed = JSON.parse(post.photo);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // JSON 파싱 실패 시 단일 이미지로 처리
      }
      // 쉼표로 구분된 경우
      if (post.photo.includes(',')) {
        return post.photo.split(',').map(s => s.trim());
      }
      return [post.photo];
    }

    if (Array.isArray(post.photo)) {
      return post.photo;
    }

    return [];
  };

  // 비디오 파일 여부 확인
  const isVideoFile = (filename) => {
    if (!filename) return false;
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    const lowered = filename.toLowerCase();
    return videoExtensions.some(ext => lowered.endsWith(ext) || lowered.includes(ext + '?'));
  };

  if (isLoading && !posts.length) {
    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </AdminOnly>
    );
  }

  if (error || statsError) {
    const errorMessage = error?.message || statsError?.message || '알 수 없는 오류';

    return (
      <AdminOnly>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <h3 className="text-lg font-medium text-red-600 mb-2">
              데이터 로드 실패
            </h3>
            <p className="text-gray-500 mb-4">
              오류: {errorMessage}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => {
                queryClient.invalidateQueries(['admin-posts']);
                queryClient.invalidateQueries(['posts-stats']);
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </AdminOnly>
    );
  }

  return (
    <AdminOnly>
      <div className="p-6 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ArticleIcon className="text-3xl text-red-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">게시물 관리</h1>
              <p className="text-gray-600">커뮤니티 게시물 조회 및 관리</p>
            </div>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-title">전체 게시물</div>
            <div className="stat-value text-blue-600">
              {statsLoading ? '...' : (stats.totalPosts || 0)}
            </div>
          </div>
          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-title">오늘 작성</div>
            <div className="stat-value text-green-600">
              {statsLoading ? '...' : (stats.todayPosts || 0)}
            </div>
          </div>
          <div className="stat bg-white rounded-lg shadow">
            <div className="stat-title">신고된 글</div>
            <div className="stat-value text-red-600">
              {statsLoading ? '...' : (stats.reportedPosts || 0)}
            </div>
          </div>
        </div>

        {/* 검색 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="제목, 내용, 작성자로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                className="input input-bordered w-full pl-10"
              />
            </div>
            <button
              onClick={handleSearch}
              className="btn btn-primary"
            >
              검색
            </button>
          </div>
        </div>

        {/* 게시물 목록 - 모바일 스타일 카드 레이아웃 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post) => {
            const images = getPostImages(post);
            const authorName = post.user?.name || post.user?.username || '알 수 없음';
            const profilePic = getProfileImageUrl(post.user?.profile_pic);

            return (
              <div key={post.id} className={`bg-white rounded-lg shadow-md overflow-hidden ${isLoading ? 'opacity-50' : ''} ${post.is_pinned ? 'ring-2 ring-orange-400' : ''}`}>
                {/* 상단 헤더 - 작성자 정보 & 고정 상태 */}
                <div className="p-4 border-b">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {/* 프로필 이미지 */}
                      <div className="avatar">
                        <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                          {profilePic ? (
                            <img
                              src={profilePic}
                              alt={authorName}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-lg font-bold">
                              {authorName.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold">{authorName}</div>
                        <div className="text-xs text-gray-500">ID: {post.user_id?.substring(0, 8) || 'N/A'}...</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {post.is_hidden && (
                        <span className="badge badge-error gap-1">
                          <VisibilityOffIcon fontSize="small" /> 숨김
                        </span>
                      )}
                      {post.is_pinned && (
                        <span className="badge badge-warning gap-1">
                          <PushPinIcon fontSize="small" /> 고정
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 태그 */}
                  <div className="flex flex-wrap gap-1">
                    {post.tags && post.tags.length > 0 ? (
                      post.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="badge badge-outline badge-xs"
                          style={{ borderColor: tag.color || '#888', color: tag.color || '#888' }}
                        >
                          {tag.display_name || tag.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">태그 없음</span>
                    )}
                    {post.tags && post.tags.length > 3 && (
                      <span className="badge badge-ghost badge-xs">+{post.tags.length - 3}</span>
                    )}
                  </div>
                </div>

                {/* 미디어 섹션 - 1:1 비율 (이미지/비디오/Stream 지원) */}
                {images.length > 0 && (
                  <div className="relative w-full" style={{ paddingBottom: '100%' }}>
                    {isCloudflareStreamUrl(images[0]) ? (
                      <div className="absolute inset-0">
                        <CloudflareStreamPlayer
                          url={images[0]}
                          autoplay={false}
                          muted={true}
                          loop={false}
                          controls={true}
                          aspectRatio="square"
                          className="w-full h-full"
                        />
                      </div>
                    ) : isVideoFile(images[0]) ? (
                      <video
                        src={getImageUrl(images[0])}
                        className="absolute inset-0 w-full h-full object-cover"
                        controls
                        muted
                        playsInline
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <img
                        src={getImageUrl(images[0])}
                        alt="게시물 이미지"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    )}
                    {images.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white px-2 py-1 rounded text-xs">
                        +{images.length - 1}
                      </div>
                    )}
                  </div>
                )}

                {/* 컨텐츠 섹션 */}
                <div className="p-4">
                  <div className="mb-3">
                    <div className="font-semibold text-gray-900 line-clamp-2">
                      {post.title || (post.description ? post.description.substring(0, 50) + '...' : '제목 없음')}
                    </div>
                    {post.description && (
                      <div className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {post.description}
                      </div>
                    )}
                  </div>

                  {/* 통계 정보 */}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span>👁</span> {post.views_count || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <span>❤️</span> {post.likesCount || 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <span>💬</span> {post.commentsCount || 0}
                      </span>
                    </div>
                  </div>

                  {/* 작성일 */}
                  <div className="text-xs text-gray-400 mb-3">
                    {new Date(post.created_at).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>

                  {/* 액션 버튼들 */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => handleViewPost(post)}
                    >
                      <VisibilityIcon fontSize="small" /> 상세보기
                    </button>

                    <button
                      className={`btn btn-sm ${post.is_pinned ? 'btn-warning' : 'btn-outline'}`}
                      onClick={() => handleTogglePin(post.id, post.is_pinned)}
                      disabled={togglePinMutation.isLoading}
                    >
                      <PushPinIcon fontSize="small" /> {post.is_pinned ? '고정해제' : '고정'}
                    </button>

                    <button
                      className={`btn btn-sm ${post.is_hidden ? 'btn-success' : 'btn-warning'}`}
                      onClick={() => handleHidePost(post.id, post.is_hidden)}
                      disabled={hidePostMutation.isLoading}
                    >
                      {post.is_hidden ? (
                        <><VisibilityIcon fontSize="small" /> 숨김해제</>
                      ) : (
                        <><VisibilityOffIcon fontSize="small" /> 숨김</>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 페이지네이션 */}
        {posts.length >= 20 && (
          <div className="flex justify-center mt-6">
            <div className="join">
              <button
                className="join-item btn"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0 || isLoading}
              >
                이전
              </button>
              <span className="join-item btn btn-disabled">
                {page + 1}
              </span>
              <button
                className="join-item btn"
                onClick={() => setPage(page + 1)}
                disabled={posts.length < 20 || isLoading}
              >
                다음
              </button>
            </div>
          </div>
        )}

        {posts.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <ArticleIcon className="mx-auto text-gray-400 text-6xl mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">게시물이 없습니다</h3>
            <p className="text-gray-500">다른 검색어나 필터를 시도해보세요.</p>
          </div>
        )}

        {/* 게시물 상세보기 모달 */}
        {showPostModal && selectedPost && (
          <div className="modal modal-open">
            <div className="modal-box w-11/12 max-w-4xl">
              <h3 className="font-bold text-lg mb-4">게시물 상세보기</h3>

              <div className="space-y-4">
                <div>
                  <label className="font-medium">작성자:</label>
                  <span className="ml-2">
                    {selectedPost.user?.name || selectedPost.user?.username || '알 수 없음'}
                    {selectedPost.user?.username && ` (@${selectedPost.user.username})`}
                  </span>
                </div>

                {selectedPost.title && (
                  <div>
                    <label className="font-medium">제목:</label>
                    <div className="mt-1 text-lg font-semibold">{selectedPost.title}</div>
                  </div>
                )}

                <div>
                  <label className="font-medium">내용:</label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg whitespace-pre-wrap">
                    {selectedPost.description || '내용 없음'}
                  </div>
                </div>

                {getPostImages(selectedPost).length > 0 && (
                  <div>
                    <label className="font-medium">미디어:</label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {getPostImages(selectedPost).map((media, index) => (
                        <div key={index} className="relative" style={{ paddingBottom: '100%' }}>
                          {isCloudflareStreamUrl(media) ? (
                            <div className="absolute inset-0">
                              <CloudflareStreamPlayer
                                url={media}
                                autoplay={false}
                                muted={true}
                                loop={false}
                                controls={true}
                                aspectRatio="square"
                                className="w-full h-full rounded-lg"
                              />
                            </div>
                          ) : isVideoFile(media) ? (
                            <video
                              src={getImageUrl(media)}
                              className="absolute inset-0 w-full h-full object-cover rounded-lg"
                              controls
                              muted
                              playsInline
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <img
                              src={getImageUrl(media)}
                              alt={`게시물 이미지 ${index + 1}`}
                              className="absolute inset-0 w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                e.target.src = '/default/no-image.png';
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPost.tags && selectedPost.tags.length > 0 && (
                  <div>
                    <label className="font-medium">태그:</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedPost.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="badge badge-outline"
                          style={{ borderColor: tag.color || '#888', color: tag.color || '#888' }}
                        >
                          {tag.display_name || tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center text-sm text-gray-500">
                  <span>작성일: {new Date(selectedPost.created_at).toLocaleString('ko-KR')}</span>
                  <div className="flex gap-4">
                    <span>조회수: {selectedPost.views_count || 0}</span>
                    <span>좋아요: {selectedPost.likesCount || 0}</span>
                    <span>댓글: {selectedPost.commentsCount || 0}</span>
                  </div>
                </div>

                {/* 댓글 섹션 */}
                <div className="mt-6 border-t pt-4">
                  <div
                    className="flex items-center justify-between cursor-pointer mb-4"
                    onClick={() => setShowCommentsSection(!showCommentsSection)}
                  >
                    <div className="flex items-center gap-2">
                      <CommentIcon className="text-gray-600" />
                      <span className="font-medium text-gray-900">
                        댓글 ({postComments.length})
                      </span>
                    </div>
                    <span className="text-gray-500 text-sm">
                      {showCommentsSection ? '접기 ▲' : '펼치기 ▼'}
                    </span>
                  </div>

                  {showCommentsSection && (
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {commentsLoading ? (
                        <div className="flex justify-center py-4">
                          <div className="loading loading-spinner loading-md"></div>
                        </div>
                      ) : postComments.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          댓글이 없습니다.
                        </div>
                      ) : (
                        postComments.map((comment) => (
                          <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 flex-1">
                                {/* 프로필 이미지 */}
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex-shrink-0 overflow-hidden">
                                  {comment.profile_pic ? (
                                    <img
                                      src={getProfileImageUrl(comment.profile_pic)}
                                      alt={comment.username}
                                      className="w-full h-full object-cover"
                                      onError={(e) => { e.target.style.display = 'none'; }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <PersonIcon className="text-gray-400" fontSize="small" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-medium text-sm text-gray-900">
                                      {comment.name || comment.username || '알 수 없음'}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                      {new Date(comment.created_at).toLocaleString('ko-KR')}
                                    </span>
                                    {comment.is_hidden && (
                                      <span className="badge badge-error badge-xs">차단됨</span>
                                    )}
                                  </div>
                                  <p className={`text-sm whitespace-pre-wrap break-words ${comment.is_hidden ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                    {comment.is_hidden ? '[숨김 처리된 댓글]' : (comment.description || comment.desc)}
                                  </p>
                                  {/* 답글 표시 */}
                                  {comment.replies && comment.replies.length > 0 && (
                                    <div className="mt-2 ml-4 space-y-2 border-l-2 border-gray-200 pl-3">
                                      {comment.replies.map((reply) => (
                                        <div key={reply.id} className="bg-white rounded p-2">
                                          <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-xs text-gray-900">
                                                  {reply.name || reply.username || '알 수 없음'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                  {new Date(reply.created_at).toLocaleString('ko-KR')}
                                                </span>
                                              </div>
                                              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                                                {reply.description || reply.desc}
                                              </p>
                                            </div>
                                            <button
                                              onClick={() => handleHideComment(reply.id, reply.is_hidden)}
                                              className={`btn btn-ghost btn-xs ${reply.is_hidden ? 'text-green-500 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`}
                                              disabled={hideCommentMutation.isLoading}
                                              title={reply.is_hidden ? '숨김 해제' : '숨김'}
                                            >
                                              {reply.is_hidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleHideComment(comment.id, comment.is_hidden)}
                                className={`btn btn-ghost btn-sm flex-shrink-0 ${comment.is_hidden ? 'text-green-500 hover:bg-green-50' : 'text-orange-500 hover:bg-orange-50'}`}
                                disabled={hideCommentMutation.isLoading}
                                title={comment.is_hidden ? '숨김 해제' : '숨김'}
                              >
                                {comment.is_hidden ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-action">
                <button className="btn" onClick={() => setShowPostModal(false)}>닫기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminOnly>
  );
};

export default AdminPosts;
