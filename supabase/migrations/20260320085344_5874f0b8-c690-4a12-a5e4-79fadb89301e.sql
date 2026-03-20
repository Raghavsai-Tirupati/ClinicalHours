-- Link the original BCS opportunity to the hospital
UPDATE opportunities SET hospital_id = '253919e8-4dbd-45af-920a-94cec3660ef1'
WHERE id = 'e72deb15-b1b6-42cb-a5a9-d9c11e7b4fff' AND hospital_id IS NULL;

-- Point hospital_page to the original opportunity
UPDATE hospital_pages SET hospital_id = 'e72deb15-b1b6-42cb-a5a9-d9c11e7b4fff'
WHERE id = 'ea251652-9730-443d-9c78-96e5504c1a32';

-- Delete the duplicate opportunity (the deployed one with slug bcs-free-health-clinic-1)
DELETE FROM opportunities WHERE id = '5d25dbe3-e231-4ce4-9052-e3baade9ec3e';