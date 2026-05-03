import React, { useContext, useEffect, useState } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import EnhancedInstagramFeed from '../components/EnhancedInstagramFeed';
import { AuthContext } from '../context/AuthContext';
import BannerAd from '../components/BannerAd';
import { BANNER_SLOTS } from '../services/bannerAdService';

const Community = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const { isBanned } = useContext(AuthContext);
    const [showBannedAlert, setShowBannedAlert] = useState(false);

    // 차단된 사용자가 리다이렉트되어 왔을 때 알림 표시
    useEffect(() => {
        if (location.state?.banned || isBanned) {
            setShowBannedAlert(true);
        }
    }, [location.state, isBanned]);

    return (
        <div className="community-page min-h-screen bg-base-200 pt-14">
            {/* 차단 알림 */}
            {showBannedAlert && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mx-4 mt-4" role="alert">
                    <strong className="font-bold">계정이 정지되었습니다. </strong>
                    <span className="block sm:inline">
                        글쓰기, 댓글 작성, 사고팔고 이용이 제한됩니다.
                    </span>
                    <button
                        className="absolute top-0 bottom-0 right-0 px-4 py-3"
                        onClick={() => setShowBannedAlert(false)}
                    >
                        <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                            <title>닫기</title>
                            <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
                        </svg>
                    </button>
                </div>
            )}

            {/* 배너 광고 - 커뮤니티 상단 */}
            <div className="max-w-md mx-auto px-4 pt-3">
                <BannerAd slot={BANNER_SLOTS.COMMUNITY_TOP} />
            </div>

            {/* 게시물 목록 */}
            <div className="w-full">
                <EnhancedInstagramFeed
                    highlightPostId={searchParams.get('postId')}
                />
            </div>
        </div>
    );
};

export default Community;