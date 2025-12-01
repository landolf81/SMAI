import React from 'react';
import { useSearchParams } from 'react-router-dom';
import EnhancedInstagramFeed from '../components/EnhancedInstagramFeed';
import { useScrollRestore } from '../hooks/useScrollRestore';

const Community = () => {
    const [searchParams] = useSearchParams();

    // 커뮤니티 페이지 스크롤 위치 복원
    const { resetScrollPosition, scrollToTop } = useScrollRestore('community');

    return (
        <div className="community-page pb-20">
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