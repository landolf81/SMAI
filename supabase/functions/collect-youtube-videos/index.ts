import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY')

interface YouTubeChannel {
  id: string
  channel_id: string
  channel_name: string
  filter_keywords: string[] | null
  is_active: boolean
}

interface RSSItem {
  videoId: string
  title: string
  description: string
  publishedAt: string
  channelId: string
}

/**
 * RSS 피드에서 영상 목록 파싱
 */
async function fetchRSSFeed(channelId: string): Promise<RSSItem[]> {
  try {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
    const response = await fetch(rssUrl)

    if (!response.ok) {
      console.error(`RSS 피드 조회 실패: ${channelId}`)
      return []
    }

    const xml = await response.text()
    const items: RSSItem[] = []

    // 간단한 XML 파싱 (entry 태그 추출)
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
    let match

    while ((match = entryRegex.exec(xml)) !== null) {
      const entry = match[1]

      const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)
      const titleMatch = entry.match(/<title>([^<]+)<\/title>/)
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/)
      const descriptionMatch = entry.match(/<media:description>([^<]*)<\/media:description>/)

      if (videoIdMatch && titleMatch) {
        items.push({
          videoId: videoIdMatch[1],
          title: titleMatch[1],
          description: descriptionMatch ? descriptionMatch[1] : '',
          publishedAt: publishedMatch ? publishedMatch[1] : new Date().toISOString(),
          channelId: channelId
        })
      }
    }

    return items
  } catch (error) {
    console.error(`RSS 피드 파싱 오류 (${channelId}):`, error)
    return []
  }
}

/**
 * YouTube API로 키워드 검색 (선택적)
 */
async function searchYouTube(query: string): Promise<RSSItem[]> {
  if (!YOUTUBE_API_KEY) {
    console.log('YouTube API 키가 없어 검색을 건너뜁니다.')
    return []
  }

  try {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search')
    searchUrl.searchParams.set('part', 'snippet')
    searchUrl.searchParams.set('q', query)
    searchUrl.searchParams.set('type', 'video')
    searchUrl.searchParams.set('order', 'date')
    searchUrl.searchParams.set('maxResults', '10')
    searchUrl.searchParams.set('publishedAfter', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    searchUrl.searchParams.set('key', YOUTUBE_API_KEY)

    const response = await fetch(searchUrl.toString())

    if (!response.ok) {
      console.error('YouTube API 오류:', response.status)
      return []
    }

    const data = await response.json()

    return (data.items || []).map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      channelId: item.snippet.channelId
    }))
  } catch (error) {
    console.error('YouTube 검색 오류:', error)
    return []
  }
}

/**
 * 키워드 필터링
 */
function matchesKeywords(title: string, description: string, keywords: string[] | null): boolean {
  if (!keywords || keywords.length === 0) {
    return true // 키워드 없으면 모두 통과
  }

  const text = `${title} ${description}`.toLowerCase()
  return keywords.some(keyword => text.includes(keyword.toLowerCase()))
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // 1. 활성화된 채널 목록 조회
    const { data: channels, error: channelsError } = await supabase
      .from('youtube_channels')
      .select('*')
      .eq('is_active', true)

    if (channelsError) {
      throw new Error(`채널 조회 오류: ${channelsError.message}`)
    }

    if (!channels || channels.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: '활성화된 채널이 없습니다.',
        collected: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const allVideos: any[] = []
    const existingVideoIds = new Set<string>()

    // 기존 영상 ID 조회 (중복 방지)
    const { data: existingVideos } = await supabase
      .from('youtube_videos')
      .select('video_id')

    if (existingVideos) {
      existingVideos.forEach(v => existingVideoIds.add(v.video_id))
    }

    // 2. 각 채널 RSS 수집
    for (const channel of channels as YouTubeChannel[]) {
      console.log(`채널 수집 중: ${channel.channel_name}`)

      const rssItems = await fetchRSSFeed(channel.channel_id)

      for (const item of rssItems) {
        // 중복 체크
        if (existingVideoIds.has(item.videoId)) {
          continue
        }

        // 키워드 필터링
        if (!matchesKeywords(item.title, item.description, channel.filter_keywords)) {
          console.log(`키워드 불일치로 스킵: ${item.title}`)
          continue
        }

        allVideos.push({
          video_id: item.videoId,
          channel_id: item.channelId,
          title: item.title,
          description: item.description,
          thumbnail_url: `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
          published_at: item.publishedAt,
          source: 'rss',
          status: 'pending'
        })

        existingVideoIds.add(item.videoId)
      }
    }

    // 3. YouTube API 키워드 검색 (선택적)
    if (YOUTUBE_API_KEY) {
      const searchQueries = ['참외 재배', '참외 농사', '성주 참외']

      for (const query of searchQueries) {
        console.log(`키워드 검색 중: ${query}`)
        const searchItems = await searchYouTube(query)

        for (const item of searchItems) {
          if (existingVideoIds.has(item.videoId)) {
            continue
          }

          allVideos.push({
            video_id: item.videoId,
            channel_id: item.channelId,
            title: item.title,
            description: item.description,
            thumbnail_url: `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
            published_at: item.publishedAt,
            source: 'search',
            status: 'pending'
          })

          existingVideoIds.add(item.videoId)
        }
      }
    }

    // 4. DB에 저장
    if (allVideos.length > 0) {
      const { error: insertError } = await supabase
        .from('youtube_videos')
        .insert(allVideos)

      if (insertError) {
        console.error('영상 저장 오류:', insertError)
      }
    }

    console.log(`수집 완료: ${allVideos.length}개 영상`)

    return new Response(JSON.stringify({
      success: true,
      collected: allVideos.length,
      channels: channels.length,
      videos: allVideos.map(v => ({ id: v.video_id, title: v.title }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('수집 오류:', error)

    return new Response(JSON.stringify({
      success: false,
      error: String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
