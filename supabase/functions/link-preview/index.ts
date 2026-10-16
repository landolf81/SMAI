import { previewURL, canFetchPreview, fetchPreviewText } from '../_shared/previewFetch.ts'
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
    const data = JSON.parse(await fetchPreviewText(oembedUrl))
    return {
      url,
      title: data.author_name ? `${data.author_name}의 게시물` : 'X 게시물',
      description: null, // oEmbed에서 텍스트 내용은 HTML로만 제공됨
      image: null,
      siteName: 'X (Twitter)',
      favicon: 'https://abs.twimg.com/favicons/twitter.2.ico',
      authorName: data.author_name,
      authorUrl: data.author_url
    }
  } catch (e) {
    console.warn('Twitter preview unavailable')
    return null
  }
}

// Instagram oEmbed API로 미리보기 가져오기
async function fetchInstagramPreview(url: string) {
  try {
    const oembedUrl = `https://api.instagram.com/oembed?url=${encodeURIComponent(url)}&omitscript=true`
    const data = JSON.parse(await fetchPreviewText(oembedUrl))
    return {
      url,
      title: data.author_name ? `${data.author_name}의 게시물` : 'Instagram 게시물',
      description: null,
      image: data.thumbnail_url || null,
      siteName: 'Instagram',
      favicon: 'https://www.instagram.com/favicon.ico',
      authorName: data.author_name,
      authorUrl: `https://www.instagram.com/${data.author_name}/`
    }
  } catch (e) {
    console.warn('Instagram preview unavailable')
    return null
  }
}

// URL이 특정 플랫폼인지 확인
function getPlatform(url: string): string | null {
  const hostname = new URL(url).hostname.toLowerCase()

  if (['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'].includes(hostname)) {
    return 'twitter'
  }
  if (['instagram.com', 'www.instagram.com'].includes(hostname)) {
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
    if (req.method !== 'POST') return new Response(null, { status: 405, headers: corsHeaders })
    const raw = await req.text()
    if (raw.length > 4096) return new Response(null, { status: 413, headers: corsHeaders })
    const { url } = JSON.parse(raw)

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
      targetUrl = previewURL(url)
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid URL' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const basic = { url: targetUrl.href, title: targetUrl.hostname, description: null,
      image: null, siteName: targetUrl.hostname, favicon: null, blocked: true }
    // Arbitrary external links still render, without fetching their origin server-side.
    if (!canFetchPreview(targetUrl)) return Response.json(basic, { headers: corsHeaders })

    // 특정 플랫폼은 oEmbed API 사용
    const platform = getPlatform(url)

    if (platform === 'twitter') {
      const twitterPreview = await fetchTwitterPreview(url)
      if (twitterPreview) {
        return new Response(
          JSON.stringify(twitterPreview),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    if (platform === 'instagram') {
      const instagramPreview = await fetchInstagramPreview(url)
      if (instagramPreview) {
        return new Response(
          JSON.stringify(instagramPreview),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // 일반 웹페이지 HTML 가져오기
    // 네이버 등 일부 사이트는 Googlebot을 차단하므로 일반 브라우저 User-Agent 사용
    let html: string
    try { html = await fetchPreviewText(targetUrl) }
    catch { return Response.json(basic, { headers: corsHeaders }) }
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

    const safeAsset = (value: string | null) => {
      if (!value) return null
      try { return previewURL(new URL(value, targetUrl).href).href } catch { return null }
    }
    metadata.favicon = safeAsset(favicon)
    metadata.image = safeAsset(metadata.image)


    return new Response(
      JSON.stringify(metadata),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.warn('Link preview unavailable')

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch link preview'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
