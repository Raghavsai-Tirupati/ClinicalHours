-- 1) Unified activity view: add created_at, actor_type, description, clinic_id (additive)
CREATE OR REPLACE VIEW public.admin_unified_activity AS
  SELECT pe.id::text AS id,
    pe.created_at AS occurred_at,
    'platform'::text AS source,
    pe.event_type,
    pe.user_id,
    NULL::text AS actor_email,
    pe.entity_type,
    pe.entity_id,
    pe.metadata,
    pe.created_at AS created_at,
    COALESCE(pe.actor_type, 'system') AS actor_type,
    initcap(replace(pe.event_type, '_', ' ')) AS description,
    pe.clinic_id AS clinic_id
  FROM platform_events pe
UNION ALL
  SELECT te.id::text AS id,
    te.created_at AS occurred_at,
    'tracking'::text AS source,
    te.event_type,
    te.user_id,
    NULL::text AS actor_email,
    NULL::text AS entity_type,
    NULL::uuid AS entity_id,
    te.metadata,
    te.created_at AS created_at,
    CASE WHEN te.user_id IS NOT NULL THEN 'student' ELSE 'guest' END AS actor_type,
    initcap(replace(te.event_type, '_', ' ')) AS description,
    NULL::uuid AS clinic_id
  FROM tracking_events te
  WHERE te.event_type = ANY (ARRAY['login'::text, 'signup'::text, 'sign_up'::text, 'save_opportunity'::text, 'unsave_opportunity'::text, 'apply_click'::text, 'application_started'::text, 'application_submitted'::text, 'opportunity_view'::text, 'profile_update'::text, 'premium_upgrade'::text])
UNION ALL
  SELECT al.id::text AS id,
    al.created_at AS occurred_at,
    'admin_log'::text AS source,
    al.action_type AS event_type,
    NULL::uuid AS user_id,
    al.actor_email,
    al.target_type AS entity_type,
    NULL::uuid AS entity_id,
    al.metadata,
    al.created_at AS created_at,
    'admin'::text AS actor_type,
    initcap(replace(al.action_type, '_', ' ')) || COALESCE(' · ' || al.target_type, '') AS description,
    NULL::uuid AS clinic_id
  FROM admin_activity_log al;

-- 2) Student summary view: keep existing columns/order, fix attention_level colors, append frontend-required columns
CREATE OR REPLACE VIEW public.admin_student_summary AS
WITH last_login AS (
  SELECT tracking_events.user_id,
    max(tracking_events.created_at) AS last_login_at,
    count(*) AS login_count
  FROM tracking_events
  WHERE tracking_events.event_type = 'login'::text AND tracking_events.user_id IS NOT NULL
  GROUP BY tracking_events.user_id
), last_active AS (
  SELECT tracking_events.user_id,
    max(tracking_events.created_at) AS last_active_at
  FROM tracking_events
  WHERE tracking_events.user_id IS NOT NULL
  GROUP BY tracking_events.user_id
), app_counts AS (
  SELECT student_applications.student_id,
    count(*) AS application_count,
    count(*) FILTER (WHERE student_applications.status <> ALL (ARRAY['rejected'::text, 'withdrawn'::text])) AS active_application_count,
    count(*) FILTER (WHERE student_applications.status = ANY (ARRAY['new'::text, 'submitted'::text, 'under_review'::text])) AS pending_application_count,
    count(*) FILTER (WHERE student_applications.status = ANY (ARRAY['accepted'::text, 'staff'::text, 'completed'::text])) AS accepted_application_count,
    count(*) FILTER (WHERE student_applications.interview_confirmed_at IS NOT NULL AND student_applications.interview_confirmed_at >= now()) AS upcoming_interview_count,
    max(student_applications.submitted_at) AS last_application_at
  FROM student_applications
  WHERE student_applications.student_id IS NOT NULL
  GROUP BY student_applications.student_id
), clinic_info AS (
  SELECT cm.user_id,
    count(DISTINCT cm.clinic_id) AS clinic_count,
    COALESCE(sum(cm.hours_logged), 0::numeric) AS volunteer_hours,
    string_agg(DISTINCT h.name, ', '::text) AS clinic_names
  FROM clinic_members cm
    LEFT JOIN hospital_pages hp ON hp.id = cm.clinic_id
    LEFT JOIN hospitals h ON h.id = hp.hospital_id
  WHERE cm.user_id IS NOT NULL
  GROUP BY cm.user_id
), eval_scores AS (
  SELECT e.volunteer_user_id AS user_id,
    avg(NULLIF(v.value, ''::text)::numeric) AS avg_evaluation_score,
    count(*) AS evaluation_count
  FROM volunteer_tracker_values v
    JOIN volunteer_tracker_columns c ON c.id = v.column_id AND c.column_type = 'rating_1_5'::volunteer_tracker_column_type
    JOIN volunteer_tracker_entries e ON e.id = v.entry_id
  WHERE e.volunteer_user_id IS NOT NULL AND v.value ~ '^[0-9]+(\.[0-9]+)?$'::text
  GROUP BY e.volunteer_user_id
)
SELECT p.id,
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
  COALESCE(ac.application_count, 0::bigint) AS application_count,
  COALESCE(ac.active_application_count, 0::bigint) AS active_application_count,
  COALESCE(ac.pending_application_count, 0::bigint) AS pending_application_count,
  COALESCE(ci.clinic_count, 0::bigint) AS clinic_count,
  ci.clinic_names,
  COALESCE(ci.volunteer_hours, 0::numeric) AS volunteer_hours,
  es.avg_evaluation_score,
  CASE
    WHEN la.last_active_at IS NULL THEN 'gray'::text
    WHEN la.last_active_at < (now() - '30 days'::interval) THEN 'red'::text
    WHEN la.last_active_at < (now() - '14 days'::interval) THEN 'yellow'::text
    WHEN COALESCE(ac.pending_application_count, 0::bigint) > 0 AND la.last_active_at < (now() - '7 days'::interval) THEN 'yellow'::text
    ELSE 'green'::text
  END AS attention_level,
  (la.last_active_at IS NULL OR la.last_active_at < (now() - '14 days'::interval)) AS needs_attention,
  -- appended frontend-required columns
  p.created_at AS joined_at,
  p.onboarding_complete,
  p.phone,
  COALESCE(ll.login_count, 0::bigint) AS login_count,
  COALESCE(ac.pending_application_count, 0::bigint) AS pending_applications,
  COALESCE(ac.accepted_application_count, 0::bigint) AS accepted_applications,
  COALESCE(ac.upcoming_interview_count, 0::bigint) AS upcoming_interviews,
  ac.last_application_at,
  COALESCE(es.evaluation_count, 0::bigint) AS evaluation_count
FROM profiles p
  LEFT JOIN last_login ll ON ll.user_id = p.id
  LEFT JOIN last_active la ON la.user_id = p.id
  LEFT JOIN app_counts ac ON ac.student_id = p.id
  LEFT JOIN clinic_info ci ON ci.user_id = p.id
  LEFT JOIN eval_scores es ON es.user_id = p.id;

-- 3) KPI function: return the keys the Overview grid reads
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_kpis(
  p_since timestamp with time zone DEFAULT (now() - '30 days'::interval),
  p_until timestamp with time zone DEFAULT now(),
  p_clinic_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  PERFORM public.assert_admin();

  SELECT jsonb_build_object(
    'total_students', (SELECT count(*) FROM public.profiles),
    'active_students_week', (
      SELECT count(DISTINCT user_id) FROM public.tracking_events
      WHERE user_id IS NOT NULL AND created_at >= now() - interval '7 days'
    ),
    'new_students_month', (
      SELECT count(*) FROM public.profiles WHERE created_at BETWEEN p_since AND p_until
    ),
    'signups_in_range', (
      SELECT count(*) FROM public.profiles WHERE created_at BETWEEN p_since AND p_until
    ),
    'pending_applications', (
      SELECT count(*) FROM public.student_applications sa
      WHERE sa.status IN ('new','submitted','under_review')
        AND (p_clinic_id IS NULL OR sa.position_id IN (
          SELECT hp.id FROM public.hospital_positions hp WHERE hp.hospital_page_id = p_clinic_id))
    ),
    'upcoming_interviews', (
      SELECT count(*) FROM public.student_applications sa
      WHERE sa.interview_confirmed_at IS NOT NULL AND sa.interview_confirmed_at >= now()
        AND (p_clinic_id IS NULL OR sa.position_id IN (
          SELECT hp.id FROM public.hospital_positions hp WHERE hp.hospital_page_id = p_clinic_id))
    ),
    'evaluations_completed', (
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
    ),
    'logins_in_range', (
      SELECT count(*) FROM public.tracking_events
      WHERE event_type = 'login' AND created_at BETWEEN p_since AND p_until
    ),
    'applications_in_range', (
      SELECT count(*) FROM public.student_applications sa
      WHERE sa.submitted_at BETWEEN p_since AND p_until
        AND (p_clinic_id IS NULL OR sa.position_id IN (
          SELECT hp.id FROM public.hospital_positions hp WHERE hp.hospital_page_id = p_clinic_id))
    )
  ) INTO result;

  RETURN result;
END;
$function$;