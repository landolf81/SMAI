-- Separate, optional activation step. Requires user's approval of pg_cron scheduling.
-- Enable pg_cron through Supabase Extensions first, then run this file yourself.
-- Every 5 minutes: physical cache retention <= approximately 20 minutes, access TTL 15 minutes.
begin;
select cron.schedule('translation-gateway-cleanup', '*/5 * * * *', $cleanup$
  delete from translation_private.jobs where retain_until < now();
  update translation_private.jobs set result=null, audio_result=null, state='expired', tts_state='expired'
    where expires_at < now() and (result is not null or audio_result is not null or state <> 'expired');
  delete from translation_private.nonces where created_at < now() - interval '2 minutes';
  delete from translation_private.counters where expires_at < now();
$cleanup$);

commit;
