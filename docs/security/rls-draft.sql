-- REVIEW DRAFT ONLY. Not in supabase/migrations; do not apply to production.
-- Based on read-only catalog inspection on 2026-10-16. No user records were read.
-- Run only against disposable fixture schemas with owner/other/anon role tests.
-- This transaction intentionally ROLLS BACK. Deployment needs separate approval.
BEGIN;
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
-- Service-role automation remains supported by auth.uid() IS NULL bypass.
CREATE FUNCTION public.guard_message_changes_draft() RETURNS trigger LANGUAGE plpgsql
SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id OR NEW.receiver_id IS DISTINCT FROM OLD.receiver_id
     OR NEW.id IS DISTINCT FROM OLD.id OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id THEN
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
CREATE TRIGGER guard_message_changes_draft BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.guard_message_changes_draft();

-- Deliberately no market_alerts policy: production user_id is INTEGER while Auth IDs are UUID.
-- Needs an approved owner mapping/data migration, never DELETE + column recreation.
-- Deliberately no anonymous poll change: signed anonymous identity API and UI rollout needed.
-- Deliberately no users column revocation: inventory of public profile consumers needed.
ROLLBACK;
