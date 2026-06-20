import type { AdminStudentSummary } from './api';

export type EngagementTier = 'power' | 'active' | 'cooling' | 'dormant' | 'never';

export interface EngagementTierRow {
  tier: EngagementTier;
  label: string;
  count: number;
  description: string;
}

const TIER_META: Record<EngagementTier, { label: string; description: string }> = {
  power: { label: 'Power users', description: 'Active in last 7 days, 3+ logins' },
  active: { label: 'Active', description: 'Active in last 14 days' },
  cooling: { label: 'Cooling', description: 'Active 15–30 days ago' },
  dormant: { label: 'Dormant', description: 'Inactive 30+ days' },
  never: { label: 'Never active', description: 'No tracked activity' },
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function classifyEngagement(student: AdminStudentSummary): EngagementTier {
  const days = daysSince(student.last_active_at ?? student.last_login_at);
  if (days === null) return 'never';
  if (days <= 7 && student.login_count >= 3) return 'power';
  if (days <= 14) return 'active';
  if (days <= 30) return 'cooling';
  return 'dormant';
}

export function computeEngagementTiers(students: AdminStudentSummary[]): EngagementTierRow[] {
  const counts: Record<EngagementTier, number> = {
    power: 0,
    active: 0,
    cooling: 0,
    dormant: 0,
    never: 0,
  };
  students.forEach((s) => {
    counts[classifyEngagement(s)] += 1;
  });
  return (Object.keys(TIER_META) as EngagementTier[]).map((tier) => ({
    tier,
    ...TIER_META[tier],
    count: counts[tier],
  }));
}

export interface DropOffInsight {
  id: string;
  label: string;
  description: string;
  cohortFilter: Record<string, unknown>;
  countHint?: number;
}

export function computeDropOffInsights(
  funnel: {
    signups: number;
    onboarding_complete: number;
    saved_at_least_one: number;
    applied: number;
  } | null,
  students: AdminStudentSummary[]
): DropOffInsight[] {
  const incompleteOnboarding = students.filter((s) => !s.onboarding_complete).length;
  const savedNotApplied = students.filter(
    (s) => s.application_count === 0 && s.last_active_at
  ).length;
  const stalePending = students.filter(
    (s) => s.pending_applications > 0 && s.needs_attention
  ).length;

  const insights: DropOffInsight[] = [
    {
      id: 'onboarding',
      label: 'Incomplete onboarding',
      description: funnel
        ? `${funnel.signups - funnel.onboarding_complete} signups did not finish onboarding`
        : 'Students who signed up but did not complete onboarding',
      cohortFilter: { onboarding_complete: false },
      countHint: incompleteOnboarding,
    },
    {
      id: 'saved-not-applied',
      label: 'Browsing, not applying',
      description: funnel
        ? `${funnel.saved_at_least_one - funnel.applied} saved opportunities but never applied`
        : 'Active students with zero applications',
      cohortFilter: { saved_count_min: 1, applied: false },
      countHint: savedNotApplied,
    },
    {
      id: 'inactive',
      label: 'Inactive 30+ days',
      description: 'Re-engagement candidates for email campaigns',
      cohortFilter: { inactive_days_min: 30 },
      countHint: students.filter((s) => {
        const d = daysSince(s.last_active_at ?? s.last_login_at);
        return d !== null && d >= 30;
      }).length,
    },
    {
      id: 'stale-pending',
      label: 'Stale pending applications',
      description: 'Pending apps with no recent activity',
      cohortFilter: { pending_applications_min: 1, last_application_stale_days: 14 },
      countHint: stalePending,
    },
  ];

  return insights;
}
