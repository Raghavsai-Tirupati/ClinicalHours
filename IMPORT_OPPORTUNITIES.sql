-- ============================================================
-- IMPORT OPPORTUNITIES FROM CSV DATA
-- Run this in Supabase SQL Editor after DEPLOY_TO_PRODUCTION.sql
-- ============================================================

-- This imports hospitals from the CSV files
-- Format: name, type, location, coordinates, contact info

INSERT INTO public.opportunities (name, type, location, latitude, longitude, phone, email, website, description, hours_required, acceptance_likelihood, requirements)
VALUES
('Cherokee Mental Health Institute', 'hospital', 'Cherokee', 42.7572584, -95.5727803, '+1-712-225-2594', NULL, 'https://dhs.iowa.gov/mhds/mental-health/in-patient/mental-health-institutes/cherokee', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Woodward Resource Center', 'hospital', 'Woodward', 41.872117, -93.9157918, '+1-515-438-2600', NULL, 'https://dhs.iowa.gov/mhds/disability-services/resource-centers/woodward', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Sanford Health Inwood Clinic', 'clinic', 'Inwood', 43.3071909, -96.4265231, '+1-712-753-4401', NULL, 'https://www.sanfordhealth.org/locations/sanford-health-inwood-clinic', 'Sanford Health', 'Varies', 'medium', ARRAY[]::text[]),
('Avera Medical Group Larchwood', 'clinic', 'Larchwood', 43.4527625, -96.4329789, '+1-712-477-2185', NULL, 'https://www.avera.org/locations/profile/?id=196', 'Avera Health', 'Varies', 'medium', ARRAY[]::text[]),
('Avera Medical Group Sibley', 'clinic', 'Sibley', 43.4102466, -95.7430712, '+1-712-754-3658', NULL, 'https://www.avera.org/locations/profile/?id=169', 'Avera Health', 'Varies', 'medium', ARRAY[]::text[]),
('Mercy Family Clinic - Clear Lake', 'clinic', 'Greene, IA', 43.1321154, -93.3713314, '+1-641-357-2191', NULL, 'http://www.mercynorthiowa.com/clear-lake', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Lakes Family Practice Center', 'clinic', 'Spirit Lake', 43.4180139, -95.1255371, '+1-712-336-3750', NULL, 'https://www.avera.org/locations/profile/?id=194', 'Avera Health', 'Varies', 'medium', ARRAY[]::text[]),
('Sanford Canton-Inwood Medical Center', 'hospital', 'Canton', 43.3041397, -96.5572579, '+1 605 764 1400', NULL, 'http://www.sanfordcantoninwood.org/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Mercy Hospital Jefferson', 'hospital', 'Festus', 38.1967583, -90.3936491, '+1 636 933 1000', NULL, 'https://www.mercy.net/practice/mercy-hospital-jefferson', 'Mercy', 'Varies', 'medium', ARRAY[]::text[]),
('Salem Memorial District Hospital', 'hospital', 'Salem', 37.6598285, -91.569934, '+1 573 729 6626', NULL, 'https://www.smdh.net/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('SSM Health Saint Louis University Hospital', 'hospital', 'Saint Louis, MO', 38.6242428, -90.2391508, '+1 314 577 8000', NULL, 'http://www.ssmhealth.com/sluhospital', 'SSM Health', 'Varies', 'medium', ARRAY[]::text[]),
('SSM Health Cardinal Glennon Children''s Hospital', 'hospital', 'Saint Louis, MO', 38.6214405, -90.2392793, '+1 314 577 5600', NULL, 'http://www.cardinalglennon.com/P', 'SSM Health', 'Varies', 'medium', ARRAY[]::text[]),
('General John J Pershing Memorial Hospital', 'hospital', 'Brookfield', 39.7746017, -93.0672597, '+1 660 258 2222', NULL, 'https://www.phsmo.org/', 'Pershing Health System', 'Varies', 'medium', ARRAY[]::text[]),
('Metropolitan St. Louis Psychiatric Center', 'hospital', 'Saint Louis, MO', 38.6539363, -90.2759303, '+1 314 877 0775', NULL, 'https://dmh.mo.gov/ftc', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Piggott Community Hospital', 'hospital', 'Piggott', 36.3904214, -90.2049316, '+1 870 598 3881', NULL, 'https://pch-health.com/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Ozarks Community Hospital of Gravette', 'hospital', 'Gravette', 36.4086921, -94.4604384, '+1 479 787 5291', NULL, 'https://www.ochonline.com/locations/hospital-gravette/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Levi Hospital', 'hospital', 'Hot Springs', 34.5100517, -93.0571119, '+1 800 264 5384', NULL, 'https://www.levihospital.com/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Baptist Health Rehabilitation Institute', 'hospital', 'Little Rock', 34.745, -92.3794444, '+1 501 202 7000', NULL, 'https://www.baptist-health.com/location/baptist-health-rehabilitation-institute-little-rock-little-rock', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Rivendell Behavioral Health Services', 'hospital', 'Benton', 34.61362, -92.53269, '+1 501 316 1255', NULL, 'https://www.rivendellofarkansas.com/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('HealthSouth Rehabilitation Hospital of Fort Smith', 'hospital', 'Fort Smith, AR', 35.37389, -94.41872, '+1 479 785 3300', NULL, 'http://www.healthsouthfortsmith.com/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('CHI St. Vincent Hot Springs Rehabilitation Hospital', 'hospital', 'Hot Springs', 34.46424, -93.0749, '+1 501 651 2000', NULL, 'http://stvhotsprings.com/', 'Catholic Health Initiatives', 'Varies', 'medium', ARRAY[]::text[]),
('Riverview Behavioral Health', 'hospital', 'Texarkana', 33.46115, -94.03421, '+1 903 306 0076', NULL, 'https://www.riverviewbehavioralhealth.com/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('United Methodist Behavioral Hospital', 'hospital', 'Maumelle, AR', 34.8766667, -92.3947222, '+1 501 803 3388', NULL, 'https://www.methodistfamily.org/services/methodist-behavioral-hospital/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Saint Bernards Behavioral Health', 'hospital', 'Jonesboro', 35.851806, -90.6701252, '+1 870 932 2800', NULL, 'https://www.stbernards.info/specialties-services/behavioral-health-services', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('CHI St. Vincent Rehabilitation Hospital - North', 'hospital', 'Sherwood', 34.81297, -92.20805, '+1 501 834 1800', NULL, 'https://www.chistvincent.com/our-clinics/chi-st-vincent-rehabilitation-hospital', 'Catholic Health Initiatives', 'Varies', 'medium', ARRAY[]::text[]),
('Baptist Health Extended Care Hospital', 'hospital', 'Little Rock', 34.74458, -92.38141, '+1 501 202 1090', NULL, 'https://www.baptist-health.com/location/baptist-health-extended-care-hospital', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('CHRISTUS Dubuis of Fort Smith', 'hospital', 'Fort Smith', 35.3559616, -94.3520959, '+1 479 314 4900', NULL, 'http://www.christusdubuis.org/fortsmith', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Avera Sacred Heart Hospital', 'hospital', 'Yankton', 42.8733354, -97.4081743, '+1 605 668 8000', NULL, 'https://www.avera.org/locations/sacred-heart/', 'Avera Health', 'Varies', 'medium', ARRAY[]::text[]),
('Sanford Aberdeen Medical Center', 'hospital', 'Aberdeen', 45.4629555, -98.445834, '+1 605 626 4200', NULL, 'https://www.sanfordhealth.org/community/sanford-aberdeen', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Progress West Hospital', 'hospital', 'O''Fallon', 38.7157313, -90.6988026, '+1 636 344 1000', NULL, 'https://www.progresswest.org/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Missouri Delta Medical Center', 'hospital', 'Sikeston', 36.889995, -89.5834552, '+1 573 471 1600', NULL, 'https://www.missouridelta.com/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Mercy Hospital Stoddard', 'hospital', 'Sikeston', 36.8075292, -89.9682815, '+1 573 624 5566', NULL, 'https://www.mercy.net/practice/mercy-hospital-stoddard/', 'Mercy', 'Varies', 'medium', ARRAY[]::text[]),
('Twin Rivers Regional Medical Center', 'hospital', 'Kennett', 36.2353437, -90.0411604, '+1 573 888 4522', NULL, 'https://www.twinriversregional.com/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Barnes-Jewish Hospital', 'hospital', 'Saint Louis, MO', 38.6371664, -90.264366, '+1-314-747-3000', NULL, 'https://www.barnesjewish.org/', NULL, 'Varies', 'high', ARRAY[]::text[]),
('University of Arkansas Medical Sciences Medical Center', 'hospital', 'Little Rock', 34.7481958, -92.3199755, '+1 501 686 7000', NULL, 'https://uamshealth.com/', NULL, 'Varies', 'high', ARRAY[]::text[]),
('Arkansas Children''s Hospital', 'hospital', 'Little Rock, AR', 34.7410639, -92.2928361, NULL, NULL, 'https://www.archildrens.org/', NULL, 'Varies', 'high', ARRAY[]::text[]),
('University of Iowa Hospitals & Clinics', 'hospital', 'Iowa City', 41.6593417, -91.5479596, '+1 800 777 8442', NULL, 'https://uihc.org/', 'The University of Iowa', 'Varies', 'high', ARRAY[]::text[]),
('Mayo Clinic Health System', 'hospital', 'Rochester, MN', 44.0225, -92.4669, NULL, NULL, 'https://www.mayoclinichealthsystem.org/', 'Mayo Clinic', 'Varies', 'low', ARRAY[]::text[]),
('Saint Luke''s Hospital of Kansas City', 'hospital', 'Kansas City, MO', 39.0485238, -94.5910632, '+1 816 932 2000', NULL, 'https://www.saintlukeskc.org/locations/saint-lukes-hospital-kansas-city', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('Mercy Hospital Springfield', 'hospital', 'Springfield', 37.1782144, -93.274259, '+1 417 820 2000', NULL, 'https://www.mercy.net/springfieldmo', 'Mercy', 'Varies', 'medium', ARRAY[]::text[]),
('Children''s Mercy Hospital', 'hospital', 'Kansas City, MO', 39.0849249, -94.5773629, '+1 816 234 3000', NULL, 'https://www.childrensmercy.org/', NULL, 'Varies', 'high', ARRAY[]::text[]),
('Saint Louis Children''s Hospital', 'hospital', 'Saint Louis, MO', 38.6378291, -90.2649693, '+1 314 454 6000', NULL, 'https://www.stlouischildrens.org/', NULL, 'Varies', 'high', ARRAY[]::text[]),
('Sanford USD Medical Center', 'hospital', 'Sioux Falls, SD', 43.5340165, -96.7431287, NULL, NULL, 'https://www.sanfordhealth.org/sioux-falls', 'Sanford Health', 'Varies', 'medium', ARRAY[]::text[]),
('Avera McKennan Hospital', 'hospital', 'Sioux Falls, SD', 43.5343191, -96.7137977, '+1-605-322-8000', NULL, 'https://www.avera.org/locations/mckennan/', 'Avera Health', 'Varies', 'medium', ARRAY[]::text[]),
('MercyOne Des Moines Medical Center', 'hospital', 'Des Moines', 41.598478, -93.6234203, '+1 515 247 3121', NULL, 'https://www.mercyone.org/desmoines/', NULL, 'Varies', 'medium', ARRAY[]::text[]),
('UnityPoint Health - Iowa Methodist', 'hospital', 'Des Moines, IA', 41.5898598, -93.6342908, '+1 515 241 6212', NULL, 'https://www.unitypoint.org/desmoines/iowa-methodist-medical-center.aspx', 'UnityPoint Health', 'Varies', 'medium', ARRAY[]::text[]),
('Altru Hospital', 'hospital', 'Grand Forks', 47.9105709, -97.0695652, '+1 701 780 5000', NULL, 'https://www.altru.org/', 'Altru Health System', 'Varies', 'medium', ARRAY[]::text[]),
('Sanford Medical Center Fargo', 'hospital', 'Fargo', 46.8455218, -96.876807, '+1-701-417-2000', NULL, 'https://sanfordhealth.org/locations/sanford-medical-center-fargo', 'Sanford Health', 'Varies', 'medium', ARRAY[]::text[]),
('Essentia Health-Fargo', 'hospital', 'Fargo', 46.8315769, -96.8280727, '+1 701 364 8000', NULL, 'https://www.essentiahealth.org/fargo/find-a-clinic/essentia-healthfargo-87.aspx', 'Essentia Health', 'Varies', 'medium', ARRAY[]::text[]),
('Trinity Hospital Minot', 'hospital', 'Minot', 48.232514, -101.2944897, '+1 701 857 5000', NULL, 'https://www.trinityhealth.org/', NULL, 'Varies', 'medium', ARRAY[]::text[])
ON CONFLICT DO NOTHING;

-- Verify import
SELECT COUNT(*) as total_opportunities FROM opportunities;
