-- Approved test preparation; apply as one transaction after confirming target DB.
begin;
-- No service_role is required. Only this HMAC-verified RPC can modify private gateway data.
create schema if not exists translation_private;
revoke all on schema translation_private from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;
create table translation_private.settings (singleton boolean primary key default true check(singleton), signing_secret text not null check(length(signing_secret) >= 32));
-- User securely inserts the same secret as server TRANSLATION_RPC_SECRET; never commit a value.
create table translation_private.nonces (id uuid primary key, created_at timestamptz not null default now());
create table translation_private.counters (bucket text primary key, used integer not null, expires_at timestamptz not null);
create table translation_private.jobs (
  id uuid primary key, identity text not null, fingerprint text not null,
  state text not null default 'pending', tts_state text not null default 'new',
  tts_fingerprint text, result jsonb, audio_result jsonb,
  expires_at timestamptz not null default now() + interval '15 minutes',
  retain_until timestamptz not null default now() + interval '25 hours'
);
revoke all on all tables in schema translation_private from public, anon, authenticated;
create or replace function public.translation_gateway(p_payload text, p_signature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  secret text; p jsonb; j translation_private.jobs%rowtype;
  t timestamptz := clock_timestamp(); op text; owner text; jid uuid;
  scopes jsonb; item jsonb; b text; current_used integer; n integer;
begin
  if octet_length(p_payload) > 4300000 then return jsonb_build_object('status','invalid'); end if;
  select signing_secret into secret from translation_private.settings where singleton;
  if secret is null or p_signature is null or p_signature <> encode(extensions.hmac(convert_to(p_payload,'UTF8'),convert_to(secret,'UTF8'),'sha256'),'hex') then
    return jsonb_build_object('status','invalid');
  end if;
  p := p_payload::jsonb;
  if abs(extract(epoch from t) - (p->>'timestamp')::bigint) > 60 then return jsonb_build_object('status','invalid'); end if;
  -- Serialize reservation and state transitions across every server instance.
  perform pg_catalog.pg_advisory_xact_lock(609302026);
  delete from translation_private.nonces where created_at < t - interval '2 minutes';
  delete from translation_private.jobs where retain_until < t;
  update translation_private.jobs set result=null, audio_result=null, state='expired', tts_state='expired'
    where expires_at < t and (result is not null or audio_result is not null or state <> 'expired');
  delete from translation_private.counters where expires_at < t;
  insert into translation_private.nonces(id) values ((p->>'nonce')::uuid) on conflict do nothing;
  if not found then return jsonb_build_object('status','invalid'); end if;
  owner := p->>'identity'; jid := (p->>'job')::uuid; op := p->>'operation';
  if owner is null or owner !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid'); end if;
  select * into j from translation_private.jobs where id = jid;
  if found then
    if j.identity <> owner then return jsonb_build_object('status','invalid'); end if;
    if op = 'translate' then
      if j.fingerprint <> p->>'fingerprint' then return jsonb_build_object('status','invalid'); end if;
      if j.state = 'done' then return jsonb_build_object('status','cached','result',j.result); end if;
      return jsonb_build_object('status',case when j.state='pending' then 'pending' else 'failed' end);
    elsif op = 'tts' then
      if j.state <> 'done' or j.tts_fingerprint <> p->>'fingerprint' then return jsonb_build_object('status','invalid'); end if;
      if j.tts_state = 'done' then return jsonb_build_object('status','cached','result',j.audio_result); end if;
      if j.tts_state <> 'new' then return jsonb_build_object('status',case when j.tts_state='pending' then 'pending' else 'failed' end); end if;
      update translation_private.jobs set tts_state='pending' where id=jid;
      return jsonb_build_object('status','reserved');
    elsif op = 'finish_translate' and j.state = 'pending' then
      update translation_private.jobs set state='done', result=p->'result', tts_fingerprint=p->>'ttsFingerprint' where id=jid;
      return jsonb_build_object('status','ok');
    elsif op = 'finish_tts' and j.tts_state = 'pending' then
      update translation_private.jobs set tts_state='done', audio_result=p->'result' where id=jid;
      return jsonb_build_object('status','ok');
    elsif op = 'fail_translate' and j.state = 'pending' then
      update translation_private.jobs set state='failed' where id=jid;
      return jsonb_build_object('status','ok');
    elsif op = 'fail_tts' and j.tts_state = 'pending' then
      update translation_private.jobs set tts_state='failed' where id=jid;
      return jsonb_build_object('status','ok');
    end if;
    return jsonb_build_object('status','invalid');
  end if;
  if op <> 'translate' then return jsonb_build_object('status','invalid'); end if;
  -- One bundle uses one personal count and reserves two possible provider calls globally.
  scopes := jsonb_build_array(
    jsonb_build_object('bucket',owner||':day:'||to_char(t at time zone 'UTC','YYYYMMDD'),'limit',p->'limits'->'daily','cost',1),
    jsonb_build_object('bucket',owner||':hour:'||to_char(t at time zone 'UTC','YYYYMMDDHH24'),'limit',p->'limits'->'hourly','cost',1),
    jsonb_build_object('bucket',owner||':minute:'||to_char(t at time zone 'UTC','YYYYMMDDHH24MI'),'limit',case when (p->>'guest')::boolean then 3 else 6 end,'cost',1),
    jsonb_build_object('bucket','global:day:'||to_char(t at time zone 'UTC','YYYYMMDD'),'limit',p->'limits'->'globalDaily','cost',2)
  );
  if (p->>'guest')::boolean then
    if coalesce(p->>'ip','') !~ '^[a-f0-9]{64}$' then return jsonb_build_object('status','invalid'); end if;
    scopes := scopes || jsonb_build_array(jsonb_build_object('bucket','ip:'||(p->>'ip')||':day:'||to_char(t at time zone 'UTC','YYYYMMDD'),'limit',p->'limits'->'ipDaily','cost',1));
  end if;
  for item in select value from jsonb_array_elements(scopes) loop
    b := item->>'bucket'; n := (item->>'limit')::integer;
    if n < 1 or n > 10000 then return jsonb_build_object('status','invalid'); end if;
    select used into current_used from translation_private.counters where bucket=b;
    if coalesce(current_used,0) + (item->>'cost')::integer > n then return jsonb_build_object('status','limited'); end if;
  end loop;
  for item in select value from jsonb_array_elements(scopes) loop
    insert into translation_private.counters values (item->>'bucket',(item->>'cost')::integer,t+interval '25 hours')
    on conflict(bucket) do update set used=translation_private.counters.used+excluded.used;
  end loop;
  insert into translation_private.jobs(id,identity,fingerprint) values(jid,owner,p->>'fingerprint');
  return jsonb_build_object('status','reserved');
exception when others then
  -- Transaction rollback preserves quota/job consistency; no SQL details to caller.
  return jsonb_build_object('status','invalid');
end;
$$;
revoke all on function public.translation_gateway(text,text) from public;
grant execute on function public.translation_gateway(text,text) to anon, authenticated;
-- Expired data is inaccessible immediately and deleted by the next signed call.
-- Before launch, schedule periodic deletion of expired jobs/nonces/counters if idle-time physical
-- retention must also be bounded. No schedule or DB change has been applied by this draft.

-- Narrow audio attachment RPC: existing migration has no general UPDATE policy.
create or replace function public.attach_translation_audio(p_history_id uuid, p_audio_url text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_audio_url is null or length(p_audio_url) > 2048 or p_audio_url !~ '^https://' then return false; end if;
  update public.translation_history set audio_url=p_audio_url where id=p_history_id and user_id=auth.uid();
  return found;
end;
$$;
revoke all on function public.attach_translation_audio(uuid,text) from public, anon;
grant execute on function public.attach_translation_audio(uuid,text) to authenticated;

commit;
