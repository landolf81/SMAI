-- Approved DB/push boundary release only; no media/KMA/market_alerts/profile-read changes.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='security_runtime') THEN RAISE EXCEPTION 'Quota schema already exists; review drift'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('users','messages','trade_items','push_subscriptions') AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'RLS drift'; END IF;
 IF has_schema_privilege('anon','public','CREATE') OR has_schema_privilege('authenticated','public','CREATE') THEN RAISE EXCEPTION 'Profile lookup requires trusted public schema'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_subscriptions' AND policyname='Authenticated users can read all subscriptions') THEN RAISE EXCEPTION 'Subscription policy drift'; END IF;
END $$;

DROP POLICY IF EXISTS trade_items_insert_authenticated ON public.trade_items;
DROP POLICY IF EXISTS trade_items_update_authenticated ON public.trade_items;
DROP POLICY IF EXISTS trade_items_delete_authenticated ON public.trade_items;
CREATE POLICY trade_items_insert_owner ON public.trade_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=trade_items.post_id AND p.user_id=(SELECT auth.uid())));
CREATE POLICY trade_items_update_owner ON public.trade_items FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=trade_items.post_id AND p.user_id=(SELECT auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=trade_items.post_id AND p.user_id=(SELECT auth.uid())));
CREATE POLICY trade_items_delete_owner ON public.trade_items FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id=trade_items.post_id AND p.user_id=(SELECT auth.uid())));

-- Protect DM identity columns. A receiver may update only read state.
-- Service-role automation bypass is explicit. Missing auth.uid() is never permission.
CREATE FUNCTION public.guard_message_changes() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path='' AS $$
BEGIN
  -- Existing DB-owned welcome/maintenance functions already run with bypass privileges.
  -- Preserve those trusted SQL callers; a missing JWT by itself is not a bypass.
  IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') = 'service_role' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated caller required'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.sender_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Sender must be caller'; END IF;
    NEW.created_at := clock_timestamp();
    RETURN NEW;
  END IF;
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Message identity is immutable';
  END IF;
  IF auth.uid() = OLD.receiver_id AND auth.uid() IS DISTINCT FROM OLD.sender_id AND
     (to_jsonb(NEW) - ARRAY['is_read','read_at','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['is_read','read_at','updated_at']) THEN
    RAISE EXCEPTION 'Recipient may update only read state';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_message_changes BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.guard_message_changes();
REVOKE ALL ON FUNCTION public.guard_message_changes() FROM PUBLIC, anon, authenticated;

-- Other members must never enumerate subscription endpoints and encryption material.
DROP POLICY IF EXISTS "Authenticated users can read all subscriptions" ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_owner ON public.push_subscriptions FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()));

-- Admin UI keeps an aggregate count without receiving subscription details.
CREATE FUNCTION public.get_push_subscriber_count() RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_roles WHERE user_id=auth.uid() AND role IN ('admin','super_admin')
  ) THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
  RETURN (SELECT count(*) FROM public.push_subscriptions);
END;
$$;
REVOKE ALL ON FUNCTION public.get_push_subscriber_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_push_subscriber_count() TO authenticated;


CREATE FUNCTION public.guard_profile_state() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
BEGIN
  IF current_user IN ('postgres','supabase_admin','service_role') THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authenticated caller required'; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_roles WHERE user_id=auth.uid() AND role IN ('admin','super_admin')) THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Profile owner required'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.status IS DISTINCT FROM 'active' OR NEW.can_report IS DISTINCT FROM true OR NEW.verified IS DISTINCT FROM false
      OR NEW.suspended_until IS NOT NULL OR NEW.suspension_reason IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Moderation state is server owned';
    END IF;
  ELSIF NEW.id IS DISTINCT FROM OLD.id OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.can_report IS DISTINCT FROM OLD.can_report OR NEW.verified IS DISTINCT FROM OLD.verified
    OR NEW.suspended_until IS DISTINCT FROM OLD.suspended_until OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
    OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Moderation state is server owned';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_state() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER guard_profile_state BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_state();

CREATE SCHEMA security_runtime;
REVOKE ALL ON SCHEMA security_runtime FROM PUBLIC, anon, authenticated;
CREATE TABLE security_runtime.action_buckets (
  actor text NOT NULL, scope text NOT NULL, bucket bigint NOT NULL,
  used integer NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(actor, scope, bucket)
);
CREATE TABLE security_runtime.action_events (
  event_key text PRIMARY KEY, expires_at timestamptz NOT NULL
);
CREATE INDEX action_buckets_expiry ON security_runtime.action_buckets(expires_at);
CREATE INDEX action_events_expiry ON security_runtime.action_events(expires_at);
ALTER TABLE security_runtime.action_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_runtime.action_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA security_runtime FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.reserve_security_action(p_actor text, p_scope text, p_event_key text,
  p_limit integer, p_window_seconds integer, p_event_ttl_seconds integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_bucket bigint;
  v_used integer;
BEGIN
  IF COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''),
      NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service only' USING ERRCODE='42501';
  END IF;
  IF p_actor IS NULL OR length(p_actor) NOT BETWEEN 1 AND 128 OR
     p_scope IS NULL OR p_scope NOT IN ('push-event','push-direct','push-broadcast') OR
     p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 1000 OR
     p_window_seconds IS NULL OR p_window_seconds NOT BETWEEN 1 AND 3600 OR
     p_event_ttl_seconds IS NULL OR p_event_ttl_seconds NOT BETWEEN 1 AND 3600 OR
     (p_event_key IS NOT NULL AND length(p_event_key) NOT BETWEEN 1 AND 256) THEN
    RAISE EXCEPTION 'Invalid reservation';
  END IF;
  -- Same caller/scope reservations are serialized across workers/instances.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor || ':' || p_scope, 0));
  IF p_event_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM security_runtime.action_events WHERE event_key=p_event_key AND expires_at>v_now
  ) THEN RETURN jsonb_build_object('allowed',false,'reason','duplicate'); END IF;
  v_bucket := floor(extract(epoch FROM v_now)/p_window_seconds);
  INSERT INTO security_runtime.action_buckets AS b(actor,scope,bucket,used,expires_at)
    VALUES(p_actor,p_scope,v_bucket,1,v_now+make_interval(secs=>p_window_seconds*2))
  ON CONFLICT(actor,scope,bucket) DO UPDATE SET used=b.used+1 WHERE b.used<p_limit
  RETURNING used INTO v_used;
  IF v_used IS NULL THEN RETURN jsonb_build_object('allowed',false,'reason','rate_limit'); END IF;
  IF p_event_key IS NOT NULL THEN
    INSERT INTO security_runtime.action_events(event_key,expires_at)
      VALUES(p_event_key,v_now+make_interval(secs=>p_event_ttl_seconds))
    ON CONFLICT(event_key) DO UPDATE SET expires_at=EXCLUDED.expires_at;
  END IF;
  DELETE FROM security_runtime.action_events WHERE event_key IN (
    SELECT event_key FROM security_runtime.action_events WHERE expires_at<v_now LIMIT 100
  );
  DELETE FROM security_runtime.action_buckets WHERE (actor,scope,bucket) IN (
    SELECT actor,scope,bucket FROM security_runtime.action_buckets WHERE expires_at<v_now LIMIT 100
  );
  RETURN jsonb_build_object('allowed',true);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_security_action(text,text,text,integer,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_security_action(text,text,text,integer,integer,integer) TO service_role;
