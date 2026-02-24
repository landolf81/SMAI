/**
 * AdminPushNotifications - 관리자 푸시 알림 발송 페이지 (PC 레이아웃)
 * 구독자 현황, 전체 발송, 발송 로그
 */

import React, { useState, useEffect, useRef } from 'react';
import { AdminOnly } from '../../components/PermissionComponents';
import { pushNotificationService } from '../../services/pushNotificationService';
import { supabase } from '../../config/supabase';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SendIcon from '@mui/icons-material/Send';
import PeopleIcon from '@mui/icons-material/People';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

const AdminPushNotifications = () => {
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // 폼 상태
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');

  // 발송 로그 (실시간 + DB)
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => {
    loadSubscriberCount();
    loadLogs();
  }, []);

  // 로그 추가 시 자동 스크롤
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const loadSubscriberCount = async () => {
    setLoading(true);
    const count = await pushNotificationService.getSubscriberCount();
    setSubscriberCount(count);
    setLoading(false);
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from('push_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setLogs(data.reverse());
    }
  };

  const addLog = (type, message) => {
    const entry = {
      id: Date.now(),
      type,
      message,
      created_at: new Date().toISOString(),
    };
    setLogs(prev => [...prev, entry]);
  };

  const handleSend = async (e) => {
    e.preventDefault();

    if (!title.trim() || !body.trim()) {
      addLog('error', '제목과 내용을 입력해주세요.');
      return;
    }

    if (!confirm(`${subscriberCount}명에게 푸시 알림을 발송하시겠습니까?`)) {
      return;
    }

    setSending(true);
    addLog('info', `발송 시작: "${title.trim()}" → ${subscriberCount}명`);

    try {
      const data = await pushNotificationService.sendPush({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || '/',
      });

      addLog('success', `발송 완료: 성공 ${data.sent}건, 실패 ${data.failed}건 (전체 ${data.total}건)`);

      // DB에 로그 저장
      await supabase.from('push_logs').insert({
        title: title.trim(),
        body: body.trim(),
        url: url.trim() || '/',
        sent: data.sent,
        failed: data.failed,
        total: data.total,
      });

      // 폼 초기화
      setTitle('');
      setBody('');
      setUrl('/');
    } catch (error) {
      addLog('error', `발송 실패: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <AdminOnly>
      <div className="p-6 pt-20 max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-[#004225] rounded-xl flex items-center justify-center">
              <NotificationsActiveIcon className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">푸시 알림 관리</h1>
              <p className="text-gray-500 text-sm">구독자에게 알림을 발송하고 이력을 확인합니다</p>
            </div>
          </div>
          <button
            onClick={() => { loadSubscriberCount(); loadLogs(); }}
            className="btn bg-[#004225] hover:bg-[#003018] text-white border-none gap-2"
            disabled={loading}
          >
            <RefreshIcon className={loading ? 'animate-spin' : ''} fontSize="small" />
            새로고침
          </button>
        </div>

        {/* 구독자 현황 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure">
                <PeopleIcon className="text-[#004225]" style={{ fontSize: 32 }} />
              </div>
              <div className="stat-title">전체 구독자</div>
              <div className="stat-value text-[#004225]">
                {loading ? '...' : subscriberCount.toLocaleString()}
              </div>
              <div className="stat-desc">알림 수신 동의 사용자</div>
            </div>
          </div>
          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure">
                <SendIcon className="text-blue-600" style={{ fontSize: 32 }} />
              </div>
              <div className="stat-title">최근 발송</div>
              <div className="stat-value text-blue-600">
                {logs.filter(l => l.sent !== undefined).slice(-1)[0]?.sent ?? '-'}
              </div>
              <div className="stat-desc">마지막 발송 성공 건수</div>
            </div>
          </div>
          <div className="stats shadow bg-base-100">
            <div className="stat">
              <div className="stat-figure">
                <HistoryIcon className="text-gray-500" style={{ fontSize: 32 }} />
              </div>
              <div className="stat-title">총 발송 이력</div>
              <div className="stat-value text-gray-700">
                {logs.filter(l => l.sent !== undefined).length}
              </div>
              <div className="stat-desc">기록된 발송 횟수</div>
            </div>
          </div>
        </div>

        {/* 2열 레이아웃: 발송 폼 + 로그 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 왼쪽: 발송 폼 */}
          <div className="card bg-base-100 shadow">
            <div className="card-body">
              <h2 className="card-title text-gray-800 flex items-center gap-2 mb-2">
                <NotificationsActiveIcon fontSize="small" className="text-[#004225]" />
                알림 발송
              </h2>

              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-medium">제목</span>
                    <span className="label-text-alt text-gray-400">{title.length}/50</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, 50))}
                    placeholder="알림 제목"
                    className="input input-bordered w-full"
                    maxLength={50}
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">내용</span>
                    <span className="label-text-alt text-gray-400">{body.length}/200</span>
                  </label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value.slice(0, 200))}
                    placeholder="알림 내용을 입력하세요"
                    className="textarea textarea-bordered w-full"
                    rows={4}
                    maxLength={200}
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-medium">이동 URL</span>
                    <span className="label-text-alt text-gray-400">선택사항</span>
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="/"
                    className="input input-bordered w-full"
                  />
                  <label className="label">
                    <span className="label-text-alt text-gray-400">예: /community, /prices, /secondhand</span>
                  </label>
                </div>

                {/* 미리보기 */}
                {(title || body) && (
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="text-xs text-gray-400 mb-2 font-medium">알림 미리보기</div>
                    <div className="flex items-start gap-3 bg-white rounded-lg p-3 shadow-sm border">
                      <img src="/icon-192.png" alt="" className="w-12 h-12 rounded-xl" />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm text-gray-900">{title || '제목'}</div>
                        <div className="text-sm text-gray-600 mt-0.5 break-words">{body || '내용'}</div>
                        {url && url !== '/' && (
                          <div className="text-xs text-blue-500 mt-1">{url}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending || subscriberCount === 0}
                  className="btn bg-[#004225] hover:bg-[#003018] text-white w-full gap-2 border-none"
                >
                  {sending ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : (
                    <SendIcon fontSize="small" />
                  )}
                  {sending ? '발송 중...' : `${subscriberCount}명에게 발송`}
                </button>
              </form>
            </div>
          </div>

          {/* 오른쪽: 발송 로그 */}
          <div className="card bg-base-100 shadow">
            <div className="card-body p-0">
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <h2 className="card-title text-gray-800 flex items-center gap-2">
                  <HistoryIcon fontSize="small" className="text-[#004225]" />
                  발송 로그
                </h2>
                <button onClick={loadLogs} className="btn btn-ghost btn-xs">
                  <RefreshIcon fontSize="small" />
                </button>
              </div>

              <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: '520px' }}>
                {logs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <HistoryIcon style={{ fontSize: 48 }} className="mb-2 opacity-30" />
                    <p className="text-sm">발송 이력이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log.id}
                        className={`flex items-start gap-2 px-3 py-2 rounded-lg text-sm ${
                          log.type === 'success' || log.sent !== undefined
                            ? 'bg-green-50 border border-green-100'
                            : log.type === 'error'
                            ? 'bg-red-50 border border-red-100'
                            : 'bg-blue-50 border border-blue-100'
                        }`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          {log.type === 'success' || log.sent !== undefined ? (
                            <CheckCircleIcon className="text-green-500" style={{ fontSize: 16 }} />
                          ) : log.type === 'error' ? (
                            <ErrorIcon className="text-red-500" style={{ fontSize: 16 }} />
                          ) : (
                            <SendIcon className="text-blue-500" style={{ fontSize: 16 }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {log.title ? (
                            <>
                              <div className="font-medium text-gray-800">{log.title}</div>
                              <div className="text-gray-500 text-xs mt-0.5">
                                {log.body && <span className="mr-2">{log.body.slice(0, 40)}{log.body.length > 40 ? '...' : ''}</span>}
                              </div>
                              <div className="text-gray-500 text-xs">
                                성공 {log.sent} / 실패 {log.failed} / 전체 {log.total}
                              </div>
                            </>
                          ) : (
                            <div className="text-gray-700">{log.message}</div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 flex-shrink-0 whitespace-nowrap">
                          {formatTime(log.created_at)}
                        </div>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminOnly>
  );
};

export default AdminPushNotifications;
