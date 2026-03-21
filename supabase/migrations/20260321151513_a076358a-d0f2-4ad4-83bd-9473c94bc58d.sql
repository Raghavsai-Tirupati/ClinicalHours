
-- Move the BCS hospital member from the duplicate account to the correct one
UPDATE public.hospital_members
SET account_id = '52599ba1-6654-4702-ba6a-f3eb3c8089bd'
WHERE account_id = '0d5d41c4-7dec-4b83-aa78-c8c146e24e8c';

-- Delete the orphaned hospital account
DELETE FROM public.hospital_accounts
WHERE id = '0d5d41c4-7dec-4b83-aa78-c8c146e24e8c';

-- Log and delete the duplicate hospital
INSERT INTO public.hospital_deletion_log (deleted_hospital_id, kept_hospital_id, duplicate_reason, deleted_hospital_name)
VALUES ('b20bef05-7571-483a-8d7b-712117f31582', '253919e8-4dbd-45af-920a-94cec3660ef1', 'Duplicate BCS Free Health Clinic - no opportunities or pages linked', 'BCS Free Health Clinic');

DELETE FROM public.hospitals
WHERE id = 'b20bef05-7571-483a-8d7b-712117f31582';

-- Set the interview booking URL on the correct account for testing
UPDATE public.hospital_accounts
SET interview_booking_url = 'https://calendly.com/bcs-clinic/interview'
WHERE id = '52599ba1-6654-4702-ba6a-f3eb3c8089bd';
