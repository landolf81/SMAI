import { supabase } from '../config/supabase.js';
import { deleteFromR2, isR2Url } from './r2Service.js';

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
      // 현재 로그인 사용자 확인 (읽기 전용 - 캐시된 세션 사용)
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;

      let posts = [];

      // algorithm 모드: DB 함수로 개인화 피드 조회 (열람 횟수 + 고정 + 최신글 로직 포함)
      if (sortBy === 'algorithm' && !userId && !search) {
        const { data: feedData, error: feedError } = await supabase
          .rpc('get_personalized_feed', {
            p_user_id: currentUser?.id || null,
            p_post_type: postType || 'general',
            p_limit: limit,
            p_offset: offset
          });

        if (feedError) {
          console.error('개인화 피드 조회 오류:', feedError);
          // 폴백: 기본 쿼리로 진행
        } else if (feedData) {
          // feedData가 빈 배열이면 바로 빈 배열 반환 (더 이상 데이터 없음)
          if (feedData.length === 0) {
            return [];
          }

          // DB 함수에서 반환된 post_id로 전체 데이터 조회
          const postIds = feedData.map(p => p.id);

          const { data: fullPosts, error: postsError } = await supabase
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
            .in('id', postIds);

          if (!postsError && fullPosts) {
            // DB 함수의 정렬 순서 유지 (feedData 순서대로)
            const postsMap = {};
            fullPosts.forEach(p => { postsMap[p.id] = p; });

            // feedData에서 view_count, final_score 매핑
            const scoreMap = {};
            feedData.forEach(f => {
              scoreMap[f.id] = { viewCount: f.view_count, finalScore: f.final_score };
            });

            posts = feedData
              .map(f => postsMap[f.id])
              .filter(p => p !== undefined)
              .map(p => ({
                ...p,
                viewCount: scoreMap[p.id]?.viewCount || 0,
                finalScore: scoreMap[p.id]?.finalScore || 0
              }));
          }
        }
      }

      // algorithm 모드 외 또는 폴백 시 기본 쿼리
      if (posts.length === 0) {
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
          `)
          .or('is_hidden.is.null,is_hidden.eq.false');

        // 정렬 방식 선택
        if (sortBy === 'latest') {
          query = query.order('created_at', { ascending: false });
        } else if (sortBy === 'popular') {
          query = query.order('hot_score', { ascending: false });
        } else {
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

        const { data: queryPosts, error: postsError } = await query;

        if (postsError) {
          console.error('게시물 조회 오류:', postsError);
          return [];
        }

        posts = queryPosts || [];
      }

      if (!posts || posts.length === 0) {
        return [];
      }

      // 2. 모든 게시물 ID 추출
      const postIds = posts.map(p => p.id);

      // 3. 관련 데이터를 병렬로 조회 (태그, 중고거래 정보)
      const queryPromises = [
        supabase
          .from('post_tags')
          .select('post_id, is_primary, tags(id, name, display_name, color)')
          .in('post_id', postIds),
        supabase
          .from('trade_items')
          .select('post_id, status, item_name, price')
          .in('post_id', postIds)
      ];

      const results = await Promise.all(queryPromises);
      const [tagsData, tradeItemsData] = results;

      // 4. 데이터를 맵으로 변환
      const tagsMap = {};
      const primaryTagMap = {};
      tagsData.data?.forEach(pt => {
        if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
        if (pt.tags) {
          tagsMap[pt.post_id].push(pt.tags);
          if (pt.is_primary) {
            primaryTagMap[pt.post_id] = pt.tags;
          }
        }
      });

      const tradeInfoMap = {};
      tradeItemsData?.data?.forEach(item => {
        tradeInfoMap[item.post_id] = item;
      });

      // 5. 데이터 변환: Supabase 형식 → 프론트엔드 형식
      let postsWithDetails = posts.map((post) => {
        const viewCount = post.viewCount || 0;
        const finalScore = post.finalScore || (post.hot_score || 0);

        return {
          ...post,
          desc: post.description,
          content: post.description,
          img: post.photo,
          userId: post.user_id,
          createdAt: post.created_at,
          updatedAt: post.updated_at,
          username: post.users?.username || '',
          name: post.users?.name || '',
          profilePic: post.users?.profile_pic || 'defaultAvatar.png',
          user: post.users || null,
          tags: tagsMap[post.id] || [],
          primaryTag: primaryTagMap[post.id] || null,
          likesCount: post.likes_count || 0,
          commentsCount: post.comments_count || 0,
          tradeInfo: tradeInfoMap[post.id] || null,
          viewCount,
          isViewed: viewCount > 0,
          finalScore
        };
      });

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

      // 3. 현재 사용자 정보 가져오기 (읽기 전용 - 캐시된 세션 사용)
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user;

      // 숨김 처리된 게시물은 접근 불가 (단, 작성자 본인은 접근 가능)
      if (post.is_hidden === true) {
        const isOwner = currentUser && post.user_id === currentUser.id;
        if (!isOwner) {
          throw new Error('숨김 처리된 게시물입니다.');
        }
      }

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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
   * 게시물 삭제 (첨부파일도 함께 삭제)
   * @param {string} postId - 게시물 ID
   */
  async deletePost(postId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 1. 먼저 게시물 정보 조회 (첨부파일 URL 확인)
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('photo')
        .eq('id', postId)
        .eq('user_id', user.id)
        .single();

      if (!fetchError && post) {
        // 2. 첨부파일 삭제
        await this._deletePostMedia(post);
      }

      // 3. 게시물 삭제
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
   * 게시물 첨부파일 삭제 (내부 헬퍼)
   * @param {Object} post - 게시물 객체
   */
  async _deletePostMedia(post) {
    try {
      const mediaUrls = [];

      // photo 필드 처리 (배열 또는 문자열)
      if (post.photo) {
        if (Array.isArray(post.photo)) {
          mediaUrls.push(...post.photo);
        } else if (typeof post.photo === 'string') {
          // JSON 배열 문자열인 경우
          try {
            const parsed = JSON.parse(post.photo);
            if (Array.isArray(parsed)) {
              mediaUrls.push(...parsed);
            } else {
              mediaUrls.push(post.photo);
            }
          } catch {
            mediaUrls.push(post.photo);
          }
        }
      }

      // 각 미디어 파일 삭제
      for (const url of mediaUrls) {
        if (!url) continue;
        try {
          if (url.includes('cloudflarestream.com')) {
            // Cloudflare Stream 동영상 삭제
            // URL 형식: https://customer-xxx.cloudflarestream.com/{uid}/...
            const uidMatch = url.match(/cloudflarestream\.com\/([a-zA-Z0-9]+)/);
            if (uidMatch && uidMatch[1]) {
              const uid = uidMatch[1];
              await supabase.functions.invoke('delete-video', {
                body: { uid }
              });
            }
          } else if (isR2Url(url)) {
            // R2 URL에서 키 추출 후 삭제
            const key = url.split('.r2.dev/')[1] || url.split('r2.cloudflarestorage.com/')[1];
            if (key) {
              await deleteFromR2(key);
            }
          } else if (url.includes('supabase.co/storage')) {
            // Supabase Storage URL 처리
            const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
            if (match) {
              const [, bucket, path] = match;
              await supabase.storage.from(bucket).remove([path]);
            }
          }
        } catch (mediaError) {
          // 삭제 실패해도 계속 진행
          console.warn('미디어 삭제 실패:', url, mediaError);
        }
      }
    } catch (error) {
      // 첨부파일 삭제 실패해도 게시물 삭제는 계속
      console.warn('첨부파일 삭제 중 오류:', error);
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      // 읽기 전용 - 캐시된 세션 사용
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      // postId를 정수로 변환 (posts.id가 bigint인 경우)
      const postIdInt = parseInt(postId, 10);
      if (isNaN(postIdInt)) {
        console.warn('유효하지 않은 postId:', postId);
        return { success: false };
      }

      // 비로그인 사용자용 고유 세션 ID (localStorage에 영구 저장)
      const getOrCreateSessionId = () => {
        let sessionId = localStorage.getItem('anonymous_session_id');
        if (!sessionId) {
          sessionId = 'anon_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
          localStorage.setItem('anonymous_session_id', sessionId);
        }
        return sessionId;
      };

      // post_views 테이블에 조회 기록 삽입 (로그인/비로그인 모두)
      // partial unique index는 upsert에서 사용 불가하므로 조회 후 insert 방식 사용
      const sessionId = user ? null : getOrCreateSessionId();

      // 기존 조회 기록 확인
      let existingViewQuery = supabase
        .from('post_views')
        .select('id')
        .eq('post_id', postIdInt);

      if (user) {
        existingViewQuery = existingViewQuery.eq('user_id', user.id);
      } else {
        existingViewQuery = existingViewQuery.eq('session_id', sessionId);
      }

      const { data: existingView } = await existingViewQuery.maybeSingle();

      // 이미 조회한 경우 조회수 증가하지 않음
      if (existingView) {
        return { success: true, alreadyViewed: true };
      }

      // 새로운 조회 기록 추가
      const { error: viewError } = await supabase
        .from('post_views')
        .insert({
          post_id: postIdInt,
          user_id: user?.id || null,
          viewed_at: new Date().toISOString(),
          ip_address: 'unknown',
          session_id: sessionId
        });

      if (viewError) {
        // 동시 삽입으로 인한 중복 에러는 무시 (이미 다른 요청에서 삽입됨)
        if (viewError.code === '23505') {
          return { success: true, alreadyViewed: true };
        }
        console.warn('조회 기록 추가 실패:', viewError.code, viewError.message);
        return { success: false };
      }

      // posts.views_count 증가
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 기본 쿼리 (관계 쿼리 제거)
      let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      // 검색 필터
      if (options.search) {
        query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
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

      // 최적화: 모든 게시물 ID를 한 번에 조회 (N+1 쿼리 방지)
      const postIds = posts.map(p => p.id);
      const userIds = [...new Set(posts.map(p => p.user_id))];

      // 1. 사용자 정보 일괄 조회
      const { data: users } = await supabase
        .from('users')
        .select('id, username, name, profile_pic')
        .in('id', userIds);
      const usersMap = (users || []).reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});

      // 2. 좋아요 데이터 일괄 조회
      const { data: likesData } = await supabase
        .from('likes')
        .select('post_id')
        .in('post_id', postIds);
      const likesMap = (likesData || []).reduce((acc, like) => {
        acc[like.post_id] = (acc[like.post_id] || 0) + 1;
        return acc;
      }, {});

      // 3. 댓글 데이터 일괄 조회
      const { data: commentsData } = await supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds)
        .eq('is_hidden', false);
      const commentsMap = (commentsData || []).reduce((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] || 0) + 1;
        return acc;
      }, {});

      // 4. 태그 데이터 일괄 조회
      const { data: postTagsData } = await supabase
        .from('post_tags')
        .select('post_id, tag_id')
        .in('post_id', postIds);

      // 태그 ID 추출 및 태그 정보 조회
      let tagsMap = {};
      if (postTagsData && postTagsData.length > 0) {
        const tagIds = [...new Set(postTagsData.map(pt => pt.tag_id))];
        const { data: tagsData } = await supabase
          .from('tags')
          .select('id, name, display_name, color')
          .in('id', tagIds);

        const tagsById = (tagsData || []).reduce((acc, tag) => {
          acc[tag.id] = tag;
          return acc;
        }, {});

        // 게시물별 태그 매핑
        postTagsData.forEach(pt => {
          if (!tagsMap[pt.post_id]) tagsMap[pt.post_id] = [];
          if (tagsById[pt.tag_id]) {
            tagsMap[pt.post_id].push(tagsById[pt.tag_id]);
          }
        });
      }

      // 5. 게시물에 데이터 결합
      const postsWithDetails = posts.map(post => ({
        ...post,
        user: usersMap[post.user_id] || null,
        tags: tagsMap[post.id] || [],
        likesCount: likesMap[post.id] || 0,
        commentsCount: commentsMap[post.id] || 0
      }));

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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
   * 관리자 전용: 게시물 삭제 (권한 체크 없음, 첨부파일도 삭제)
   * @param {string} postId - 게시물 ID
   */
  async deletePostAdmin(postId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('인증되지 않은 사용자입니다.');

      // 1. 먼저 게시물 정보 조회 (첨부파일 URL 확인)
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('photo')
        .eq('id', postId)
        .single();

      if (!fetchError && post) {
        // 2. 첨부파일 삭제
        await this._deletePostMedia(post);
      }

      // 3. 게시물 삭제
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
      // 읽기 전용 세션 사용 (열람 기록은 빈번하게 호출되므로 getUser HTTP 요청 회피)
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return { success: false, reason: 'not_logged_in' };

      const postIdInt = parseInt(postId, 10);
      if (isNaN(postIdInt)) {
        console.warn('유효하지 않은 postId:', postId);
        return { success: false, reason: 'invalid_post_id' };
      }

      // RPC 함수 사용하여 upsert 처리 (중복 키 에러 방지)
      const { error } = await supabase.rpc('upsert_user_post_view', {
        p_user_id: user.id,
        p_post_id: postIdInt
      });

      if (error) {
        // RPC 함수가 없으면 기존 방식 시도 (PGRST202: 함수 없음, 42883: 시그니처 없음)
        if (error.code === '42883' || error.code === 'PGRST202') {
          // 기존 기록 확인
          const { data: existingView } = await supabase
            .from('user_post_views')
            .select('view_count')
            .eq('user_id', user.id)
            .eq('post_id', postIdInt)
            .maybeSingle();

          if (existingView) {
            // 기존 기록 있으면 업데이트 (횟수 증가는 생략 - 조회 시간만 업데이트)
            await supabase
              .from('user_post_views')
              .update({ viewed_at: new Date().toISOString() })
              .eq('user_id', user.id)
              .eq('post_id', postIdInt);
            return { success: true, reason: 'updated' };
          } else {
            // 신규 기록 추가
            const { error: insertError } = await supabase
              .from('user_post_views')
              .insert({
                user_id: user.id,
                post_id: postIdInt,
                view_count: 1,
                viewed_at: new Date().toISOString()
              });

            // 중복 키 에러는 무시 (race condition)
            if (insertError && insertError.code !== '23505') {
              return { success: false, reason: insertError.message };
            }
            return { success: true, viewCount: 1 };
          }
        }
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
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
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
  },

  /**
   * 게시물 저장 (Supabase saved_posts 테이블)
   * @param {string} postId - 게시물 ID
   * @param {string} userId - 사용자 ID
   */
  async savePost(postId, userId) {
    try {
      const { error } = await supabase
        .from('saved_posts')
        .insert([{
          user_id: userId,
          post_id: postId
        }]);

      if (error) {
        // 이미 저장된 경우 (중복) 무시
        if (error.code === '23505') {
          return { success: true, alreadySaved: true };
        }
        throw error;
      }
      return { success: true };
    } catch (error) {
      console.error('게시물 저장 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 저장 취소
   * @param {string} postId - 게시물 ID
   * @param {string} userId - 사용자 ID
   */
  async unsavePost(postId, userId) {
    try {
      const { error } = await supabase
        .from('saved_posts')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('게시물 저장 취소 오류:', error);
      throw error;
    }
  },

  /**
   * 게시물 저장 여부 확인
   * @param {string} postId - 게시물 ID
   * @param {string} userId - 사용자 ID
   */
  async isPostSaved(postId, userId) {
    try {
      const { data, error } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('저장 여부 확인 오류:', error);
      return false;
    }
  },

  /**
   * 저장된 게시물 목록 조회 (상세 정보 포함)
   * @param {string} userId - 사용자 ID
   */
  async getSavedPosts(userId) {
    try {
      // saved_posts에서 저장된 게시물 ID 조회 (최신순)
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (savedError) throw savedError;
      if (!savedData || savedData.length === 0) return [];

      const postIds = savedData.map(s => s.post_id);

      // 저장된 게시물 상세 정보 조회
      const { data: posts, error: postsError } = await supabase
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
        .in('id', postIds)
        .or('is_hidden.is.null,is_hidden.eq.false');

      if (postsError) throw postsError;

      // 저장 순서 유지 (최신 저장이 맨 앞)
      const postsMap = {};
      posts.forEach(p => { postsMap[p.id] = p; });

      const orderedPosts = postIds
        .map(id => postsMap[id])
        .filter(p => p !== undefined);

      // 데이터 변환
      return orderedPosts.map(post => ({
        ...post,
        desc: post.description,
        content: post.description,
        img: post.photo,
        userId: post.user_id,
        createdAt: post.created_at,
        username: post.users?.username || '',
        name: post.users?.name || '',
        profilePic: post.users?.profile_pic || 'defaultAvatar.png',
        user: post.users || null
      }));
    } catch (error) {
      console.error('저장된 게시물 조회 오류:', error);
      return [];
    }
  }
};

export default postService;
