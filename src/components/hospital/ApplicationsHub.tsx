import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ExternalLink, LayoutList, Mail, Table2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
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
import ApplicantReviewPanel from './ApplicantReviewPanel';
import RichEmailDialog from './RichEmailDialog';
import InterviewInviteDialog from './InterviewInviteDialog';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  under_review: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  interview: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  waitlisted: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

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
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, positions, loading, updateApplicationLocally } = useAllApplications(hospitalPage?.id);

  // ── Filter & sort state ───────────────────────────────────
  const [filterRules, setFilterRules] = useState<ApplicationFilterRule[]>([]);
  const [sort] = useState<SortState | null>(null);

  // ── Selection state (table view) ──────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);

  // ── View mode ─────────────────────────────────────────────
  // applicationView=true → split-pane inline view (default)
  // applicationView=false → table with overlay on name click
  const [applicationView, setApplicationView] = useState(true);
  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null); // app view
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);              // table view

  const filtered = useMemo(() => {
    const afterFilter = applyApplicationFilters(applications, filterRules);
    return sortApplications(afterFilter, sort);
  }, [applications, filterRules, sort]);

  const filteredIds = useMemo(() => new Set(filtered.map((a) => a.id)), [filtered]);
  const validSelected = useMemo(
    () => new Set([...selectedIds].filter((id) => filteredIds.has(id))),
    [selectedIds, filteredIds],
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (validSelected.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  };

  const selectedApplicationIds = useMemo(() => [...validSelected], [validSelected]);

  // Status change handler for the inline app view panel
  const handleStatusChange = useCallback(
    async (appId: string, newStatus: ApplicationStatus) => {
      const update = buildStudentApplicationStatusUpdate(newStatus);
      updateApplicationLocally(appId, update);
      setSelectedApp((prev) => (prev?.id === appId ? { ...prev, ...update } : prev));
      const { error } = await supabase
        .from('student_applications')
        .update(update)
        .eq('id', appId);
      if (error) toast.error('Failed to update status');
    },
    [updateApplicationLocally],
  );

  const handleViewToggle = useCallback(() => {
    setApplicationView((v) => !v);
    setSelectedApp(null);
    setReviewIndex(null);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Applicants</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {applicationView
              ? 'Select an applicant on the left to view their profile.'
              : 'Click a name to open their profile. Use the checkbox to bulk-select for email.'}
          </p>
        </div>
        <Button
          variant={applicationView ? 'default' : 'outline'}
          size="sm"
          className="gap-2 shrink-0 mt-1"
          onClick={handleViewToggle}
        >
          {applicationView ? (
            <><Table2 className="h-4 w-4" />Table view</>
          ) : (
            <><LayoutList className="h-4 w-4" />Application view</>
          )}
        </Button>
      </div>

      {/* ── Advanced filter bar ─────────────────────────────── */}
      <ApplicationFilterBar
        hospitalPageId={hospitalPage?.id}
        rules={filterRules}
        onRulesChange={setFilterRules}
        positions={positions}
        applications={applications}
      />

      {/* ── Bulk action bar (table view only) ───────────────── */}
      {!applicationView && validSelected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2">
          <span className="text-sm font-medium">{validSelected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEmailDialogOpen(true)} className="gap-1.5">
              <Mail className="h-4 w-4" />
              Send Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInterviewDialogOpen(true)}
              className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
            >
              <CalendarCheck className="h-4 w-4" />
              Send Interview Invite
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs">
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* ── Results count ───────────────────────────────────── */}
      {!loading && (
        <p className="text-xs text-muted-foreground -mt-2">
          {filtered.length} {filtered.length === 1 ? 'applicant' : 'applicants'}
          {filterRules.length > 0 && ` (filtered from ${applications.length})`}
        </p>
      )}

      {/* ════════════════════════════════════════════════════════
          APPLICATION VIEW — inline split-pane (list + profile)
          ════════════════════════════════════════════════════════ */}
      {applicationView && (
        <div className="rounded-lg border border-border/40 overflow-hidden flex min-h-[520px]">
          {/* Left: applicant list */}
          <div className="w-64 shrink-0 border-r border-border/40 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                {filterRules.length > 0 ? 'No applicants match your filters.' : 'No applicants yet.'}
              </p>
            ) : (
              filtered.map((app) => {
                const name = getApplicantName(app);
                const isActive = selectedApp?.id === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setSelectedApp(app)}
                    className={`w-full text-left px-3 py-3 border-b border-border/30 transition-colors hover:bg-muted/40 ${
                      isActive ? 'bg-muted/70 border-l-2 border-l-primary' : ''
                    }`}
                  >
                    <div className="text-sm font-medium truncate">{name}</div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] mt-1 ${STATUS_COLORS[app.status] || ''}`}
                    >
                      {APPLICATION_STATUS_LABELS[app.status] || app.status}
                    </Badge>
                  </button>
                );
              })
            )}
          </div>

          {/* Right: profile panel */}
          <div className="flex-1 overflow-y-auto p-5">
            {selectedApp ? (
              <ApplicantReviewPanel
                application={selectedApp}
                onStatusChange={handleStatusChange}
                onNoteSaved={() => {}}
                showHeaderAvatar
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select an applicant to view their profile
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          TABLE VIEW — full table; name click opens overlay
          ════════════════════════════════════════════════════════ */}
      {!applicationView && (
        <>
          <div className="rounded-lg border border-border/40 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && validSelected.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                      className="h-3.5 w-3.5"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Position</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                      {filterRules.length > 0
                        ? 'No applicants match your filters. Try adjusting or clearing them.'
                        : 'No applicants yet.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((app, rowIdx) => {
                    const name = getApplicantName(app);
                    const email = app.applicant_email || app.student_profile?.email || '';
                    const href = `${basePath}/people/${app.student_id}`;
                    const isSelected = validSelected.has(app.id);

                    return (
                      <TableRow key={app.id} className={isSelected ? 'bg-primary/5' : ''}>
                        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(app.id)}
                            className="h-3.5 w-3.5"
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            type="button"
                            className="text-left w-full"
                            onClick={() => setReviewIndex(rowIdx)}
                          >
                            <div className="font-medium hover:underline underline-offset-2 cursor-pointer">{name}</div>
                            {email && (
                              <div className="text-xs text-muted-foreground break-all">{email}</div>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {app.position?.title || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}>
                            {APPLICATION_STATUS_LABELS[app.status] || app.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {app.submitted_at ? format(new Date(app.submitted_at), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={href}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Open ${name}'s full profile`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Overlay panel on name click */}
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
        </>
      )}

      {/* ── Bulk email dialogs ─────────────────────────────── */}
      {hospitalPage && (
        <>
          <RichEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            hospitalPageId={hospitalPage.id}
            hospitalName={hospitalPage.name || 'ClinicalHours'}
            senderEmail={hospitalPage.gmail_email}
            selectedApplicationIds={selectedApplicationIds}
            applications={applications}
          />
          <InterviewInviteDialog
            open={interviewDialogOpen}
            onOpenChange={(open) => {
              setInterviewDialogOpen(open);
              if (!open) setSelectedIds(new Set());
            }}
            hospitalPageId={hospitalPage.id}
            hospitalName={hospitalPage.name || 'ClinicalHours'}
            bookingUrl={hospitalPage.interview_booking_url || ''}
            selectedApplicationIds={selectedApplicationIds}
            applications={applications}
          />
        </>
      )}
    </div>
  );
}
