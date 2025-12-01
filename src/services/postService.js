import { supabase } from '../config/supabase.js';

/**
 * 게시물 서비스
 * 모든 게시물 관련 Supabase 쿼리를 중앙화
 */
export const postService = {
  /**
   * 게시물 목록 조회 (피드 알고리즘 v1)
   * 정렬: 고정 게시물 > hot_score × 미열람 가중치
   *
   * @param {Object} options - 쿼리 옵션
   * @param {string} options.tagId - 태그 ID 필터
   * @param {string} options.userId - 사용자 ID 필터
   * @param {string} options.postType - 게시물 타입 필터 ('general', 'qna', 'secondhand')
   * @param {string} options.search - 검색어
   * @param {number} options.limit - 페이지당 항목 수
   * @param {number} options.offset - 오프셋
   * @param {string} options.sortBy - 정렬 방식 ('algorithm', 'latest', 'popular')
   */
  async getPosts({ tagId, userId, postType, search, limit = 20, offset = 0, sortBy = 'algorithm' } = {}) {
    try {
      // 현재 로그인 사용자 확인
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // 1. 게시물 기본 정보 + 사용자 정보 조회
      let query = supabase
        .from('posts')
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `);

      // 정렬 방식 선택
      if (sortBy === 'latest') {
        // 최신순 (기존 방식)
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'popular') {
        // 인기순 (hot_score만)
        query = query.order('hot_score', { ascending: false });
      } else {
        // algorithm: 최신순으로 가져온 후 클라이언트에서 재정렬
        // (최신글 상단 3개 로직을 위해 created_at 기준으로 가져옴)
        query = query.order('created_at', { ascending: false });
      }

      // 페이지네이션
      query = query.range(offset, offset + limit - 1);

      // 사용자 필터 (프로필 페이지용)
      if (userId) {
        query = query.eq('user_id', userId);
      }

      // post_type 필터
      if (postType) {
        query = query.eq('post_type', postType);
      }

      // 검색 필터 (description 컬럼 사용)
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      }

      const { data: posts, error: postsError } = await query;

      if (postsError) {
        console.error('게시물 조회 오류:', postsError);
        return [];
      }

      if (!posts || posts.length === 0) {
        return [];
      }

      // 2. 모든 게시물 ID 추출
      const postIds = posts.map(p => p.id);

      // 3. 관련 데이터를 병렬로 조회
      const queryPromises = [
        // 태그 조회 (is_primary 포함)
        supabase
          .from('post_tags')
          .select('post_id, is_primary, tags(id, name, display_name, color)')
          .in('post_id', postIds),

        // 좋아요 수 조회
        supabase
          .from('likes')
          .select('post_id')
          .in('post_id', postIds),

        // 댓글 수 조회
        supabase
          .from('comments')
          .select('post_id')
          .in('post_id', postIds),

        // 중고거래 상태 조회
        supabase
          .from('trade_items')
          .select('post_id, status, item_name, price')
          .in('post_id', postIds)
      ];

      // 로그인 사용자인 경우 열람 기록도 조회
      if (currentUser && sortBy === 'algorithm') {
        queryPromises.push(
          supabase
            .from('user_post_views')
            .select('post_id')
            .eq('user_id', currentUser.id)
            .in('post_id', postIds)
        );
      }

      const results = await Promise.all(queryPromises);
      const [tagsData, likesData, commentsData, tradeItemsData, viewedData] = results;

      // 4. 데이터를 맵으로 변환 (빠른 조회를 위해)
      const tagsMap = {};
      const primaryTagMap = {};
      tagsData.data?.forEach(pt => {
        if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
        if (pt.tags) {
          tagsMap[pt.post_id].push(pt.tags);
          // 주 태그 저장
          if (pt.is_primary) {
            primaryTagMap[pt.post_id] = pt.tags;
          }
        }
      });

      const likesCountMap = {};
      likesData.data?.forEach(like => {
        likesCountMap[like.post_id] = (likesCountMap[like.post_id] || 0) + 1;
      });

      const commentsCountMap = {};
      commentsData.data?.forEach(comment => {
        commentsCountMap[comment.post_id] = (commentsCountMap[comment.post_id] || 0) + 1;
      });

      // 중고거래 상태 맵 생성
      const tradeInfoMap = {};
      tradeItemsData?.data?.forEach(item => {
        tradeInfoMap[item.post_id] = item;
      });

      // 열람 기록 맵 생성
      const viewedPostIds = new Set();
      if (viewedData?.data) {
        viewedData.data.forEach(v => viewedPostIds.add(v.post_id));
      }

      // 5. 데이터 변환: Supabase 형식 → 프론트엔드 형식
      let postsWithDetails = posts.map((post) => {
        const isViewed = viewedPostIds.has(post.id);
        // 미열람 가중치 적용: 안 본 게시물 ×2.0, 본 게시물 ×0.3
        const viewWeight = isViewed ? 0.3 : 2.0;
        const finalScore = (post.hot_score || 0) * viewWeight;

        return {
          ...post,
          // Supabase → Frontend 컬럼 매핑
          desc: post.description,
          content: post.description,  // content도 추가
          img: post.photo,
          userId: post.user_id,
          createdAt: post.created_at,  // 타임스탬프 매핑 추가
          updatedAt: post.updated_at,  // 타임스탬프 매핑 추가

          // 사용자 정보
          username: post.users?.username || '',
          name: post.users?.name || '',
          profilePic: post.users?.profile_pic || 'defaultAvatar.png',
          user: post.users || null,

          // 관계 데이터
          tags: tagsMap[post.id] || [],
          primaryTag: primaryTagMap[post.id] || null,
          likesCount: likesCountMap[post.id] || 0,
          commentsCount: commentsCountMap[post.id] || 0,

          // 중고거래 정보
          tradeInfo: tradeInfoMap[post.id] || null,

          // 피드 알고리즘 관련
          isViewed,
          finalScore
        };
      });

      // 6. 알고리즘 모드 정렬 (algorithm 모드일 때만)
      if (sortBy === 'algorithm') {
        const now = new Date();
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

        // 6-1. 고정 게시물 분리
        const pinnedPosts = postsWithDetails.filter(p => p.is_pinned);
        const normalPosts = postsWithDetails.filter(p => !p.is_pinned);

        // 6-2. 최신글 (6시간 이내) 분리 - 최신순 정렬
        const recentPosts = normalPosts
          .filter(p => new Date(p.created_at) >= sixHoursAgo)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // 6-3. 나머지 게시물 - finalScore 순 정렬
        const olderPosts = normalPosts
          .filter(p => new Date(p.created_at) < sixHoursAgo)
          .sort((a, b) => b.finalScore - a.finalScore);

        // 6-4. 최종 정렬: 고정 → 최신글(최대 3개) → 나머지(알고리즘순)
        const topRecentPosts = recentPosts.slice(0, 3); // 상단 최대 3개
        const remainingRecentPosts = recentPosts.slice(3); // 3개 초과분

        // 3개 초과 최신글은 알고리즘 순서에 포함
        const algorithmPosts = [...remainingRecentPosts, ...olderPosts]
          .sort((a, b) => b.finalScore - a.finalScore);

        postsWithDetails = [...pinnedPosts, ...topRecentPosts, ...algorithmPosts];
      }

      // 디버깅: 첫 번째 게시물 데이터 확인
      if (postsWithDetails.length > 0) {
        const sample = postsWithDetails[0];
        console.log('📝 게시물 샘플 데이터:', {
          id: sample.id,
          user_id: sample.user_id,
          userId: sample.userId,
          title: sample.title,
          desc: sample.desc,
          img: sample.img,
          // 프로필 정보
          username: sample.username,
          name: sample.name,
          profilePic: sample.profilePic,
          user: sample.user,
          // 태그 정보
          tags: sample.tags,
          primaryTag: sample.primaryTag,
          likesCount: sample.likesCount,
          commentsCount: sample.commentsCount
        });
      }

      // 태그 필터 (클라이언트 측)
      if (tagId) {
        return postsWithDetails.filter(post =>
          post.tags.some(tag => tag.id === tagId)
        );
      }

      return postsWithDetails;
    } catch (error) {
      console.error('게시물 목록 조회 오류:', error);
      // 에러 발생 시 빈 배열 반환 (페이지가 깨지는 것 방지)
      return [];
    }
  },

  /**
   * 게시물 상세 조회
   * @param {string} postId - 게시물 ID
   */
  async getPost(postId) {
    try {
      // 1. 조회수 증가 (세션당 1회만 증가)
      const viewedKey = `post_viewed_${postId}`;
      const alreadyViewed = sessionStorage.getItem(viewedKey);

      if (!alreadyViewed) {
        const { error: viewError } = await supabase.rpc('increment_post_views', {
          p_post_id: postId
        });

        if (viewError) {
          console.warn('조회수 증가 실패:', viewError);
        } else {
          // 조회수 증가 성공 시 세션에 기록
          sessionStorage.setItem(viewedKey, 'true');
        }
      }

      // 2. 기본 게시물 정보 + 사용자 정보 조회
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          )
        `)
        .eq('id', postId)
        .single();

      if (postError) throw postError;
      if (!post) throw new Error('게시물을 찾을 수 없습니다.');

      // 3. 현재 사용자 정보 가져오기
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      // 4. 좋아요 수 및 현재 사용자의 좋아요 여부 조회
      const { data: likes, error: likesError } = await supabase
        .from('likes')
        .select('user_id')
        .eq('post_id', postId);

      if (likesError) console.warn('좋아요 조회 실패:', likesError);

      const userLiked = currentUser && likes ? likes.some(like => like.user_id === currentUser.id) : false;

      // 5. 중고거래 게시물인 경우 trade_items에서 상태 조회
      let tradeInfo = null;
      if (post.post_type === 'secondhand') {
        const { data: tradeItem, error: tradeError } = await supabase
          .from('trade_items')
          .select('*')
          .eq('post_id', postId)
          .maybeSingle();

        if (!tradeError && tradeItem) {
          tradeInfo = tradeItem;
        }
      }

      // 6. 데이터 변환
      return {
        ...post,
        // 사용자 정보
        username: post.users?.username || '',
        user_name: post.users?.name || '',
        profile_pic: post.users?.profile_pic || '',
        user: post.users,

        // 통계 정보
        views_count: post.views_count || 0,  // 조회수 추가
        likes_count: likes?.length || 0,
        user_liked: userLiked,

        // 중고거래 정보
        tradeInfo: tradeInfo,

        // 컬럼 매핑 (Supabase → Frontend)
        desc: post.description,
        content: post.description,  // content도 추가
        img: post.photo
      };
    } catch (error) {
      console.error('게시물 상세 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 생성
   * @param {Object} postData - 게시물 데이터
   */
  async createPost(postData) {
    try {
      // 현재 사용자 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 게시물 생성
      const { data: post, error: postError} = await supabase
        .from('posts')
        .insert([{
          user_id: user.id,
          title: postData.title || '',
          description: postData.content || '',  // Supabase uses 'description'
          photo: postData.img || null,  // Supabase uses 'photo' not 'img'
          post_type: postData.post_type || 'general',  // 'general', 'qna', 'secondhand'
          link_url: postData.link_url || null,  // 링크 URL
          link_type: postData.link_type || null  // 링크 타입 (youtube, instagram, generic 등)
          // created_at은 DB 기본값(NOW())을 사용 - 타임존 문제 방지
        }])
        .select()
        .single();

      if (postError) throw postError;

      // 태그 연결
      if (postData.tags && postData.tags.length > 0) {
        const postTags = postData.tags.map(tagId => ({
          post_id: post.id,
          tag_id: tagId
        }));

        const { error: tagError } = await supabase
          .from('post_tags')
          .insert(postTags);

        if (tagError) throw tagError;
      }

      return post;
    } catch (error) {
      console.error('게시물 생성 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 수정
   * @param {string} postId - 게시물 ID
   * @param {Object} updates - 수정할 데이터
   */
  async updatePost(postId, updates) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 게시물 업데이트
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (updates.title !== undefined) updateData.title = updates.title;
      if (updates.content !== undefined) updateData.description = updates.content;  // Supabase uses 'description'
      if (updates.img !== undefined) updateData.photo = updates.img;  // Supabase uses 'photo'
      if (updates.link_url !== undefined) updateData.link_url = updates.link_url;  // 링크 URL
      if (updates.link_type !== undefined) updateData.link_type = updates.link_type;  // 링크 타입

      const { data, error } = await supabase
        .from('posts')
        .update(updateData)
        .eq('id', postId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // 태그 업데이트
      if (updates.tags) {
        // 기존 태그 제거
        await supabase
          .from('post_tags')
          .delete()
          .eq('post_id', postId);

        // 새 태그 추가
        if (updates.tags.length > 0) {
          const postTags = updates.tags.map(tagId => ({
            post_id: postId,
            tag_id: tagId
          }));

          await supabase
            .from('post_tags')
            .insert(postTags);
        }
      }

      return data;
    } catch (error) {
      console.error('게시물 수정 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 삭제
   * @param {string} postId - 게시물 ID
   */
  async deletePost(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('게시물 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 좋아요 목록 조회
   * @param {string} postId - 게시물 ID
   * @returns {Promise<Array<string>>} - 좋아요한 사용자 ID 배열
   */
  async getLikes(postId) {
    try {
      const { data, error } = await supabase
        .from('likes')
        .select('user_id')
        .eq('post_id', postId);

      if (error) throw error;

      // user_id 배열로 반환
      return data.map(like => like.user_id);
    } catch (error) {
      console.error('좋아요 목록 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 좋아요
   * @param {string} postId - 게시물 ID
   */
  async likePost(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 자기 글 좋아요 차단: 게시물 작성자 확인
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (postError) throw postError;
      if (post.user_id === user.id) {
        throw new Error('자신의 게시물에는 좋아요를 누를 수 없습니다.');
      }

      const { error } = await supabase
        .from('likes')
        .insert([{
          user_id: user.id,
          post_id: postId
        }]);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('좋아요 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 좋아요 취소
   * @param {string} postId - 게시물 ID
   */
  async unlikePost(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('좋아요 취소 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 좋아요 토글
   * @param {string} postId - 게시물 ID
   */
  async toggleLike(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 자기 글 좋아요 차단: 게시물 작성자 확인
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('user_id')
        .eq('id', postId)
        .single();

      if (postError) throw postError;
      if (post.user_id === user.id) {
        throw new Error('자신의 게시물에는 좋아요를 누를 수 없습니다.');
      }

      // 현재 좋아요 상태 확인
      const { data: existingLike, error: checkError } = await supabase
        .from('likes')
        .select('*')
        .eq('user_id', user.id)
        .eq('post_id', postId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingLike) {
        // 이미 좋아요한 경우 취소
        return await this.unlikePost(postId);
      } else {
        // 좋아요 추가
        return await this.likePost(postId);
      }
    } catch (error) {
      console.error('좋아요 토글 오류:', error);
      throw error;
    }
  },

  /**
   * 태그 이름으로 게시물 조회
   * @param {string} tagName - 태그 이름
   * @param {Object} options - 쿼리 옵션
   * @param {string} options.search - 검색어
   */
  async getPostsByTagName(tagName, { search } = {}) {
    try {
      // 1. 태그 ID 조회
      const { data: tagData, error: tagError } = await supabase
        .from('tags')
        .select('id')
        .eq('name', tagName)
        .single();

      if (tagError) throw tagError;
      if (!tagData) throw new Error(`태그 '${tagName}'을 찾을 수 없습니다.`);

      // 2. post_tags에서 해당 태그의 post_id 목록 조회
      const { data: tagPosts, error: tagPostsError } = await supabase
        .from('post_tags')
        .select('post_id')
        .eq('tag_id', tagData.id);

      if (tagPostsError) throw tagPostsError;

      // post_id가 없으면 빈 배열 반환
      if (!tagPosts || tagPosts.length === 0) {
        return [];
      }

      const postIds = tagPosts.map(tp => tp.post_id);

      // 3. 해당 post_id들의 게시물 조회
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          users:user_id (
            id,
            username,
            name,
            profile_pic
          ),
          post_tags (
            tags (
              id,
              name,
              color
            )
          ),
          likes:likes(count),
          comments:comments(count)
        `)
        .in('id', postIds);

      if (error) throw error;

      // 4. 데이터 변환
      let posts = data.map(post => ({
        ...post,
        user: post.users,
        tags: post.post_tags?.map(pt => pt.tags) || [],
        likesCount: post.likes?.[0]?.count || 0,
        commentsCount: post.comments?.[0]?.count || 0
      }));

      // 4. 검색 필터 적용 (클라이언트 측)
      if (search) {
        const searchLower = search.toLowerCase();
        posts = posts.filter(post =>
          post.title?.toLowerCase().includes(searchLower) ||
          post.content?.toLowerCase().includes(searchLower)
        );
      }

      // 5. 최신순 정렬
      posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return posts;
    } catch (error) {
      console.error('태그별 게시물 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 조회수 증가
   * @param {string|number} postId - 게시물 ID (bigint)
   */
  async incrementViewCount(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false };

      // postId를 정수로 변환 (posts.id가 bigint인 경우)
      const postIdInt = parseInt(postId, 10);
      if (isNaN(postIdInt)) {
        console.warn('유효하지 않은 postId:', postId);
        return { success: false };
      }

      // 1. post_views 테이블에 조회 기록 추가 (중복 방지용)
      const { error: viewError } = await supabase
        .from('post_views')
        .insert([{
          post_id: postIdInt,
          user_id: user.id,
          viewed_at: new Date().toISOString(),
          ip_address: 'unknown',
          session_id: null
        }]);

      // 중복 키 에러(23505)면 이미 조회한 것 - 조회수 증가 안 함
      if (viewError && viewError.code === '23505') {
        console.log('이미 조회한 게시물:', postId);
        return { success: true, alreadyViewed: true };
      }

      if (viewError) {
        console.warn('조회 기록 추가 실패:', viewError.code, viewError.message);
        return { success: false };
      }

      // 2. posts.views_count 증가 (중복이 아닐 때만)
      const { data: currentPost, error: fetchError } = await supabase
        .from('posts')
        .select('views_count')
        .eq('id', postIdInt)
        .single();

      if (fetchError) {
        console.warn('게시물 조회 실패:', fetchError);
        return { success: false };
      }

      const { error: updateError } = await supabase
        .from('posts')
        .update({ views_count: (currentPost.views_count || 0) + 1 })
        .eq('id', postIdInt);

      if (updateError) {
        console.warn('조회수 업데이트 실패:', updateError);
        return { success: false };
      }

      console.log('✅ 조회수 증가 성공:', postId, '->', (currentPost.views_count || 0) + 1);
      return { success: true };
    } catch (error) {
      console.error('조회수 증가 예외:', error);
      return { success: false };
    }
  },

  /**
   * 게시물 거래 상태 업데이트 (중고거래)
   * Supabase trade_items 테이블의 status 직접 업데이트
   * @param {string} postId - 게시물 ID
   * @param {string} status - 거래 상태 (available, reserved, sold)
   */
  async updateTradeStatus(postId, status) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 게시물 소유권 확인
      const { data: post, error: postError } = await supabase
        .from('posts')
        .select('user_id, post_type')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        throw new Error('게시물을 찾을 수 없습니다.');
      }

      // 현재 사용자 역할 확인
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      const isOwner = post.user_id === user.id;
      const isAdmin = userData?.role === 'admin' || userData?.role === 'super_admin';

      if (!isOwner && !isAdmin) {
        throw new Error('거래 상태를 변경할 권한이 없습니다.');
      }

      if (post.post_type !== 'secondhand') {
        throw new Error('중고거래 게시물이 아닙니다.');
      }

      // trade_items 테이블 레코드 확인
      const { data: existingItem, error: checkError } = await supabase
        .from('trade_items')
        .select('*')
        .eq('post_id', postId)
        .maybeSingle();

      let result;

      if (existingItem) {
        // 기존 레코드가 있으면 업데이트
        const { data, error } = await supabase
          .from('trade_items')
          .update({ status })
          .eq('post_id', postId)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // 레코드가 없으면 새로 생성
        // 게시물 제목 가져오기
        const { data: postData } = await supabase
          .from('posts')
          .select('title')
          .eq('id', postId)
          .single();

        const { data, error } = await supabase
          .from('trade_items')
          .insert({
            post_id: postId,
            status: status,
            item_name: postData?.title || '중고거래 상품',
            price: 0
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return result;
    } catch (error) {
      console.error('거래 상태 업데이트 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 고정/고정 해제 (관리자)
   * @param {string} postId - 게시물 ID
   */
  async togglePin(postId) {
    try {
      // 현재 게시물 상태 조회
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('is_pinned')
        .eq('id', postId)
        .single();

      if (fetchError) throw fetchError;

      // 고정 상태 토글
      const { data, error } = await supabase
        .from('posts')
        .update({
          is_pinned: !post.is_pinned,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('게시물 고정 토글 오류:', error);
      throw error;
    }
  },

  /**
   * 관리자 전용: 게시물 통계 조회
   */
  async getPostStats() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 전체 게시물 수
      const { count: totalPosts, error: totalError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // 오늘 작성된 게시물 수
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: todayPosts, error: todayError } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      if (todayError) throw todayError;

      // 신고된 게시물 수
      const { count: reportedPosts, error: reportedError } = await supabase
        .from('reports')
        .select('post_id', { count: 'exact', head: true })
        .not('post_id', 'is', null)
        .eq('status', 'pending');

      if (reportedError) throw reportedError;

      return {
        totalPosts: totalPosts || 0,
        todayPosts: todayPosts || 0,
        reportedPosts: reportedPosts || 0
      };
    } catch (error) {
      console.error('게시물 통계 조회 오류:', error);
      throw error;
    }
  },

  /**
   * 관리자 전용: 게시물 목록 조회 (필터링 포함)
   * @param {Object} options - 필터 옵션
   */
  async getAdminPosts(options = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 기본 쿼리 (관계 쿼리 제거)
      let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      // 검색 필터
      if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,desc.ilike.%${options.search}%`);
      }

      // 상태 필터
      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      // 페이지네이션
      const page = options.page || 0;
      const limit = options.limit || 20;
      query = query.range(page * limit, (page + 1) * limit - 1);

      const { data: posts, error: postsError } = await query;

      if (postsError) {
        console.error('게시물 조회 오류:', postsError);
        return [];
      }

      if (!posts || posts.length === 0) {
        return [];
      }

      // 각 게시물의 관련 데이터를 병렬로 조회
      const postsWithDetails = await Promise.all(
        posts.map(async (post) => {
          try {
            // 사용자 정보
            const { data: user } = await supabase
              .from('users')
              .select('id, username, name, profile_pic')
              .eq('id', post.user_id)
              .single();

            // 좋아요 수
            const { count: likesCount } = await supabase
              .from('likes')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id);

            // 댓글 수
            const { count: commentsCount } = await supabase
              .from('comments')
              .select('*', { count: 'exact', head: true })
              .eq('post_id', post.id);

            // 태그 조회
            const { data: postTags } = await supabase
              .from('post_tags')
              .select('tag_id')
              .eq('post_id', post.id);

            let tags = [];
            if (postTags && postTags.length > 0) {
              const tagIds = postTags.map(pt => pt.tag_id);
              const { data: tagsData } = await supabase
                .from('tags')
                .select('id, name, display_name, color')
                .in('id', tagIds);
              tags = tagsData || [];
            }

            return {
              ...post,
              user: user || null,
              tags: tags,
              likesCount: likesCount || 0,
              commentsCount: commentsCount || 0
            };
          } catch (err) {
            console.error(`게시물 ${post.id} 상세 조회 오류:`, err);
            return {
              ...post,
              user: null,
              tags: [],
              likesCount: 0,
              commentsCount: 0
            };
          }
        })
      );

      // 태그 필터 적용 (클라이언트 사이드)
      if (options.tagName && options.tagName !== 'all') {
        return postsWithDetails.filter(post =>
          post.tags.some(tag => tag.name === options.tagName)
        );
      }

      return postsWithDetails;
    } catch (error) {
      console.error('관리자 게시물 조회 오류:', error);
      return [];
    }
  },

  /**
   * 관리자 전용: 게시물 상태 변경
   * @param {string} postId - 게시물 ID
   * @param {string} status - 새 상태
   */
  async updatePostStatus(postId, status) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('posts')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('게시물 상태 변경 오류:', error);
      throw error;
    }
  },

  /**
   * 관리자 전용: 게시물 삭제 (권한 체크 없음)
   * @param {string} postId - 게시물 ID
   */
  async deletePostAdmin(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('관리자 게시물 삭제 오류:', error);
      throw error;
    }
  },

  /**
   * 관리자 전용: 게시물 숨김 (soft delete)
   * @param {string} postId - 게시물 ID
   * @param {boolean} isHidden - 숨김 여부
   */
  async hidePost(postId, isHidden = true) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('posts')
        .update({
          is_hidden: isHidden
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('게시물 숨김 처리 오류:', error);
      throw error;
    }
  },

  /**
   * 관리자 전용: 숨김된 게시물 목록 조회
   */
  async getHiddenPosts(options = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      let query = supabase
        .from('posts')
        .select(`
          *,
          users:user_id (id, username, name, profile_pic)
        `)
        .eq('is_hidden', true)
        .order('updated_at', { ascending: false });

      // 페이지네이션
      const page = options.page || 0;
      const limit = options.limit || 20;
      query = query.range(page * limit, (page + 1) * limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('숨김 게시물 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 신고된 게시물/댓글 목록 조회
   * @param {Object} options - 필터 옵션
   */
  async getReports(options = {}) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      let query = supabase
        .from('reports')
        .select(`
          *,
          reporter:reporter_id (id, username, name, profile_pic),
          post:post_id (id, title, description, photo, user_id, created_at, is_hidden,
            users:user_id (id, username, name, profile_pic)
          ),
          comment:comment_id (id, description, user_id, created_at, is_hidden,
            users:user_id (id, username, name, profile_pic)
          )
        `)
        .order('created_at', { ascending: false });

      // 상태 필터
      if (options.status && options.status !== 'all') {
        query = query.eq('status', options.status);
      }

      // 타입 필터 (post/comment)
      if (options.type === 'post') {
        query = query.not('post_id', 'is', null);
      } else if (options.type === 'comment') {
        query = query.not('comment_id', 'is', null);
      }

      // 페이지네이션
      const page = options.page || 0;
      const limit = options.limit || 20;
      query = query.range(page * limit, (page + 1) * limit - 1);

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('신고 목록 조회 오류:', error);
      return [];
    }
  },

  /**
   * 신고 통계 조회
   */
  async getReportStats() {
    try {
      // 대기 중인 신고
      const { count: pendingCount } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      // 게시물 신고
      const { count: postReports } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .not('post_id', 'is', null)
        .eq('status', 'pending');

      // 댓글 신고
      const { count: commentReports } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .not('comment_id', 'is', null)
        .eq('status', 'pending');

      // 처리된 신고
      const { count: resolvedCount } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'resolved');

      return {
        pending: pendingCount || 0,
        postReports: postReports || 0,
        commentReports: commentReports || 0,
        resolved: resolvedCount || 0
      };
    } catch (error) {
      console.error('신고 통계 조회 오류:', error);
      return { pending: 0, postReports: 0, commentReports: 0, resolved: 0 };
    }
  },

  /**
   * 신고 상태 업데이트
   * @param {string} reportId - 신고 ID
   * @param {string} status - 새 상태 (pending, resolved, dismissed)
   * @param {string} adminNote - 관리자 메모
   */
  async updateReportStatus(reportId, status, adminNote = '') {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('reports')
        .update({
          status,
          admin_note: adminNote,
          resolved_by: user.id,
          resolved_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('신고 상태 업데이트 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 열람 기록 저장 (피드 알고리즘용)
   * @param {string|number} postId - 게시물 ID
   */
  async recordPostView(postId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, reason: 'not_logged_in' };

      const postIdInt = parseInt(postId, 10);
      if (isNaN(postIdInt)) {
        console.warn('유효하지 않은 postId:', postId);
        return { success: false, reason: 'invalid_post_id' };
      }

      // 열람 기록 추가 (중복 시 무시)
      const { error } = await supabase
        .from('user_post_views')
        .upsert({
          user_id: user.id,
          post_id: postIdInt,
          viewed_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,post_id',
          ignoreDuplicates: true
        });

      if (error) {
        // 중복 에러는 무시 (이미 본 게시물)
        if (error.code === '23505') {
          return { success: true, alreadyViewed: true };
        }
        console.warn('열람 기록 저장 실패:', error);
        return { success: false, reason: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('열람 기록 저장 예외:', error);
      return { success: false, reason: error.message };
    }
  },

  /**
   * 관리자 전용: 게시물 고정/고정 해제
   * @param {string|number} postId - 게시물 ID
   * @param {boolean} isPinned - 고정 여부
   */
  async setPinned(postId, isPinned) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      const { data, error } = await supabase
        .from('posts')
        .update({
          is_pinned: isPinned,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('게시물 고정 설정 오류:', error);
      throw error;
    }
  },

  /**
   * hot_score 수동 갱신 (관리자용)
   * Supabase Function 호출
   */
  async refreshHotScores() {
    try {
      const { data, error } = await supabase.rpc('update_all_hot_scores');

      if (error) throw error;

      return { success: true, updatedCount: data };
    } catch (error) {
      console.error('hot_score 갱신 오류:', error);
      throw error;
    }
  }
};

export default postService;
