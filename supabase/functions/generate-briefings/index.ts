// Retired AI weather/auction briefing endpoint. No provider call or DB write.
// Existing deployed functions/cron are unchanged until a separately approved rollout.
Deno.serve(() => new Response(JSON.stringify({ error: 'AI briefings have been retired' }), {
  status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
}))
