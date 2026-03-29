
-- Delete positions and their questions/applications for the testing page
DELETE FROM position_questions WHERE position_id IN (
  SELECT id FROM hospital_positions WHERE hospital_page_id = '79dce9a0-64fb-4a3a-80ba-08090b70025b'
);
DELETE FROM application_answers WHERE application_id IN (
  SELECT id FROM student_applications WHERE position_id IN (
    SELECT id FROM hospital_positions WHERE hospital_page_id = '79dce9a0-64fb-4a3a-80ba-08090b70025b'
  )
);
DELETE FROM student_applications WHERE position_id IN (
  SELECT id FROM hospital_positions WHERE hospital_page_id = '79dce9a0-64fb-4a3a-80ba-08090b70025b'
);
DELETE FROM hospital_positions WHERE hospital_page_id = '79dce9a0-64fb-4a3a-80ba-08090b70025b';
DELETE FROM admin_activity_log WHERE hospital_page_id = '79dce9a0-64fb-4a3a-80ba-08090b70025b';
DELETE FROM hospital_pages WHERE id = '79dce9a0-64fb-4a3a-80ba-08090b70025b';

-- Also delete the testing opportunity
DELETE FROM opportunities WHERE id = '68123b31-9ba9-41be-9bc7-1b44a18f3e00';
