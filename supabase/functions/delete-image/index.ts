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
    const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_TOKEN') // Images도 같은 토큰 사용

    if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
      console.error('Missing Cloudflare credentials')
      return new Response(
        JSON.stringify({ success: false, error: 'Cloudflare 인증 정보가 없습니다.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const { imageId } = await req.json()

    if (!imageId) {
      return new Response(
        JSON.stringify({ success: false, error: '이미지 ID가 필요합니다.' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Deleting image:', imageId)

    // Cloudflare Images 삭제 API
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v1/${imageId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
        },
      }
    )

    // 404는 이미 삭제된 것으로 성공 처리
    if (response.status === 404) {
      console.log('Image already deleted:', imageId)
      return new Response(
        JSON.stringify({ success: true, message: '이미 삭제된 이미지입니다.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // DELETE 성공
    if (response.status === 200 || response.status === 204) {
      console.log('Image deleted successfully:', imageId)
      return new Response(
        JSON.stringify({ success: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 그 외 에러
    const data = await response.json().catch(() => ({}))
    console.error('Cloudflare Images API error:', response.status, data)

    return new Response(
      JSON.stringify({ success: false, error: data.errors?.[0]?.message || '이미지 삭제 실패' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
