import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { AdminOnly } from '../components/PermissionComponents';
import { useAdminPermissions } from '../hooks/usePermissions';

const AdminPage = () => {
    const { currentUser } = useContext(AuthContext);
    const navigate = useNavigate();
    // 탭 상태 제거 - 대시보드만 표시
    const adminPermissions = useAdminPermissions();
    
    // 컴포넌트 마운트 시에만 로그 출력
    useEffect(() => {
        console.log('🔍 [DEBUG] AdminPage 마운트');
        console.log('🔍 [DEBUG] currentUser:', currentUser);
        console.log('🔍 [DEBUG] adminPermissions:', adminPermissions);
        console.log('🔍 [DEBUG] 대시보드 전용 모드');
    }, []);

    // 렌더링 함수 단순화 - 대시보드만 표시
    const renderContent = () => {
        return <DashboardContent navigate={navigate} />;
    };

    console.log('🔍 [DEBUG] AdminPage return 호출 - 대시보드 전용');
    
    return (
        <AdminOnly>
            <div className="admin-page bg-gray-50 min-h-screen">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* 헤더 */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">관리자 대시보드</h1>
                        <p className="text-gray-600">성주참외 경락정보 웹앱 관리 페이지입니다.</p>
                        
                        {/* 권한 정보 표시 */}
                        <div className="mt-4 flex flex-wrap gap-2">
                            <span className="badge badge-primary">
                                역할: {adminPermissions.userRole || '일반 사용자'}
                            </span>
                            {adminPermissions.canManageTags && (
                                <span className="badge badge-success">태그 관리</span>
                            )}
                            {adminPermissions.canAssignPermissions && (
                                <span className="badge badge-warning">권한 관리</span>
                            )}
                        </div>
                    </div>

                    {/* 탭 네비게이션 제거 - 대시보드만 표시 */}

                    {/* 콘텐츠 영역 */}
                    <div className="content-area">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </AdminOnly>
    );
};

// 모니터링 대시보드 컴포넌트
const DashboardContent = ({ navigate }) => {
    const [realtimeStats, setRealtimeStats] = useState({
        onlineUsers: 42,
        todayPosts: 23,
        todayViews: 1245,
        serverStatus: 'healthy',
        lastUpdate: new Date().toLocaleTimeString()
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setRealtimeStats(prev => ({
                ...prev,
                onlineUsers: prev.onlineUsers + Math.floor(Math.random() * 10 - 5),
                lastUpdate: new Date().toLocaleTimeString()
            }));
        }, 30000);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="space-y-8">
            {/* 실시간 모니터링 */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">실시간 모니터링</h2>
                    <div className="flex items-center gap-2 text-red-100">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm">마지막 업데이트: {realtimeStats.lastUpdate}</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white/10 rounded-lg p-4">
                        <div className="text-red-100 text-sm">온라인 사용자</div>
                        <div className="text-2xl font-bold">{realtimeStats.onlineUsers}</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                        <div className="text-red-100 text-sm">오늘 새 게시물</div>
                        <div className="text-2xl font-bold">{realtimeStats.todayPosts}</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                        <div className="text-red-100 text-sm">오늘 조회수</div>
                        <div className="text-2xl font-bold">{realtimeStats.todayViews.toLocaleString()}</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                        <div className="text-red-100 text-sm">서버 상태</div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                            <span className="font-bold">정상</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 주요 지표 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-figure">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
                            </svg>
                        </div>
                        <div className="stat-title">전체 사용자</div>
                        <div className="stat-value text-blue-600">1,234</div>
                        <div className="stat-desc text-green-600">↗︎ 21% 증가</div>
                    </div>
                </div>

                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-figure">
                            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                        </div>
                        <div className="stat-title">총 게시물</div>
                        <div className="stat-value text-green-600">2,456</div>
                        <div className="stat-desc text-green-600">↗︎ 12% 증가</div>
                    </div>
                </div>

                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-figure">
                            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                        </div>
                        <div className="stat-title">활성 광고</div>
                        <div className="stat-value text-purple-600">8</div>
                        <div className="stat-desc">클릭률 5.2%</div>
                    </div>
                </div>

                <div className="stats shadow">
                    <div className="stat">
                        <div className="stat-figure">
                            <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                            </svg>
                        </div>
                        <div className="stat-title">월 수익</div>
                        <div className="stat-value text-orange-600">₩125K</div>
                        <div className="stat-desc text-green-600">↗︎ 18% 증가</div>
                    </div>
                </div>
            </div>

            {/* 최근 활동 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h3 className="card-title">최근 신고 게시물</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                                <div>
                                    <div className="font-medium">스팸성 광고 글</div>
                                    <div className="text-sm text-gray-500">신고 5건 • 2시간 전</div>
                                </div>
                                <button className="btn btn-error btn-sm">처리</button>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                <div>
                                    <div className="font-medium">부적절한 내용</div>
                                    <div className="text-sm text-gray-500">신고 2건 • 4시간 전</div>
                                </div>
                                <button className="btn btn-warning btn-sm">검토</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h3 className="card-title">시스템 알림</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                <div>
                                    <div className="font-medium">데이터베이스 백업 완료</div>
                                    <div className="text-sm text-gray-500">30분 전</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <div>
                                    <div className="font-medium">새 사용자 가입 알림</div>
                                    <div className="text-sm text-gray-500">1시간 전</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <div>
                                    <div className="font-medium">광고 캠페인 시작</div>
                                    <div className="text-sm text-gray-500">3시간 전</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 빠른 관리 링크 */}
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h2 className="card-title mb-4">빠른 관리</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button 
                            onClick={() => navigate('/admin/users')}
                            className="btn btn-outline gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"></path>
                            </svg>
                            사용자 관리
                        </button>
                        <button 
                            onClick={() => navigate('/admin/posts')}
                            className="btn btn-outline gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                            </svg>
                            게시물 관리
                        </button>
                        <button 
                            onClick={() => navigate('/admin/ads')}
                            className="btn btn-outline gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                            </svg>
                            광고 관리
                        </button>
                        <button 
                            onClick={() => navigate('/admin/analytics')}
                            className="btn btn-outline gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
                            </svg>
                            상세 통계
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;