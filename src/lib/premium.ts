export type PreHealthTrack = 'pre-med' | 'pre-PA' | 'pre-nursing' | 'pre-dental' | 'pre-pharm' | 'undecided';
export type YearInSchool = 'freshman' | 'sophomore' | 'junior' | 'senior' | 'post-bacc' | 'gap year';
export type MCATStatus = 'not_started' | 'studying' | 'taken';

export type ActivityType =
  | 'shadowing' | 'volunteering' | 'research' | 'clinical_employment'
  | 'community_service' | 'teaching_tutoring' | 'leadership' | 'other';

export type LetterStatus =
  | 'not_asked' | 'asked_pending' | 'confirmed' | 'writing'
  | 'submitted_to_amcas' | 'received_by_amcas';

export type RelationshipType =
  | 'science_professor' | 'non_science_professor' | 'research_pi'
  | 'physician_shadowing' | 'clinical_supervisor' | 'employer'
  | 'committee' | 'other';

export type SubmissionMethod = 'aamc_portal' | 'interfolio' | 'committee_packet' | 'other';

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  shadowing: 'Shadowing',
  volunteering: 'Volunteering',
  research: 'Research',
  clinical_employment: 'Clinical Employment',
  community_service: 'Community Service',
  teaching_tutoring: 'Teaching / Tutoring',
  leadership: 'Leadership',
  other: 'Other',
};

export const LETTER_STATUS_LABELS: Record<LetterStatus, string> = {
  not_asked: 'Not Asked',
  asked_pending: 'Asked (Pending)',
  confirmed: 'Confirmed',
  writing: 'Writing',
  submitted_to_amcas: 'Submitted to AMCAS',
  received_by_amcas: 'Received by AMCAS',
};

export const PRE_HEALTH_TRACKS: { value: PreHealthTrack; label: string }[] = [
  { value: 'pre-med', label: 'Pre-Med' },
  { value: 'pre-PA', label: 'Pre-PA' },
  { value: 'pre-nursing', label: 'Pre-Nursing' },
  { value: 'pre-dental', label: 'Pre-Dental' },
  { value: 'pre-pharm', label: 'Pre-Pharm' },
  { value: 'undecided', label: 'Undecided' },
];

export const YEARS_IN_SCHOOL: { value: YearInSchool; label: string }[] = [
  { value: 'freshman', label: 'Freshman' },
  { value: 'sophomore', label: 'Sophomore' },
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'post-bacc', label: 'Post-Bacc' },
  { value: 'gap year', label: 'Gap Year' },
];

export const SPECIALTIES = [
  'Surgery', 'Internal Medicine', 'Pediatrics', 'Emergency Medicine',
  'Cardiology', 'Oncology', 'Psychiatry', 'Family Medicine',
  'OB/GYN', 'Neurology', 'Orthopedics', 'Dermatology',
  'Radiology', 'Anesthesiology', 'Pathology', 'Other',
] as const;

export const AMCAS_CATEGORIES = [
  'Artistic Endeavor',
  'Community Service/Volunteer (Medical/Clinical)',
  'Community Service/Volunteer (Not Medical/Clinical)',
  'Conferences Attended',
  'Extracurricular Activities',
  'Honors/Awards/Recognitions',
  'Intercollegiate Athletics',
  'Leadership (Not Listed Elsewhere)',
  'Military Service',
  'Other',
  'Paid Employment (Medical/Clinical)',
  'Paid Employment (Not Medical/Clinical)',
  'Physician Shadowing/Clinical Observation',
  'Presentations/Posters',
  'Publications',
  'Research/Lab',
  'Social Justice/Advocacy',
  'Teaching/Tutoring/Teaching Assistant',
  'University/College Student Government',
] as const;

export const AAMC_COMPETENCIES = {
  professional: [
    { id: 1, name: 'Commitment to Learning and Growth' },
    { id: 2, name: 'Empathy and Compassion' },
    { id: 3, name: 'Ethical Responsibility to Self and Others' },
    { id: 4, name: 'Interpersonal Skills' },
    { id: 5, name: 'Oral Communication' },
    { id: 6, name: 'Reliability and Dependability' },
    { id: 7, name: 'Resilience and Adaptability' },
    { id: 8, name: 'Self-Awareness' },
    { id: 9, name: 'Service Orientation' },
    { id: 10, name: 'Teamwork and Collaboration' },
    { id: 11, name: 'Understanding Others' },
  ],
  science: [
    { id: 12, name: 'Human Behavior' },
    { id: 13, name: 'Living Systems' },
  ],
  thinking: [
    { id: 14, name: 'Critical Thinking' },
    { id: 15, name: 'Quantitative Reasoning' },
    { id: 16, name: 'Scientific Inquiry' },
    { id: 17, name: 'Written Communication' },
  ],
} as const;

export const ALL_COMPETENCIES = [
  ...AAMC_COMPETENCIES.professional,
  ...AAMC_COMPETENCIES.science,
  ...AAMC_COMPETENCIES.thinking,
];

export const SECONDARY_ARCHETYPES = [
  { id: 'diversity', name: 'Diversity', prompt: 'How will you contribute to diversity?' },
  { id: 'adversity', name: 'Adversity / Challenge', prompt: 'Describe a challenge you overcame' },
  { id: 'leadership', name: 'Leadership', prompt: 'Tell us about leadership' },
  { id: 'service', name: 'Service', prompt: 'Describe your commitment to serving others' },
  { id: 'why_school', name: 'Why Our School', prompt: 'Why are you applying here?' },
  { id: 'research', name: 'Research', prompt: 'Describe a research project' },
  { id: 'ethical', name: 'Ethical Dilemma', prompt: 'Describe an ethical challenge' },
  { id: 'gap_year', name: 'Gap Year', prompt: 'What did you do during time off?' },
  { id: 'teamwork', name: 'Teamwork', prompt: 'Describe working with a team' },
  { id: 'failure', name: 'Failure / Growth', prompt: 'Describe a failure and what you learned' },
  { id: 'goals', name: 'Future Goals', prompt: 'What does your ideal career look like?' },
  { id: 'clinical', name: 'Meaningful Clinical Experience', prompt: 'Describe an impactful clinical encounter' },
] as const;

export const APPLICATION_COSTS = {
  amcas_first: 175,
  amcas_additional: 47,
  aacomas_first: 198,
  aacomas_additional: 60,
  tmdsas_flat: 230,
  secondary_avg: 100,
  secondary_min: 30,
  secondary_max: 200,
  mcat: 345,
  casper_base: 85,
  casper_additional: 18,
  casper_free_programs: 7,
  preview: 100,
  msar: 28,
  interview_min: 200,
  interview_max: 800,
  transcript_min: 10,
  transcript_max: 25,
} as const;
