-- =====================================================================
-- Admin Analytics backend (platform_events, views, RPCs, triggers)
-- =====================================================================

-- 1. platform_events table -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('student','admin','system')),
  event_type text NOT NULL,
  entity_type text,
  entity_id uuid,
  clinic_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_events TO authenticated;
GRANT ALL ON public.platform_events TO service_role;

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read platform events" ON public.platform_events;
CREATE POLICY "Admins can read platform events"
  ON public.platform_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- NOTE: no INSERT policy on purpose. Rows are only created by
-- SECURITY DEFINER triggers / service_role.

CREATE INDEX IF NOT EXISTS idx_platform_events_created_at ON public.platform_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_event_type ON public.platform_events (event_type);
CREATE INDEX IF NOT EXISTS idx_platform_events_user_id ON public.platform_events (user_id);
CREATE INDEX IF NOT EXISTS idx_platform_events_clinic_id ON public.platform_events (clinic_id);

-- 2. log_platform_event helper --------------------------------------------
CREATE OR REPLACE FUNCTION public.log_platform_event(
  p_user_id uuid,
  p_actor_type text,
  p_event_type text,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_clinic_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.platform_events (user_id, actor_type, event_type, entity_type, entity_id, clinic_id, metadata)
  VALUES (p_user_id, COALESCE(p_actor_type, 'system'), p_event_type, p_entity_type, p_entity_id, p_clinic_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 3. Triggers --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_application_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_platform_event(
    NEW.student_id, 'student', 'application_submitted',
    'student_application', NEW.id, NULL,
    jsonb_build_object('position_id', NEW.position_id, 'status', NEW.status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_application_submitted ON public.student_applications;
CREATE TRIGGER log_application_submitted
  AFTER INSERT ON public.student_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_application_submitted();

CREATE OR REPLACE FUNCTION public.trg_log_application_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.log_platform_event(
      NEW.student_id, 'system', 'status_changed',
      'student_application', NEW.id, NULL,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_application_status_changed ON public.student_applications;
CREATE TRIGGER log_application_status_changed
  AFTER UPDATE OF status ON public.student_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_application_status_changed();

CREATE OR REPLACE FUNCTION public.trg_log_admin_note_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.log_platform_event(
    NEW.created_by, 'admin', 'admin_note_added',
    'application', NEW.application_id, NULL,
    jsonb_build_object('note_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_admin_note_added ON public.application_notes;
CREATE TRIGGER log_admin_note_added
  AFTER INSERT ON public.application_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_log_admin_note_added();

-- 4. assert_admin guard ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow real admins
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN;
  END IF;
  -- Allow privileged contexts (service_role / SQL editor structure checks)
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  RAISE EXCEPTION 'Admin access required';
END;
$$;

-- 5. admin_student_summary view -------------------------------------------
CREATE OR REPLACE VIEW public.admin_student_summary
WITH (security_invoker = true) AS
WITH last_login AS (
  SELECT user_id, max(created_at) AS last_login_at
  FROM public.tracking_events
  WHERE event_type = 'login' AND user_id IS NOT NULL
  GROUP BY user_id
),
last_active AS (
  SELECT user_id, max(created_at) AS last_active_at
  FROM public.tracking_events
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
app_counts AS (
  SELECT student_id,
         count(*) AS application_count,
         count(*) FILTER (WHERE status NOT IN ('rejected','withdrawn')) AS active_application_count,
         count(*) FILTER (WHERE status IN ('new','submitted','under_review')) AS pending_application_count
  FROM public.student_applications
  WHERE student_id IS NOT NULL
  GROUP BY student_id
),
clinic_info AS (
  SELECT cm.user_id,
         count(DISTINCT cm.clinic_id) AS clinic_count,
         COALESCE(sum(cm.hours_logged), 0) AS volunteer_hours,
         string_agg(DISTINCT h.name, ', ') AS clinic_names
  FROM public.clinic_members cm
  LEFT JOIN public.hospital_pages hp ON hp.id = cm.clinic_id
  LEFT JOIN public.hospitals h ON h.id = hp.hospital_id
  WHERE cm.user_id IS NOT NULL
  GROUP BY cm.user_id
),
eval_scores AS (
  SELECT e.volunteer_user_id AS user_id,
         avg(NULLIF(v.value, '')::numeric) AS avg_evaluation_score
  FROM public.volunteer_tracker_values v
  JOIN public.volunteer_tracker_columns c ON c.id = v.column_id AND c.column_type = 'rating_1_5'
  JOIN public.volunteer_tracker_entries e ON e.id = v.entry_id
  WHERE e.volunteer_user_id IS NOT NULL
    AND v.value ~ '^[0-9]+(\.[0-9]+)?$'
  GROUP BY e.volunteer_user_id
)
SELECT
  p.id,
  p.full_name,
  p.university,
  p.major,
  p.graduation_year,
  p.city,
  p.state,
  p.clinical_hours,
  p.is_premium,
  p.created_at,
  ll.last_login_at,
  la.last_active_at,
  COALESCE(ac.application_count, 0) AS application_count,
  COALESCE(ac.active_application_count, 0) AS active_application_count,
  COALESCE(ac.pending_application_count, 0) AS pending_application_count,
  COALESCE(ci.clinic_count, 0) AS clinic_count,
  ci.clinic_names,
  COALESCE(ci.volunteer_hours, 0) AS volunteer_hours,
  es.avg_evaluation_score,
  CASE
    WHEN la.last_active_at IS NULL OR la.last_active_at < now() - interval '30 days' THEN 'high'
    WHEN la.last_active_at < now() - interval '14 days' THEN 'medium'
    WHEN COALESCE(ac.pending_application_count, 0) > 0 AND la.last_active_at < now() - interval '7 days' THEN 'medium'
    ELSE 'low'
  END AS attention_level,
  (
    la.last_active_at IS NULL
    OR la.last_active_at < now() - interval '14 days'
  ) AS needs_attention
FROM public.profiles p
LEFT JOIN last_login ll ON ll.user_id = p.id
LEFT JOIN last_active la ON la.user_id = p.id
LEFT JOIN app_counts ac ON ac.student_id = p.id
LEFT JOIN clinic_info ci ON ci.user_id = p.id
LEFT JOIN eval_scores es ON es.user_id = p.id;

GRANT SELECT ON public.admin_student_summary TO authenticated;
GRANT SELECT ON public.admin_student_summary TO service_role;

-- 6. admin_unified_activity view ------------------------------------------
CREATE OR REPLACE VIEW public.admin_unified_activity
WITH (security_invoker = true) AS
SELECT
  pe.id::text AS id,
  pe.created_at AS occurred_at,
  'platform'::text AS source,
  pe.event_type,
  pe.user_id,
  NULL::text AS actor_email,
  pe.entity_type,
  pe.entity_id,
  pe.metadata
FROM public.platform_events pe
UNION ALL
SELECT
  te.id::text AS id,
  te.created_at AS occurred_at,
  'tracking'::text AS source,
  te.event_type,
  te.user_id,
  NULL::text AS actor_email,
  NULL::text AS entity_type,
  NULL::uuid AS entity_id,
  te.metadata
FROM public.tracking_events te
WHERE te.event_type IN (
  'login','signup','sign_up','save_opportunity','unsave_opportunity',
  'apply_click','application_started','application_submitted',
  'opportunity_view','profile_update','premium_upgrade'
)
UNION ALL
SELECT
  al.id::text AS id,
  al.created_at AS occurred_at,
  'admin_log'::text AS source,
  al.action_type AS event_type,
  NULL::uuid AS user_id,
  al.actor_email,
  al.target_type AS entity_type,
  NULL::uuid AS entity_id,
  al.metadata
FROM public.admin_activity_log al;

GRANT SELECT ON public.admin_unified_activity TO authenticated;
GRANT SELECT ON public.admin_unified_activity TO service_role;

-- 7. get_admin_dashboard_kpis ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_kpis(
  p_since timestamptz DEFAULT (now() - interval '30 days'),
  p_until timestamptz DEFAULT now(),
  p_clinic_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.assert_admin();

  SELECT jsonb_build_object(
    'total_students', (SELECT count(*) FROM public.profiles),
    'new_students', (SELECT count(*) FROM public.profiles WHERE created_at BETWEEN p_since AND p_until),
    'active_students_week', (
      SELECT count(DISTINCT user_id) FROM public.tracking_events
      WHERE user_id IS NOT NULL AND created_at >= now() - interval '7 days'
    ),
    'active_students_window', (
      SELECT count(DISTINCT user_id) FROM public.tracking_events
      WHERE user_id IS NOT NULL AND created_at BETWEEN p_since AND p_until
    ),
    'logins', (
      SELECT count(*) FROM public.tracking_events
      WHERE event_type = 'login' AND created_at BETWEEN p_since AND p_until
    ),
    'total_applications', (
      SELECT count(*) FROM public.student_applications sa
      WHERE sa.submitted_at BETWEEN p_since AND p_until
        AND (p_clinic_id IS NULL OR sa.position_id IN (
          SELECT hp.id FROM public.hospital_positions hp WHERE hp.hospital_page_id = p_clinic_id))
    ),
    'pending_applications', (
      SELECT count(*) FROM public.student_applications sa
      WHERE sa.status IN ('new','submitted','under_review')
        AND (p_clinic_id IS NULL OR sa.position_id IN (
          SELECT hp.id FROM public.hospital_positions hp WHERE hp.hospital_page_id = p_clinic_id))
    ),
    'evaluations', (
      SELECT count(*) FROM public.volunteer_tracker_values v
      JOIN public.volunteer_tracker_columns c ON c.id = v.column_id AND c.column_type = 'rating_1_5'
      JOIN public.volunteer_tracker_entries e ON e.id = v.entry_id
      WHERE e.created_at BETWEEN p_since AND p_until
        AND v.value ~ '^[0-9]+(\.[0-9]+)?$'
        AND (p_clinic_id IS NULL OR e.clinic_id = p_clinic_id)
    ),
    'avg_evaluation_score', (
      SELECT round(avg(NULLIF(v.value,'')::numeric), 2) FROM public.volunteer_tracker_values v
      JOIN public.volunteer_tracker_columns c ON c.id = v.column_id AND c.column_type = 'rating_1_5'
      JOIN public.volunteer_tracker_entries e ON e.id = v.entry_id
      WHERE v.value ~ '^[0-9]+(\.[0-9]+)?$'
        AND (p_clinic_id IS NULL OR e.clinic_id = p_clinic_id)
    ),
    'students_needing_attention', (
      SELECT count(*) FROM public.profiles p
      LEFT JOIN (
        SELECT user_id, max(created_at) AS last_active_at
        FROM public.tracking_events WHERE user_id IS NOT NULL GROUP BY user_id
      ) la ON la.user_id = p.id
      WHERE la.last_active_at IS NULL OR la.last_active_at < now() - interval '14 days'
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 8. get_admin_time_series ------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_time_series(
  p_metric text,
  p_since timestamptz DEFAULT (now() - interval '30 days'),
  p_until timestamptz DEFAULT now(),
  p_granularity text DEFAULT 'day',
  p_clinic_id uuid DEFAULT NULL
) RETURNS TABLE(bucket timestamptz, value numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trunc text;
BEGIN
  PERFORM public.assert_admin();

  v_trunc := CASE lower(p_granularity)
    WHEN 'hour' THEN 'hour'
    WHEN 'week' THEN 'week'
    WHEN 'month' THEN 'month'
    ELSE 'day'
  END;

  IF p_metric = 'new_users' THEN
    RETURN QUERY
      SELECT date_trunc(v_trunc, p.created_at) AS bucket, count(*)::numeric AS value
      FROM public.profiles p
      WHERE p.created_at BETWEEN p_since AND p_until
      GROUP BY 1 ORDER BY 1;
  ELSIF p_metric = 'active_users' THEN
    RETURN QUERY
      SELECT date_trunc(v_trunc, te.created_at) AS bucket, count(DISTINCT te.user_id)::numeric AS value
      FROM public.tracking_events te
      WHERE te.user_id IS NOT NULL AND te.created_at BETWEEN p_since AND p_until
      GROUP BY 1 ORDER BY 1;
  ELSIF p_metric = 'logins' THEN
    RETURN QUERY
      SELECT date_trunc(v_trunc, te.created_at) AS bucket, count(*)::numeric AS value
      FROM public.tracking_events te
      WHERE te.event_type = 'login' AND te.created_at BETWEEN p_since AND p_until
      GROUP BY 1 ORDER BY 1;
  ELSIF p_metric = 'applications' THEN
    RETURN QUERY
      SELECT date_trunc(v_trunc, sa.submitted_at) AS bucket, count(*)::numeric AS value
      FROM public.student_applications sa
      WHERE sa.submitted_at BETWEEN p_since AND p_until
        AND (p_clinic_id IS NULL OR sa.position_id IN (
          SELECT hp.id FROM public.hospital_positions hp WHERE hp.hospital_page_id = p_clinic_id))
      GROUP BY 1 ORDER BY 1;
  ELSIF p_metric = 'evaluations' THEN
    RETURN QUERY
      SELECT date_trunc(v_trunc, e.created_at) AS bucket, count(*)::numeric AS value
      FROM public.volunteer_tracker_values v
      JOIN public.volunteer_tracker_columns c ON c.id = v.column_id AND c.column_type = 'rating_1_5'
      JOIN public.volunteer_tracker_entries e ON e.id = v.entry_id
      WHERE e.created_at BETWEEN p_since AND p_until
        AND v.value ~ '^[0-9]+(\.[0-9]+)?$'
        AND (p_clinic_id IS NULL OR e.clinic_id = p_clinic_id)
      GROUP BY 1 ORDER BY 1;
  ELSIF p_metric = 'avg_evaluation_score' THEN
    RETURN QUERY
      SELECT date_trunc(v_trunc, e.created_at) AS bucket, round(avg(NULLIF(v.value,'')::numeric), 2) AS value
      FROM public.volunteer_tracker_values v
      JOIN public.volunteer_tracker_columns c ON c.id = v.column_id AND c.column_type = 'rating_1_5'
      JOIN public.volunteer_tracker_entries e ON e.id = v.entry_id
      WHERE e.created_at BETWEEN p_since AND p_until
        AND v.value ~ '^[0-9]+(\.[0-9]+)?$'
        AND (p_clinic_id IS NULL OR e.clinic_id = p_clinic_id)
      GROUP BY 1 ORDER BY 1;
  ELSE
    RAISE EXCEPTION 'Unknown metric: %', p_metric;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_kpis(timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_time_series(text, timestamptz, timestamptz, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assert_admin() TO authenticated, service_role;

-- 9. Realtime publication --------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;