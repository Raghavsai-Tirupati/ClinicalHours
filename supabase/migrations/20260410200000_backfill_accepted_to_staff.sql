-- Backfill: create clinic_members for every accepted student_application
-- that doesn't already have a corresponding row. This covers applicants
-- who were accepted before the auto-promote code was deployed.

INSERT INTO clinic_members (
  clinic_id,
  user_id,
  application_id,
  full_name,
  email,
  status,
  onboarding_source,
  join_date
)
SELECT
  hp.id                                          AS clinic_id,
  sa.student_id                                  AS user_id,
  sa.id                                          AS application_id,
  COALESCE(
    NULLIF(TRIM(sa.applicant_name), ''),
    NULLIF(TRIM(p.full_name), ''),
    SPLIT_PART(sa.applicant_email, '@', 1),
    'Unknown'
  )                                              AS full_name,
  COALESCE(sa.applicant_email, p.email)          AS email,
  'active'                                       AS status,
  'new_applicant'                                AS onboarding_source,
  COALESCE(sa.submitted_at::date, CURRENT_DATE)  AS join_date
FROM student_applications sa
JOIN hospital_positions   pos ON pos.id = sa.position_id
JOIN hospital_pages       hp  ON hp.id = pos.hospital_page_id
LEFT JOIN profiles        p   ON p.id  = sa.student_id
WHERE sa.status = 'accepted'
  -- Skip if a clinic_member already exists for this application
  AND NOT EXISTS (
    SELECT 1 FROM clinic_members cm
    WHERE cm.clinic_id = hp.id
      AND (cm.application_id = sa.id OR cm.user_id = sa.student_id)
  );

-- Deduplicate: if a user has multiple clinic_members rows for the same
-- clinic (e.g. from multiple accepted applications), keep only the one
-- with a tracker_category_id set (i.e. assigned to a role), or the
-- earliest one if none are assigned.
DELETE FROM clinic_members
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY clinic_id, user_id
        ORDER BY
          -- prefer the row that has a tracker role assigned
          CASE WHEN tracker_category_id IS NOT NULL THEN 0 ELSE 1 END,
          -- then prefer the earliest
          created_at ASC
      ) AS rn
    FROM clinic_members
    WHERE user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);
