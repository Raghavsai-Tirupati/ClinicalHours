-- Student Analytics Hub: cohorts, bundle RPC, funnel RPC, admin read policies

-- ============================================================
-- 1. analytics_cohorts — saved filter scripts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.analytics_cohorts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT,
  filter_json  JSONB NOT NULL DEFAULT '{}',
  is_template  BOOLEAN NOT NULL DEFAULT false,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_cohorts_template ON public.analytics_cohorts(is_template);

ALTER TABLE public.analytics_cohorts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage analytics cohorts"
  ON public.analytics_cohorts FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Seed template scripts
INSERT INTO public.analytics_cohorts (name, description, filter_json, is_template)
SELECT * FROM (VALUES
  ('Inactive after signup', 'Joined but no activity in 30+ days', '{"inactive_days_min": 30}'::jsonb, true),
  ('Saved but never applied', 'Has saves but zero applications', '{"saved_count_min": 1, "application_count_max": 0}'::jsonb, true),
  ('Incomplete onboarding', 'Profile onboarding not finished', '{"onboarding_complete": false}'::jsonb, true),
  ('Needs attention', 'Flagged by attention rules', '{"needs_attention": true}'::jsonb, true),
  ('Stale pending applications', 'Pending apps older than 14 days', '{"pending_applications_min": 1, "last_application_stale_days": 14}'::jsonb, true),
  ('High engagement, not premium', 'Active in last 7 days, no premium', '{"last_active_within_days": 7, "is_premium": false}'::jsonb, true)
) AS v(name, description, filter_json, is_template)
WHERE NOT EXISTS (SELECT 1 FROM public.analytics_cohorts WHERE is_template = true LIMIT 1);

-- ============================================================
-- 2. run_cohort_filter RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.run_cohort_filter(
  p_filter JSONB DEFAULT '{}',
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  university TEXT,
  major TEXT,
  graduation_year INT,
  joined_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  application_count INT,
  pending_applications INT,
  attention_level TEXT,
  needs_attention BOOLEAN,
  saved_count BIGINT,
  state TEXT,
  is_premium BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();

  RETURN QUERY
  SELECT
    s.id,
    s.full_name,
    s.university,
    s.major,
    s.graduation_year::int,
    s.joined_at,
    s.last_active_at,
    s.application_count,
    s.pending_applications,
    s.attention_level,
    s.needs_attention,
    COALESCE(sav.saved_count, 0),
    p.state,
    COALESCE(p.is_premium, false)
  FROM public.admin_student_summary s
  JOIN public.profiles p ON p.id = s.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::bigint AS saved_count,
           BOOL_OR(so.applied) AS has_applied
    FROM public.saved_opportunities so
    WHERE so.user_id = s.id
  ) sav ON true
  WHERE
    (NOT (p_filter ? 'needs_attention') OR s.needs_attention = (p_filter->>'needs_attention')::boolean)
    AND (NOT (p_filter ? 'onboarding_complete') OR s.onboarding_complete = (p_filter->>'onboarding_complete')::boolean)
    AND (NOT (p_filter ? 'is_premium') OR COALESCE(p.is_premium, false) = (p_filter->>'is_premium')::boolean)
    AND (NOT (p_filter ? 'university_contains') OR s.university ILIKE '%' || (p_filter->>'university_contains') || '%')
    AND (NOT (p_filter ? 'graduation_year') OR s.graduation_year = (p_filter->>'graduation_year')::int)
    AND (NOT (p_filter ? 'application_count_min') OR s.application_count >= (p_filter->>'application_count_min')::int)
    AND (NOT (p_filter ? 'application_count_max') OR s.application_count <= (p_filter->>'application_count_max')::int)
    AND (NOT (p_filter ? 'pending_applications_min') OR s.pending_applications >= (p_filter->>'pending_applications_min')::int)
    AND (NOT (p_filter ? 'saved_count_min') OR COALESCE(sav.saved_count, 0) >= (p_filter->>'saved_count_min')::int)
    AND (NOT (p_filter ? 'applied') OR COALESCE(sav.has_applied, false) = (p_filter->>'applied')::boolean)
    AND (NOT (p_filter ? 'last_active_within_days') OR s.last_active_at >= NOW() - ((p_filter->>'last_active_within_days')::int || ' days')::interval)
    AND (NOT (p_filter ? 'inactive_days_min') OR s.last_active_at IS NULL OR s.last_active_at < NOW() - ((p_filter->>'inactive_days_min')::int || ' days')::interval)
    AND (NOT (p_filter ? 'last_application_stale_days') OR (
      s.pending_applications > 0 AND s.last_application_at IS NOT NULL
      AND s.last_application_at < NOW() - ((p_filter->>'last_application_stale_days')::int || ' days')::interval
    ))
    AND (NOT (p_filter ? 'state_in') OR p.state = ANY(
      ARRAY(SELECT jsonb_array_elements_text(p_filter->'state_in'))
    ))
  ORDER BY s.last_active_at DESC NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 500))
  OFFSET GREATEST(0, p_offset);
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_cohort_filter TO authenticated;

-- ============================================================
-- 3. get_promotion_funnel RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_promotion_funnel(
  p_since TIMESTAMPTZ DEFAULT (NOW() - INTERVAL '30 days'),
  p_until TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_landing INT;
  v_guests INT;
  v_signups INT;
  v_onboarding INT;
  v_saved INT;
  v_applied INT;
  v_accepted INT;
BEGIN
  PERFORM public.assert_admin();

  SELECT COUNT(DISTINCT session_id) INTO v_landing
  FROM public.tracking_events
  WHERE event_type = 'page_view' AND page_url = '/'
    AND created_at BETWEEN p_since AND p_until;

  SELECT COUNT(DISTINCT session_id) INTO v_guests
  FROM public.guest_sessions
  WHERE created_at BETWEEN p_since AND p_until;

  SELECT COUNT(DISTINCT user_id) INTO v_signups
  FROM public.tracking_events
  WHERE event_type = 'signup' AND user_id IS NOT NULL
    AND created_at BETWEEN p_since AND p_until;

  SELECT COUNT(*) INTO v_onboarding
  FROM public.profiles
  WHERE onboarding_complete = true
    AND created_at BETWEEN p_since AND p_until;

  SELECT COUNT(DISTINCT user_id) INTO v_saved
  FROM public.saved_opportunities
  WHERE created_at BETWEEN p_since AND p_until;

  SELECT COUNT(DISTINCT user_id) INTO v_applied
  FROM public.saved_opportunities
  WHERE applied = true AND created_at BETWEEN p_since AND p_until;

  SELECT COUNT(DISTINCT student_id) INTO v_accepted
  FROM public.student_applications
  WHERE status = 'accepted' AND submitted_at BETWEEN p_since AND p_until;

  RETURN jsonb_build_object(
    'landing_visitors', v_landing,
    'guest_sessions', v_guests,
    'signups', v_signups,
    'onboarding_complete', v_onboarding,
    'saved_at_least_one', v_saved,
    'applied', v_applied,
    'accepted', v_accepted,
    'since', p_since,
    'until', p_until
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_promotion_funnel TO authenticated;

-- ============================================================
-- 4. get_student_analytics_bundle RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_student_analytics_bundle(p_user_id UUID)
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
    'profile', (SELECT to_jsonb(p.*) FROM public.profiles p WHERE p.id = p_user_id),
    'summary', (SELECT to_jsonb(s.*) FROM public.admin_student_summary s WHERE s.id = p_user_id),
    'saved_opportunities', COALESCE((
      SELECT jsonb_agg(to_jsonb(so.*) ORDER BY so.updated_at DESC)
      FROM public.saved_opportunities so WHERE so.user_id = p_user_id
    ), '[]'::jsonb),
    'student_applications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sa.id, 'status', sa.status, 'submitted_at', sa.submitted_at,
        'position_title', hp.title, 'interview_confirmed_at', sa.interview_confirmed_at
      ) ORDER BY sa.submitted_at DESC)
      FROM public.student_applications sa
      JOIN public.hospital_positions hp ON hp.id = sa.position_id
      WHERE sa.student_id = p_user_id
    ), '[]'::jsonb),
    'tracking_events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', te.id, 'event_type', te.event_type, 'page_url', te.page_url,
        'metadata', te.metadata, 'created_at', te.created_at
      ) ORDER BY te.created_at DESC)
      FROM (
        SELECT * FROM public.tracking_events
        WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 200
      ) te
    ), '[]'::jsonb),
    'platform_events', COALESCE((
      SELECT jsonb_agg(to_jsonb(pe.*) ORDER BY pe.created_at DESC)
      FROM (
        SELECT * FROM public.platform_events
        WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 100
      ) pe
    ), '[]'::jsonb),
    'experience_entries', COALESCE((
      SELECT jsonb_agg(to_jsonb(ee.*) ORDER BY ee.entry_date DESC)
      FROM public.experience_entries ee WHERE ee.user_id = p_user_id
    ), '[]'::jsonb),
    'activity_logs', COALESCE((
      SELECT jsonb_agg(to_jsonb(al.*) ORDER BY al.session_date DESC)
      FROM public.activity_logs al WHERE al.user_id = p_user_id
    ), '[]'::jsonb),
    'reviews', COALESCE((
      SELECT jsonb_agg(to_jsonb(r.*) ORDER BY r.created_at DESC)
      FROM public.reviews r WHERE r.user_id = p_user_id
    ), '[]'::jsonb),
    'clinic_memberships', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cm.id, 'status', cm.status, 'hours_logged', cm.hours_logged,
        'join_date', cm.join_date, 'clinic_id', cm.clinic_id
      ))
      FROM public.clinic_members cl WHERE cl.user_id = p_user_id
    ), '[]'::jsonb),
    'person_notes', COALESCE((
      SELECT jsonb_agg(to_jsonb(pn.*) ORDER BY pn.created_at DESC)
      FROM public.person_notes pn WHERE pn.student_id = p_user_id
    ), '[]'::jsonb),
    'guest_session', (
      SELECT to_jsonb(gs.*) FROM public.guest_sessions gs
      WHERE gs.converted_to_user_id = p_user_id LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_analytics_bundle TO authenticated;

-- ============================================================
-- 5. Admin read RLS for student 360 data
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all activity logs'
      AND tablename = 'activity_logs'
  ) THEN
    CREATE POLICY "Admins can read all activity logs"
      ON public.activity_logs FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can read all experience entries'
      AND tablename = 'experience_entries'
  ) THEN
    CREATE POLICY "Admins can read all experience entries"
      ON public.experience_entries FOR SELECT
      USING (public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;

-- ============================================================
-- 6. Realtime for live analytics
-- ============================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.student_applications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
