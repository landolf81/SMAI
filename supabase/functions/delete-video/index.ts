import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CF_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!
const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_TOKEN')!

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
    const { uid } = await req.json()

    if (!uid) {
      throw new Error('동영상 UID가 필요합니다.')
    }

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

    const data = await response.json()

    if (!data.success) {
      // 이미 삭제된 경우 (404)는 성공으로 처리
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ success: true, message: '이미 삭제된 동영상입니다.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }
      console.error('Cloudflare API error:', data.errors)
      throw new Error(data.errors?.[0]?.message || '동영상 삭제 실패')
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
