import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { youtubeService } from '../../services';
import { AdminOnly } from '../../components/PermissionComponents';
import YouTubeIcon from '@mui/icons-material/YouTube';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SubscriptionsIcon from '@mui/icons-material/Subscriptions';
import PendingIcon from '@mui/icons-material/Pending';
import { supabase } from '../../config/supabase';

const AdminYouTube = () => {
  const [activeTab, setActiveTab] = useState('pending'); // pending, approved, rejected, channels
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({
    channelId: '',
    channelName: '',
    channelHandle: '',
    filterKeywords: ''
  });
  const [collecting, setCollecting] = useState(false);

  const queryClient = useQueryClient();

  // 영상 목록 조회
  const { data: videos = [], isLoading: videosLoading, refetch: refetchVideos } = useQuery({
    queryKey: ['youtube-videos', activeTab],
    queryFn: () => youtubeService.getAllVideos(activeTab === 'channels' ? 'all' : activeTab),
    enabled: activeTab !== 'channels'
  });

  // 채널 목록 조회
  const { data: channels = [], isLoading: channelsLoading, refetch: refetchChannels } = useQuery({
    queryKey: ['youtube-channels'],
    queryFn: () => youtubeService.getChannels(),
    enabled: activeTab === 'channels'
  });

  // 대기 중인 영상 수 조회
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['youtube-pending-count'],
    queryFn: () => youtubeService.getPendingCount()
  });

  // 영상 승인
  const approveMutation = useMutation({
    mutationFn: (videoId) => youtubeService.approveVideo(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries(['youtube-videos']);
      queryClient.invalidateQueries(['youtube-pending-count']);
      setSelectedVideo(null);
    }
  });

  // 영상 거절
  const rejectMutation = useMutation({
    mutationFn: (videoId) => youtubeService.rejectVideo(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries(['youtube-videos']);
      queryClient.invalidateQueries(['youtube-pending-count']);
      setSelectedVideo(null);
    }
  });

  // 영상 삭제
  const deleteVideoMutation = useMutation({
    mutationFn: (videoId) => youtubeService.deleteVideo(videoId),
    onSuccess: () => {
      queryClient.invalidateQueries(['youtube-videos']);
      queryClient.invalidateQueries(['youtube-pending-count']);
    }
  });

  // 채널 추가
  const addChannelMutation = useMutation({
    mutationFn: (channel) => youtubeService.addChannel(channel),
    onSuccess: () => {
      queryClient.invalidateQueries(['youtube-channels']);
      setShowAddChannel(false);
      setNewChannel({ channelId: '', channelName: '', channelHandle: '', filterKeywords: '' });
    }
  });

  // 채널 삭제
  const deleteChannelMutation = useMutation({
    mutationFn: (id) => youtubeService.deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['youtube-channels']);
    }
  });

  // 채널 활성화/비활성화
  const toggleChannelMutation = useMutation({
    mutationFn: ({ id, isActive }) => youtubeService.updateChannel(id, { is_active: isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries(['youtube-channels']);
    }
  });

  // 수동 수집 실행
  const handleCollect = async () => {
    setCollecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('collect-youtube-videos');
      if (error) throw error;
      const lines = [`신규 수집: ${data.collected ?? 0}개 영상`];
      if (typeof data.cleaned_up === 'number' && data.cleaned_up > 0) {
        lines.push(`자동 정리: ${data.cleaned_up}개 (3일 이상 된 대기/거절)`);
      }
      alert(lines.join('\n'));
      queryClient.invalidateQueries(['youtube-videos']);
      queryClient.invalidateQueries(['youtube-pending-count']);
    } catch (error) {
      alert(`수집 오류: ${error.message}`);
    } finally {
      setCollecting(false);
    }
  };

  // 채널 추가 폼 제출
  const handleAddChannel = (e) => {
    e.preventDefault();
    if (!newChannel.channelId || !newChannel.channelName) {
      alert('채널 ID와 채널명은 필수입니다.');
      return;
    }

    addChannelMutation.mutate({
      channelId: newChannel.channelId,
      channelName: newChannel.channelName,
      channelHandle: newChannel.channelHandle || null,
      filterKeywords: newChannel.filterKeywords
        ? newChannel.filterKeywords.split(',').map(k => k.trim())
        : null
    });
  };

  const tabs = [
    { id: 'pending', label: '대기중', icon: <PendingIcon fontSize="small" />, count: pendingCount },
    { id: 'approved', label: '승인됨', icon: <CheckCircleIcon fontSize="small" /> },
    { id: 'rejected', label: '거절됨', icon: <CancelIcon fontSize="small" /> },
    { id: 'channels', label: '채널 관리', icon: <SubscriptionsIcon fontSize="small" /> }
  ];

  return (
    <AdminOnly>
      <div className="min-h-screen bg-base-200 pt-16 pb-24">
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* 헤더 */}
          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <YouTubeIcon className="text-red-600" fontSize="large" />
                <div>
                  <h1 className="text-2xl font-bold text-base-content">YouTube 영상 관리</h1>
                  <p className="text-sm text-base-content/60">참외 관련 YouTube 영상 수집 및 승인</p>
                  <p className="text-xs text-base-content/50 mt-1">
                    수집 실행 시 3일 이상 된 대기/거절 영상은 자동으로 삭제됩니다 (승인된 영상은 보존).
                  </p>
                </div>
              </div>
              <button
                onClick={handleCollect}
                disabled={collecting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
                  collecting ? 'bg-base-content/30' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <RefreshIcon className={collecting ? 'animate-spin' : ''} />
                {collecting ? '수집 중...' : '영상 수집'}
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-red-600 text-white'
                    : 'bg-base-100 text-base-content hover:bg-base-200'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="bg-base-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-bold">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 채널 관리 탭 */}
          {activeTab === 'channels' && (
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">구독 채널 목록</h2>
                <button
                  onClick={() => setShowAddChannel(!showAddChannel)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <AddIcon fontSize="small" />
                  채널 추가
                </button>
              </div>

              {/* 채널 추가 폼 */}
              {showAddChannel && (
                <form onSubmit={handleAddChannel} className="bg-base-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-base-content mb-1">채널 ID *</label>
                      <input
                        type="text"
                        placeholder="UC..."
                        value={newChannel.channelId}
                        onChange={(e) => setNewChannel({ ...newChannel, channelId: e.target.value })}
                        className="w-full px-3 py-2 border border-base-300 rounded-lg bg-base-100 text-base-content"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-base-content mb-1">채널명 *</label>
                      <input
                        type="text"
                        placeholder="채널 이름"
                        value={newChannel.channelName}
                        onChange={(e) => setNewChannel({ ...newChannel, channelName: e.target.value })}
                        className="w-full px-3 py-2 border border-base-300 rounded-lg bg-base-100 text-base-content"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-base-content mb-1">핸들</label>
                      <input
                        type="text"
                        placeholder="@handle"
                        value={newChannel.channelHandle}
                        onChange={(e) => setNewChannel({ ...newChannel, channelHandle: e.target.value })}
                        className="w-full px-3 py-2 border border-base-300 rounded-lg bg-base-100 text-base-content"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-base-content mb-1">필터 키워드 (쉼표 구분)</label>
                      <input
                        type="text"
                        placeholder="참외, 멜론, 재배"
                        value={newChannel.filterKeywords}
                        onChange={(e) => setNewChannel({ ...newChannel, filterKeywords: e.target.value })}
                        className="w-full px-3 py-2 border border-base-300 rounded-lg bg-base-100 text-base-content"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="submit"
                      disabled={addChannelMutation.isLoading}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      추가
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddChannel(false)}
                      className="px-4 py-2 bg-base-200 text-base-content rounded-lg hover:bg-base-300"
                    >
                      취소
                    </button>
                  </div>
                </form>
              )}

              {/* 채널 목록 */}
              {channelsLoading ? (
                <div className="text-center py-8 text-base-content/60">로딩 중...</div>
              ) : channels.length === 0 ? (
                <div className="text-center py-8 text-base-content/60">등록된 채널이 없습니다.</div>
              ) : (
                <div className="space-y-3">
                  {channels.map(channel => (
                    <div key={channel.id} className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <YouTubeIcon className="text-red-600" />
                        <div>
                          <p className="font-medium">{channel.channel_name}</p>
                          <p className="text-sm text-base-content/60">
                            {channel.channel_handle || channel.channel_id}
                          </p>
                          {channel.filter_keywords && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {channel.filter_keywords.map((kw, i) => (
                                <span key={i} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleChannelMutation.mutate({ id: channel.id, isActive: !channel.is_active })}
                          className={`px-3 py-1 rounded text-sm ${
                            channel.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-base-300 text-base-content/60'
                          }`}
                        >
                          {channel.is_active ? '활성' : '비활성'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('이 채널을 삭제하시겠습니까?')) {
                              deleteChannelMutation.mutate(channel.id);
                            }
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <DeleteIcon fontSize="small" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 영상 목록 */}
          {activeTab !== 'channels' && (
            <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 p-6">
              {videosLoading ? (
                <div className="text-center py-8 text-base-content/60">로딩 중...</div>
              ) : videos.length === 0 ? (
                <div className="text-center py-8 text-base-content/60">
                  {activeTab === 'pending' && '대기 중인 영상이 없습니다.'}
                  {activeTab === 'approved' && '승인된 영상이 없습니다.'}
                  {activeTab === 'rejected' && '거절된 영상이 없습니다.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {videos.map(video => (
                    <div
                      key={video.id}
                      className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => setSelectedVideo(video)}
                    >
                      {/* 썸네일 */}
                      <div className="relative aspect-video bg-base-200">
                        <img
                          src={video.thumbnail_url || youtubeService.getThumbnailUrl(video.video_id)}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                          <PlayArrowIcon className="text-white" style={{ fontSize: 48 }} />
                        </div>
                        {/* 상태 배지 */}
                        <div className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                          video.status === 'pending' ? 'bg-yellow-500 text-white' :
                          video.status === 'approved' ? 'bg-green-500 text-white' :
                          'bg-red-500 text-white'
                        }`}>
                          {video.status === 'pending' ? '대기' :
                           video.status === 'approved' ? '승인' : '거절'}
                        </div>
                        {/* 수집 소스 */}
                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 text-white text-xs rounded">
                          {video.source === 'rss' ? 'RSS' : '검색'}
                        </div>
                      </div>

                      {/* 정보 */}
                      <div className="p-3">
                        <h3 className="font-medium text-sm line-clamp-2 mb-2">{video.title}</h3>
                        <p className="text-xs text-base-content/60">
                          {new Date(video.published_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 영상 상세 모달 */}
          {selectedVideo && (
            <div
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
              onClick={() => setSelectedVideo(null)}
            >
              <div
                className="bg-base-100 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 영상 플레이어 */}
                <div className="aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${selectedVideo.video_id}`}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>

                {/* 정보 */}
                <div className="p-6">
                  <h2 className="text-xl font-bold mb-2">{selectedVideo.title}</h2>
                  <p className="text-sm text-base-content/60 mb-4">
                    업로드: {new Date(selectedVideo.published_at).toLocaleDateString('ko-KR')} |
                    수집: {new Date(selectedVideo.collected_at).toLocaleDateString('ko-KR')} |
                    소스: {selectedVideo.source === 'rss' ? 'RSS 구독' : '키워드 검색'}
                  </p>

                  {selectedVideo.description && (
                    <p className="text-base-content/60 text-sm mb-4 line-clamp-3">
                      {selectedVideo.description}
                    </p>
                  )}

                  {/* 액션 버튼 */}
                  <div className="flex gap-3">
                    {selectedVideo.status === 'pending' && (
                      <>
                        <button
                          onClick={() => approveMutation.mutate(selectedVideo.id)}
                          disabled={approveMutation.isLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <CheckCircleIcon />
                          승인
                        </button>
                        <button
                          onClick={() => rejectMutation.mutate(selectedVideo.id)}
                          disabled={rejectMutation.isLoading}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          <CancelIcon />
                          거절
                        </button>
                      </>
                    )}
                    {selectedVideo.status !== 'pending' && (
                      <button
                        onClick={() => {
                          if (confirm('이 영상을 삭제하시겠습니까?')) {
                            deleteVideoMutation.mutate(selectedVideo.id);
                            setSelectedVideo(null);
                          }
                        }}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-base-300 text-base-content rounded-lg hover:bg-base-content/20"
                      >
                        <DeleteIcon />
                        삭제
                      </button>
                    )}
                    <a
                      href={`https://www.youtube.com/watch?v=${selectedVideo.video_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      YouTube에서 보기
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdminYouTube;
