// Supabase Edge Function: Link Preview
// 웹페이지의 Open Graph 메타데이터를 추출합니다

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { load } from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// X(Twitter) oEmbed API로 미리보기 가져오기
async function fetchTwitterPreview(url: string) {
  try {
    const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true`
    const response = await fetch(oembedUrl)
    if (!response.ok) return null

    const data = await response.json()
    return {
      url,
      title: data.author_name ? `${data.author_name}의 게시물` : 'X 게시물',
      description: null, // oEmbed에서 텍스트 내용은 HTML로만 제공됨
      image: null,
      siteName: 'X (Twitter)',
      favicon: 'https://abs.twimg.com/favicons/twitter.2.ico',
      html: data.html, // 임베드 HTML (선택적 사용)
      authorName: data.author_name,
      authorUrl: data.author_url
    }
  } catch (e) {
    console.error('Twitter oEmbed error:', e)
    return null
  }
}

// Instagram oEmbed API로 미리보기 가져오기
async function fetchInstagramPreview(url: string) {
  try {
    const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&omitscript=true`
    const response = await fetch(oembedUrl)
    if (!response.ok) return null

    const data = await response.json()
    return {
      url,
      title: data.author_name ? `${data.author_name}의 게시물` : 'Instagram 게시물',
      description: null,
      image: data.thumbnail_url || null,
      siteName: 'Instagram',
      favicon: 'https://www.instagram.com/favicon.ico',
      html: data.html,
      authorName: data.author_name,
      authorUrl: `https://www.instagram.com/${data.author_name}/`
    }
  } catch (e) {
    console.error('Instagram oEmbed error:', e)
    return null
  }
}

// URL이 특정 플랫폼인지 확인
function getPlatform(url: string): string | null {
  const hostname = new URL(url).hostname.toLowerCase()

  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    return 'twitter'
  }
  if (hostname.includes('instagram.com')) {
    return 'instagram'
  }
  return null
}

serve(async (req) => {
  // CORS preflight 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // URL 유효성 검사
    let targetUrl: URL
    try {
      targetUrl = new URL(url)
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('Fetching link preview for:', url)

    // 특정 플랫폼은 oEmbed API 사용
    const platform = getPlatform(url)

    if (platform === 'twitter') {
      const twitterPreview = await fetchTwitterPreview(url)
      if (twitterPreview) {
        console.log('Twitter preview extracted:', twitterPreview)
        return new Response(
          JSON.stringify(twitterPreview),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (platform === 'instagram') {
      const instagramPreview = await fetchInstagramPreview(url)
      if (instagramPreview) {
        console.log('Instagram preview extracted:', instagramPreview)
        return new Response(
          JSON.stringify(instagramPreview),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 일반 웹페이지 HTML 가져오기
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const html = await response.text()
    const $ = load(html)

    // Open Graph 메타데이터 추출
    const metadata = {
      url: url,
      title: null as string | null,
      description: null as string | null,
      image: null as string | null,
      siteName: null as string | null,
      favicon: null as string | null
    }

    // OG 태그 우선
    metadata.title = $('meta[property="og:title"]').attr('content') ||
                     $('meta[name="twitter:title"]').attr('content') ||
                     $('title').text() ||
                     null

    metadata.description = $('meta[property="og:description"]').attr('content') ||
                          $('meta[name="twitter:description"]').attr('content') ||
                          $('meta[name="description"]').attr('content') ||
                          null

    metadata.image = $('meta[property="og:image"]').attr('content') ||
                     $('meta[name="twitter:image"]').attr('content') ||
                     null

    metadata.siteName = $('meta[property="og:site_name"]').attr('content') ||
                        targetUrl.hostname.replace('www.', '') ||
                        null

    // 파비콘 추출
    const favicon = $('link[rel="icon"]').attr('href') ||
                   $('link[rel="shortcut icon"]').attr('href') ||
                   '/favicon.ico'

    // 상대 URL을 절대 URL로 변환
    if (favicon && !favicon.startsWith('http')) {
      metadata.favicon = `${targetUrl.protocol}//${targetUrl.host}${favicon.startsWith('/') ? '' : '/'}${favicon}`
    } else {
      metadata.favicon = favicon
    }

    // 이미지도 절대 URL로 변환
    if (metadata.image && !metadata.image.startsWith('http')) {
      metadata.image = `${targetUrl.protocol}//${targetUrl.host}${metadata.image.startsWith('/') ? '' : '/'}${metadata.image}`
    }

    console.log('Link preview extracted:', metadata)

    return new Response(
      JSON.stringify(metadata),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Link preview error:', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch link preview',
        message: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
