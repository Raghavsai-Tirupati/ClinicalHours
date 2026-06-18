-- Admin analytics: platform events, student summary view, KPI/time-series RPCs

-- ============================================================
-- 1. platform_events — structured business events
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type  TEXT NOT NULL DEFAULT 'student'
    CHECK (actor_type IN ('student', 'admin', 'system')),
  event_type  TEXT NOT NULL,
  entity_type TEXT,
  entity_id   UUID,
  clinic_id   UUID REFERENCES public.hospital_pages(id) ON DELETE SET NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_events_user_created
  ON public.platform_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_type_created
  ON public.platform_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_events_clinic_created
  ON public.platform_events(clinic_id, created_at DESC)
  WHERE clinic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_events_entity
  ON public.platform_events(entity_type, entity_id)
  WHERE entity_id IS NOT NULL;

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read platform events"
  ON public.platform_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Inserts via SECURITY DEFINER triggers/functions only (no client INSERT policy)

-- Helper: log platform events (triggers + edge functions)
CREATE OR REPLACE FUNCTION public.log_platform_event(
  p_user_id UUID,
  p_actor_type TEXT,
  p_event_type TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_clinic_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.platform_events (
    user_id, actor_type, event_type, entity_type, entity_id, clinic_id, metadata
  ) VALUES (
    p_user_id, p_actor_type, p_event_type, p_entity_type, p_entity_id, p_clinic_id, p_metadata
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Triggers: application lifecycle
CREATE OR REPLACE FUNCTION public.trg_student_application_platform_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_id UUID;
BEGIN
  SELECT hp.hospital_page_id INTO v_clinic_id
  FROM public.hospital_positions hp
  WHERE hp.id = NEW.position_id;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_platform_event(
      NEW.student_id, 'student', 'application_submitted',
      'student_application', NEW.id, v_clinic_id,
      jsonb_build_object('status', NEW.status, 'position_id', NEW.position_id)
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.log_platform_event(
      NEW.student_id, 'student', 'status_changed',
      'student_application', NEW.id, v_clinic_id,
      jsonb_build_object('from_status', OLD.status, 'to_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_application_platform_events ON public.student_applications;
CREATE TRIGGER student_application_platform_events
  AFTER INSERT OR UPDATE OF status ON public.student_applications
  FOR EACH ROW EXECUTE FUNCTION public.trg_student_application_platform_event();

CREATE OR REPLACE FUNCTION public.trg_application_note_platform_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_clinic_id UUID;
BEGIN
  SELECT sa.student_id, hp.hospital_page_id
  INTO v_student_id, v_clinic_id
  FROM public.student_applications sa
  JOIN public.hospital_positions hp ON hp.id = sa.position_id
  WHERE sa.id = NEW.application_id;

  PERFORM public.log_platform_event(
    v_student_id, 'admin', 'admin_note_added',
    'application_note', NEW.id, v_clinic_id,
    jsonb_build_object('application_id', NEW.application_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS application_note_platform_events ON public.application_notes;
CREATE TRIGGER application_note_platform_events
  AFTER INSERT ON public.application_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_application_note_platform_event();

-- ============================================================
-- 2. admin_student_summary view
-- ============================================================
CREATE OR REPLACE VIEW public.admin_student_summary
WITH (security_invoker = true)
AS
WITH login_stats AS (
  SELECT user_id,
    MAX(created_at) FILTER (WHERE event_type = 'login') AS last_login_at,
    COUNT(*) FILTER (WHERE event_type = 'login') AS login_count
  FROM public.tracking_events
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
activity_stats AS (
  SELECT user_id, MAX(created_at) AS last_active_at
  FROM public.tracking_events
  WHERE user_id IS NOT NULL
  GROUP BY user_id
),
app_stats AS (
  SELECT student_id,
    COUNT(*) AS application_count,
    COUNT(*) FILTER (WHERE status IN ('new', 'under_review', 'interview', 'waitlisted')) AS pending_applications,
    COUNT(*) FILTER (WHERE status = 'accepted') AS accepted_applications,
    MAX(submitted_at) AS last_application_at,
    COUNT(*) FILTER (WHERE interview_confirmed_at > NOW()) AS upcoming_interviews
  FROM public.student_applications
  GROUP BY student_id
),
clinic_stats AS (
  SELECT cm.user_id,
    string_agg(DISTINCT o.name, ', ' ORDER BY o.name) AS clinic_names,
    COUNT(DISTINCT cm.clinic_id) AS clinic_count,
    SUM(cm.hours_logged) AS volunteer_hours
  FROM public.clinic_members cm
  JOIN public.hospital_pages hp ON hp.id = cm.clinic_id
  JOIN public.opportunities o ON o.id = hp.hospital_id
  WHERE cm.user_id IS NOT NULL
  GROUP BY cm.user_id
),
eval_stats AS (
  SELECT vte.volunteer_user_id AS user_id,
    AVG(NULLIF(vtv.value, '')::numeric) AS avg_evaluation_score,
    COUNT(*) FILTER (WHERE vtv.value IS NOT NULL AND vtv.value <> '') AS evaluation_count
  FROM public.volunteer_tracker_values vtv
  JOIN public.volunteer_tracker_columns vtc ON vtc.id = vtv.column_id
    AND vtc.column_type = 'rating_1_5'
  JOIN public.volunteer_tracker_entries vte ON vte.id = vtv.entry_id
  WHERE vte.volunteer_user_id IS NOT NULL
  GROUP BY vte.volunteer_user_id
)
SELECT
  p.id,
  p.full_name,
  p.university,
  p.major,
  p.graduation_year,
  p.phone,
  p.created_at AS joined_at,
  COALESCE(p.onboarding_complete, false) AS onboarding_complete,
  ls.last_login_at,
  act.last_active_at,
  COALESCE(ls.login_count, 0)::int AS login_count,
  COALESCE(aps.application_count, 0)::int AS application_count,
  COALESCE(aps.pending_applications, 0)::int AS pending_applications,
  COALESCE(aps.accepted_applications, 0)::int AS accepted_applications,
  COALESCE(aps.upcoming_interviews, 0)::int AS upcoming_interviews,
  aps.last_application_at,
  cs.clinic_names,
  COALESCE(cs.clinic_count, 0)::int AS clinic_count,
  COALESCE(cs.volunteer_hours, 0) AS volunteer_hours,
  es.avg_evaluation_score,
  COALESCE(es.evaluation_count, 0)::int AS evaluation_count,
  CASE
    WHEN NOT COALESCE(p.onboarding_complete, false) THEN 'yellow'
    WHEN act.last_active_at IS NULL OR act.last_active_at < NOW() - INTERVAL '30 days' THEN 'red'
    WHEN COALESCE(aps.pending_applications, 0) > 0
      AND aps.last_application_at < NOW() - INTERVAL '14 days' THEN 'yellow'
    WHEN es.avg_evaluation_score IS NOT NULL AND es.avg_evaluation_score < 2.5 THEN 'red'
    WHEN act.last_active_at >= NOW() - INTERVAL '7 days' THEN 'green'
    ELSE 'gray'
  END AS attention_level,
  (
    NOT COALESCE(p.onboarding_complete, false)
    OR act.last_active_at IS NULL
    OR act.last_active_at < NOW() - INTERVAL '30 days'
    OR (COALESCE(aps.pending_applications, 0) > 0 AND aps.last_application_at < NOW() - INTERVAL '14 days')
    OR (es.avg_evaluation_score IS NOT NULL AND es.avg_evaluation_score < 2.5)
  ) AS needs_attention
FROM public.profiles p
LEFT JOIN login_stats ls ON ls.user_id = p.id
LEFT JOIN activity_stats act ON act.user_id = p.id
LEFT JOIN app_stats aps ON aps.student_id = p.id
LEFT JOIN clinic_stats cs ON cs.user_id = p.id
LEFT JOIN eval_stats es ON es.user_id = p.id;

GRANT SELECT ON public.admin_student_summary TO authenticated;

-- ============================================================
-- 3. Unified activity view (meaningful events only)
-- ============================================================
CREATE OR REPLACE VIEW public.admin_unified_activity
WITH (security_invoker = true)
AS
SELECT
  pe.id::text AS id,
  pe.user_id,
  pe.created_at,
  pe.event_type,
  pe.actor_type,
  COALESCE(
    pe.metadata->>'description',
    pe.entity_type || ': ' || pe.event_type
  ) AS description,
  pe.metadata,
  pe.clinic_id,
  'platform'::text AS source
FROM public.platform_events pe
UNION ALL
SELECT
  te.id::text,
  te.user_id,
  te.created_at,
  te.event_type,
  'student'::text AS actor_type,
  CASE te.event_type
    WHEN 'login' THEN 'Logged in'
    WHEN 'signup' THEN 'Signed up'
    WHEN 'page_view' THEN 'Viewed ' || COALESCE(te.page_url, 'page')
    WHEN 'opportunity_saved' THEN 'Saved opportunity'
    WHEN 'apply_link_clicked' THEN 'Clicked apply link'
    ELSE te.event_type
  END AS description,
  te.metadata,
  NULL::uuid AS clinic_id,
  'tracking'::text AS source
FROM public.tracking_events te
WHERE te.event_type IN (
  'login', 'signup', 'guest_conversion', 'opportunity_saved',
  'apply_link_clicked', 'application_started', 'profile_updated'
)
UNION ALL
SELECT
  al.id::text,
  NULL::uuid AS user_id,
  al.created_at,
  al.action_type AS event_type,
  'admin'::text AS actor_type,
  COALESCE(al.target_type, 'action') || ': ' || al.action_type AS description,
  al.metadata,
  al.hospital_page_id AS clinic_id,
  'admin_log'::text AS source
FROM public.admin_activity_log al;

GRANT SELECT ON public.admin_unified_activity TO authenticated;

-- ============================================================
-- 4. Admin guard helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
END;
$$;

-- ============================================================
-- 5. Dashboard KPIs RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_kpis(
  p_since TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_until TIMESTAMPTZ DEFAULT NOW(),
  p_clinic_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  PERFORM public.assert_admin();

  SELECT jsonb_build_object(
    'total_students', (SELECT COUNT(*) FROM public.profiles),
    'active_students_week', (
      SELECT COUNT(DISTINCT user_id) FROM public.tracking_events
      WHERE user_id IS NOT NULL AND created_at >= NOW() - INTERVAL '7 days'
    ),
    'new_students_month', (
      SELECT COUNT(*) FROM public.profiles
      WHERE created_at >= date_trunc('month', NOW())
    ),
    'pending_applications', (
      SELECT COUNT(*) FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      WHERE sa.status IN ('new', 'under_review', 'interview', 'waitlisted')
        AND (p_clinic_id IS NULL OR hp.hospital_page_id = p_clinic_id)
    ),
    'upcoming_interviews', (
      SELECT COUNT(*) FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      WHERE sa.interview_confirmed_at > NOW()
        AND (p_clinic_id IS NULL OR hp.hospital_page_id = p_clinic_id)
    ),
    'evaluations_completed', (
      SELECT COUNT(*) FROM public.volunteer_tracker_values vtv
      JOIN public.volunteer_tracker_columns vtc ON vtc.id = vtv.column_id
        AND vtc.column_type = 'rating_1_5'
      JOIN public.volunteer_tracker_entries vte ON vte.id = vtv.entry_id
      WHERE vtv.value IS NOT NULL AND vtv.value <> ''
        AND (p_clinic_id IS NULL OR vte.clinic_id = p_clinic_id)
    ),
    'avg_evaluation_score', (
      SELECT ROUND(AVG(NULLIF(vtv.value, '')::numeric), 2)
      FROM public.volunteer_tracker_values vtv
      JOIN public.volunteer_tracker_columns vtc ON vtc.id = vtv.column_id
        AND vtc.column_type = 'rating_1_5'
      JOIN public.volunteer_tracker_entries vte ON vte.id = vtv.entry_id
      WHERE vtv.value IS NOT NULL AND vtv.value <> ''
        AND (p_clinic_id IS NULL OR vte.clinic_id = p_clinic_id)
    ),
    'students_needing_attention', (
      SELECT COUNT(*) FROM public.admin_student_summary WHERE needs_attention
    ),
    'logins_in_range', (
      SELECT COUNT(*) FROM public.tracking_events
      WHERE event_type = 'login' AND created_at BETWEEN p_since AND p_until
    ),
    'applications_in_range', (
      SELECT COUNT(*) FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      WHERE sa.submitted_at BETWEEN p_since AND p_until
        AND (p_clinic_id IS NULL OR hp.hospital_page_id = p_clinic_id)
    ),
    'signups_in_range', (
      SELECT COUNT(*) FROM public.profiles
      WHERE created_at BETWEEN p_since AND p_until
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_kpis TO authenticated;

-- ============================================================
-- 6. Time series RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_time_series(
  p_metric TEXT,
  p_since TIMESTAMPTZ,
  p_until TIMESTAMPTZ,
  p_granularity TEXT DEFAULT 'day',
  p_clinic_id UUID DEFAULT NULL
)
RETURNS TABLE(bucket TIMESTAMPTZ, value NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trunc TEXT;
  v_interval INTERVAL;
BEGIN
  PERFORM public.assert_admin();

  v_trunc := CASE p_granularity
    WHEN 'week' THEN 'week'
    WHEN 'month' THEN 'month'
    ELSE 'day'
  END;
  v_interval := CASE p_granularity
    WHEN 'week' THEN INTERVAL '1 week'
    WHEN 'month' THEN INTERVAL '1 month'
    ELSE INTERVAL '1 day'
  END;

  IF p_metric = 'new_users' THEN
    RETURN QUERY
    SELECT gs.bucket, COUNT(p.id)::numeric
    FROM generate_series(date_trunc(v_trunc, p_since), p_until, v_interval) AS gs(bucket)
    LEFT JOIN public.profiles p
      ON p.created_at >= gs.bucket AND p.created_at < gs.bucket + v_interval
    GROUP BY gs.bucket ORDER BY gs.bucket;

  ELSIF p_metric = 'logins' THEN
    RETURN QUERY
    SELECT gs.bucket, COUNT(te.id)::numeric
    FROM generate_series(date_trunc(v_trunc, p_since), p_until, v_interval) AS gs(bucket)
    LEFT JOIN public.tracking_events te
      ON te.event_type = 'login'
      AND te.created_at >= gs.bucket AND te.created_at < gs.bucket + v_interval
    GROUP BY gs.bucket ORDER BY gs.bucket;

  ELSIF p_metric = 'active_users' THEN
    RETURN QUERY
    SELECT gs.bucket, COUNT(DISTINCT te.user_id)::numeric
    FROM generate_series(date_trunc(v_trunc, p_since), p_until, v_interval) AS gs(bucket)
    LEFT JOIN public.tracking_events te
      ON te.user_id IS NOT NULL
      AND te.created_at >= gs.bucket AND te.created_at < gs.bucket + v_interval
    GROUP BY gs.bucket ORDER BY gs.bucket;

  ELSIF p_metric = 'applications' THEN
    RETURN QUERY
    SELECT gs.bucket, COUNT(sa.id)::numeric
    FROM generate_series(date_trunc(v_trunc, p_since), p_until, v_interval) AS gs(bucket)
    LEFT JOIN public.student_applications sa
      ON sa.submitted_at >= gs.bucket AND sa.submitted_at < gs.bucket + v_interval
    LEFT JOIN public.hospital_positions hp ON hp.id = sa.position_id
      AND (p_clinic_id IS NULL OR hp.hospital_page_id = p_clinic_id)
    GROUP BY gs.bucket ORDER BY gs.bucket;

  ELSIF p_metric = 'evaluations' THEN
    RETURN QUERY
    SELECT gs.bucket, COUNT(vtv.id)::numeric
    FROM generate_series(date_trunc(v_trunc, p_since), p_until, v_interval) AS gs(bucket)
    LEFT JOIN public.volunteer_tracker_values vtv
      ON vtv.value IS NOT NULL AND vtv.value <> ''
    LEFT JOIN public.volunteer_tracker_columns vtc
      ON vtc.id = vtv.column_id AND vtc.column_type = 'rating_1_5'
    LEFT JOIN public.volunteer_tracker_entries vte
      ON vte.id = vtv.entry_id
      AND vte.created_at >= gs.bucket AND vte.created_at < gs.bucket + v_interval
      AND (p_clinic_id IS NULL OR vte.clinic_id = p_clinic_id)
    GROUP BY gs.bucket ORDER BY gs.bucket;

  ELSIF p_metric = 'avg_evaluation_score' THEN
    RETURN QUERY
    SELECT gs.bucket,
      ROUND(AVG(NULLIF(vtv.value, '')::numeric), 2)
    FROM generate_series(date_trunc(v_trunc, p_since), p_until, v_interval) AS gs(bucket)
    LEFT JOIN public.volunteer_tracker_entries vte
      ON vte.created_at >= gs.bucket AND vte.created_at < gs.bucket + v_interval
      AND (p_clinic_id IS NULL OR vte.clinic_id = p_clinic_id)
    LEFT JOIN public.volunteer_tracker_values vtv ON vtv.entry_id = vte.id
    LEFT JOIN public.volunteer_tracker_columns vtc
      ON vtc.id = vtv.column_id AND vtc.column_type = 'rating_1_5'
    GROUP BY gs.bucket ORDER BY gs.bucket;

  ELSE
    RETURN QUERY
    SELECT gs.bucket, COUNT(pe.id)::numeric
    FROM generate_series(date_trunc(v_trunc, p_since), p_until, v_interval) AS gs(bucket)
    LEFT JOIN public.platform_events pe
      ON pe.created_at >= gs.bucket AND pe.created_at < gs.bucket + v_interval
    GROUP BY gs.bucket ORDER BY gs.bucket;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_time_series TO authenticated;

-- Enable realtime for platform_events (activity feed)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_events;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
