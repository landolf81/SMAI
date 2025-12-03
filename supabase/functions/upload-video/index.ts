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
    const { maxDurationSeconds = 120 } = await req.json()

    // Direct Creator Upload URL 요청
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: Math.min(maxDurationSeconds, 120), // 최대 2분
          requireSignedURLs: false,
          allowedOrigins: ['*'],
          meta: {
            uploadedAt: new Date().toISOString(),
          },
        }),
      }
    )

    const data = await response.json()

    if (!data.success) {
      console.error('Cloudflare API error:', data.errors)
      throw new Error(data.errors?.[0]?.message || 'Upload URL 생성 실패')
    }

    return new Response(
      JSON.stringify({
        uploadURL: data.result.uploadURL,
        uid: data.result.uid,
      }),
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
