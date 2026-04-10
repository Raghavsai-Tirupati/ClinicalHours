import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type StudentApplication,
} from '@/types/positions';
import {
  applyApplicationFilters,
  sortApplications,
  type ApplicationFilterRule,
  type SortState,
} from '@/lib/applicationFilters';
import ApplicationFilterBar from './ApplicationFilterBar';
import ApplicationReviewPanel from './ApplicationReviewPanel';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  under_review: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  interview: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  waitlisted: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
] as const;

function nameToColor(name: string): string {
  const hash = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;
function getApplicantName(app: StudentApplication): string {
  const candidates = [app.applicant_name, app.student_profile?.full_name];
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !PLACEHOLDER_NAME_REGEX.test(t)) return t;
  }
  return (
    app.student_profile?.email?.split('@')[0] ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id?.slice(0, 8) || ''}`
  );
}

export default function ApplicationsHub() {
  const { hospitalPage } = useHospitalPageContext();
  const { applications, positions, loading, updateApplicationLocally } = useAllApplications(hospitalPage?.id);

  const [filterRules, setFilterRules] = useState<ApplicationFilterRule[]>([]);
  const [sort] = useState<SortState | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const afterFilter = applyApplicationFilters(applications, filterRules);
    return sortApplications(afterFilter, sort);
  }, [applications, filterRules, sort]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Applicants</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Click any applicant to review their profile, answers, and application details.
        </p>
      </div>

      <ApplicationFilterBar
        hospitalPageId={hospitalPage?.id}
        rules={filterRules}
        onRulesChange={setFilterRules}
        positions={positions}
        applications={applications}
      />

      {!loading && (
        <p className="text-xs text-muted-foreground -mt-2">
          {filtered.length} {filtered.length === 1 ? 'applicant' : 'applicants'}
          {filterRules.length > 0 && ` (filtered from ${applications.length})`}
        </p>
      )}

      {/* Applicant list */}
      <div className="rounded-lg border border-border/40 divide-y divide-border/40 overflow-hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-5 w-20" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {filterRules.length > 0
              ? 'No applicants match your filters. Try adjusting or clearing them.'
              : 'No applicants yet.'}
          </div>
        ) : (
          filtered.map((app, rowIdx) => {
            const name = getApplicantName(app);
            const email = app.applicant_email || app.student_profile?.email || '';
            const position = app.position?.title;
            const initial = name.charAt(0).toUpperCase();
            const avatarColor = nameToColor(name);

            return (
              <button
                key={app.id}
                type="button"
                onClick={() => setReviewIndex(rowIdx)}
                className="w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/30"
              >
                {/* Avatar */}
                <div className={`h-9 w-9 shrink-0 rounded-full ${avatarColor} flex items-center justify-center text-sm font-semibold text-white`}>
                  {initial}
                </div>

                {/* Name + Position (most important info) + email */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  {position && (
                    <div className="text-sm text-muted-foreground truncate">{position}</div>
                  )}
                  {email && (
                    <div className="text-xs text-muted-foreground/60 truncate">{email}</div>
                  )}
                </div>

                {/* Status + date */}
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}>
                    {APPLICATION_STATUS_LABELS[app.status] || app.status}
                  </Badge>
                  {app.submitted_at && (
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Full-screen review panel with prev/next navigation */}
      {reviewIndex !== null && hospitalPage && (
        <ApplicationReviewPanel
          applications={applications}
          filteredList={filtered}
          startIndex={reviewIndex}
          hospitalPage={hospitalPage}
          onClose={() => setReviewIndex(null)}
          onStatusChange={(appId, newStatus) => {
            updateApplicationLocally(appId, { status: newStatus });
          }}
        />
      )}
    </div>
  );
}
