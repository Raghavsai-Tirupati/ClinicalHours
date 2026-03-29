
-- Remove the "Test Applicant" e2e seed row and any dependent answers
DELETE FROM public.hospital_application_answers
WHERE application_id IN (
  SELECT id FROM public.hospital_applications
  WHERE lower(applicant_name) = 'test applicant'
    AND lower(applicant_email) = 'shivamkanodia77@gmail.com'
    AND account_id = '52599ba1-6654-4702-ba6a-f3eb3c8089bd'
);

DELETE FROM public.hospital_applications
WHERE lower(applicant_name) = 'test applicant'
  AND lower(applicant_email) = 'shivamkanodia77@gmail.com'
  AND account_id = '52599ba1-6654-4702-ba6a-f3eb3c8089bd';
