-- Server-side rate limiting for Edge Functions (Gmail OAuth + sends).
-- Accessed only via SECURITY DEFINER RPC; RLS enabled with no policies = only service_role.

CREATE TABLE IF NOT EXISTS public.edge_function_rate_limits (
  key text NOT NULL,
  bucket bigint NOT NULL,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, bucket)
);

COMMENT ON TABLE public.edge_function_rate_limits IS
  'Fixed-window counters for Edge Function rate limits. Rows keyed by (key, bucket). Service role only.';

ALTER TABLE public.edge_function_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically reserve capacity: fails without inflating count if over limit.
CREATE OR REPLACE FUNCTION public.reserve_edge_rate_limit(
  p_key text,
  p_window_seconds int,
  p_max int,
  p_delta int DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bucket bigint;
  v_current int;
  v_new int;
BEGIN
  IF p_key IS NULL OR length(trim(p_key)) = 0 THEN
    RAISE EXCEPTION 'p_key required';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'p_window_seconds must be >= 1';
  END IF;
  IF p_max IS NULL OR p_max < 1 THEN
    RAISE EXCEPTION 'p_max must be >= 1';
  END IF;
  IF p_delta IS NULL OR p_delta < 1 THEN
    RAISE EXCEPTION 'p_delta must be >= 1';
  END IF;

  v_bucket := (EXTRACT(EPOCH FROM clock_timestamp())::bigint / p_window_seconds::bigint) * p_window_seconds::bigint;

  SELECT t.count INTO v_current
  FROM public.edge_function_rate_limits AS t
  WHERE t.key = p_key AND t.bucket = v_bucket
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_delta > p_max THEN
      RETURN jsonb_build_object('allowed', false, 'count', 0, 'bucket', v_bucket);
    END IF;
    INSERT INTO public.edge_function_rate_limits (key, bucket, count)
    VALUES (p_key, v_bucket, p_delta);
    RETURN jsonb_build_object('allowed', true, 'count', p_delta, 'bucket', v_bucket);
  END IF;

  IF v_current + p_delta > p_max THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_current, 'bucket', v_bucket);
  END IF;

  v_new := v_current + p_delta;
  UPDATE public.edge_function_rate_limits
  SET count = v_new, updated_at = clock_timestamp()
  WHERE key = p_key AND bucket = v_bucket;

  RETURN jsonb_build_object('allowed', true, 'count', v_new, 'bucket', v_bucket);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_edge_rate_limit(text, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_edge_rate_limit(text, int, int, int) TO service_role;

-- Atomic Gmail send limits: hourly + daily per hospital page (single transaction).
CREATE OR REPLACE FUNCTION public.reserve_gmail_send_limits(
  p_hospital_page_id text,
  p_delta int,
  p_max_hour int DEFAULT 200,
  p_max_day int DEFAULT 450
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hour_key text;
  v_day_key text;
  v_hour_bucket bigint;
  v_day_bucket bigint;
  v_hour_current int;
  v_day_current int;
  v_hour_new int;
  v_day_new int;
BEGIN
  IF p_hospital_page_id IS NULL OR length(trim(p_hospital_page_id)) = 0 THEN
    RAISE EXCEPTION 'p_hospital_page_id required';
  END IF;
  IF p_delta IS NULL OR p_delta < 1 THEN
    RAISE EXCEPTION 'p_delta must be >= 1';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('gmail_send:' || p_hospital_page_id));

  v_hour_key := 'gmail:send:hour:' || p_hospital_page_id;
  v_day_key := 'gmail:send:day:' || p_hospital_page_id;
  v_hour_bucket := (EXTRACT(EPOCH FROM clock_timestamp())::bigint / 3600::bigint) * 3600::bigint;
  v_day_bucket := (EXTRACT(EPOCH FROM clock_timestamp())::bigint / 86400::bigint) * 86400::bigint;

  SELECT COALESCE((
    SELECT t.count FROM public.edge_function_rate_limits AS t
    WHERE t.key = v_hour_key AND t.bucket = v_hour_bucket
    FOR UPDATE
  ), 0) INTO v_hour_current;

  SELECT COALESCE((
    SELECT t.count FROM public.edge_function_rate_limits AS t
    WHERE t.key = v_day_key AND t.bucket = v_day_bucket
    FOR UPDATE
  ), 0) INTO v_day_current;

  IF v_hour_current + p_delta > p_max_hour THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_by', 'hour',
      'hour_count', v_hour_current,
      'day_count', v_day_current
    );
  END IF;

  IF v_day_current + p_delta > p_max_day THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'blocked_by', 'day',
      'hour_count', v_hour_current,
      'day_count', v_day_current
    );
  END IF;

  v_hour_new := v_hour_current + p_delta;
  v_day_new := v_day_current + p_delta;

  INSERT INTO public.edge_function_rate_limits AS t (key, bucket, count)
  VALUES (v_hour_key, v_hour_bucket, v_hour_new)
  ON CONFLICT (key, bucket)
  DO UPDATE SET count = EXCLUDED.count, updated_at = clock_timestamp();

  INSERT INTO public.edge_function_rate_limits AS t (key, bucket, count)
  VALUES (v_day_key, v_day_bucket, v_day_new)
  ON CONFLICT (key, bucket)
  DO UPDATE SET count = EXCLUDED.count, updated_at = clock_timestamp();

  RETURN jsonb_build_object(
    'allowed', true,
    'hour_count', v_hour_new,
    'day_count', v_day_new
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_gmail_send_limits(text, int, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_gmail_send_limits(text, int, int, int) TO service_role;
