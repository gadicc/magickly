-- Window scope is fixed after publication. Full conservative holds are never refunded.
-- PostgreSQL row locks require an UPDATE column privilege; cleanup may hold a
-- narrow approval_sha256 grant without being able to change its value.
CREATE FUNCTION public.chat_research_window_change() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $body$
BEGIN
  IF ROW(NEW.id,NEW.approval_sha256,NEW.actor_id,NEW.corpus_version,
         NEW.model,NEW.processor_profile,NEW.begins_at,NEW.expires_at,
         NEW.max_requests,NEW.per_request_pico,NEW.total_pico)
     IS DISTINCT FROM
     ROW(OLD.id,OLD.approval_sha256,OLD.actor_id,OLD.corpus_version,
         OLD.model,OLD.processor_profile,OLD.begins_at,OLD.expires_at,
         OLD.max_requests,OLD.per_request_pico,OLD.total_pico)
     OR NEW.requests_used < OLD.requests_used
     OR NEW.held_pico < OLD.held_pico
     OR (OLD.stopped_at IS NOT NULL AND
         (NEW.stopped_at IS NULL OR NEW.stopped_at < OLD.stopped_at))
     OR (NEW.stopped_at IS NOT NULL AND
         (NOT pg_catalog.isfinite(NEW.stopped_at) OR
          NEW.stopped_at > pg_catalog.clock_timestamp()))
  THEN
    RAISE EXCEPTION 'Private research window immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END
$body$;
--> statement-breakpoint
CREATE TRIGGER chat_research_window_update BEFORE UPDATE ON public.chat_research_windows
FOR EACH ROW EXECUTE FUNCTION public.chat_research_window_change();
