-- Delete the e2e "Test Applicant" record
-- (Inserted by migration 20260321151534_fd5cdde6-8fa5-44f8-8fdb-f0cf85733ab1.sql)
DELETE FROM public.hospital_applications
WHERE account_id = '52599ba1-6654-4702-ba6a-f3eb3c8089bd'
  AND applicant_name = 'Test Applicant'
  AND lower(applicant_email) = lower('shivamkanodia77@gmail.com')
  AND opportunity_id = 'e72deb15-b1b6-42cb-a5a9-d9c11e7b4fff';

