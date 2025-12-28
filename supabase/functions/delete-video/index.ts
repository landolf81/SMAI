import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const CF_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
    const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_TOKEN')

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
      console.error('Missing Cloudflare credentials')
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudflare 인증 정보가 없습니다.' }),
        {
          status: 200, // 게시물 삭제는 계속 진행되어야 하므로 200 반환
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { uid } = await req.json()

    if (!uid) {
      return new Response(
        JSON.stringify({ success: false, error: '동영상 UID가 필요합니다.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Deleting video:', uid)

    // Cloudflare Stream 동영상 삭제 API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${uid}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
        },
      }
    )

    // 404는 이미 삭제된 것으로 성공 처리
    if (response.status === 404) {
      console.log('Video already deleted:', uid)
      return new Response(
        JSON.stringify({ success: true, message: '이미 삭제된 동영상입니다.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // DELETE 성공 시 응답 본문이 없을 수 있음
    if (response.status === 200 || response.status === 204) {
      console.log('Video deleted successfully:', uid)
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 그 외 에러
    const data = await response.json().catch(() => ({}))
    console.error('Cloudflare API error:', response.status, data)

    return new Response(
      JSON.stringify({ success: false, error: data.errors?.[0]?.message || '동영상 삭제 실패' }),
      {
        status: 200, // 게시물 삭제는 계속 진행
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 200, // 게시물 삭제는 계속 진행
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
