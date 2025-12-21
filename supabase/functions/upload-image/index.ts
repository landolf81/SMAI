import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const CF_ACCOUNT_ID = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!
const CF_API_TOKEN = Deno.env.get('CLOUDFLARE_STREAM_TOKEN')! // Stream과 Images는 같은 토큰 사용 가능

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
    const { requireSignedURLs = false, metadata = {} } = await req.json()

    // Direct Creator Upload URL 요청 - FormData 사용
    const formData = new FormData()
    formData.append('requireSignedURLs', String(requireSignedURLs))

    // metadata를 개별 필드로 추가
    const fullMetadata = {
      ...metadata,
      uploadedAt: new Date().toISOString(),
    }
    formData.append('metadata', JSON.stringify(fullMetadata))

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/images/v2/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_API_TOKEN}`,
          // Content-Type은 FormData가 자동으로 설정 (boundary 포함)
        },
        body: formData,
      }
    )

    const data = await response.json()

    if (!data.success) {
      console.error('Cloudflare Images API error:', data.errors)
      throw new Error(data.errors?.[0]?.message || 'Upload URL 생성 실패')
    }

    return new Response(
      JSON.stringify({
        uploadURL: data.result.uploadURL,
        id: data.result.id,
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
