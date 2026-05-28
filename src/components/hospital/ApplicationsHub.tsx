import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ExternalLink, Mail, X } from 'lucide-react';
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
import ApplicantReviewPanel from './ApplicantReviewPanel';
import RichEmailDialog from './RichEmailDialog';
import InterviewInviteDialog from './InterviewInviteDialog';
import { normalizeDisplayName } from '@/lib/validation';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  under_review: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  interview: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  waitlisted: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

function getApplicantName(app: StudentApplication): string {
  return (
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    app.student_profile?.email?.split('@')[0] ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id?.slice(0, 8) || ''}`
  );
}

export default function ApplicationsHub() {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, positions, loading, updateApplicationLocally } = useAllApplications(hospitalPage?.id);

  const [filterRules, setFilterRules] = useState<ApplicationFilterRule[]>([]);
  const [sort] = useState<SortState | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null);

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

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    const update = buildStudentApplicationStatusUpdate(newStatus);
    updateApplicationLocally(appId, update);
    setSelectedApp((prev) => (prev?.id === appId ? { ...prev, ...update } : prev));

    const app = applications.find((a) => a.id === appId);
    const isLegacy = (app as any)?._isLegacy === true;
    const table = isLegacy ? 'hospital_applications' : 'student_applications';

    // Legacy apps use different status strings — map back from StudentApplication enum
    const legacyStatusMap: Record<ApplicationStatus, string> = {
      new: 'submitted',
      under_review: 'in_review',
      accepted: 'accepted',
      rejected: 'rejected',
      waitlisted: 'submitted',
      interview: 'in_review',
    };
    const payload = isLegacy ? { status: legacyStatusMap[newStatus] ?? 'submitted' } : update;

    const { error } = await supabase.from(table as any).update(payload).eq('id', appId);
    if (error) toast.error('Failed to update status');
  };

  const panelOpen = !!selectedApp;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Applicants</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Click a row to review their application. Use checkboxes to bulk-select for email or interview invites.
        </p>
      </div>

      <ApplicationFilterBar
        hospitalPageId={hospitalPage?.id}
        rules={filterRules}
        onRulesChange={setFilterRules}
        positions={positions}
        applications={applications}
      />

      {validSelected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2">
          <span className="text-sm font-medium">{validSelected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setEmailDialogOpen(true)} className="gap-1.5">
              <Mail className="h-4 w-4" />Send Email
            </Button>
            <Button size="sm" variant="outline" onClick={() => setInterviewDialogOpen(true)}
              className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10">
              <CalendarCheck className="h-4 w-4" />Send Interview Invite
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} className="text-xs">Clear</Button>
          </div>
        </div>
      )}

      {!loading && (
        <p className="text-xs text-muted-foreground -mt-2">
          {filtered.length} {filtered.length === 1 ? 'applicant' : 'applicants'}
          {filterRules.length > 0 && ` (filtered from ${applications.length})`}
        </p>
      )}

      {/* Split view: table left, panel right */}
      <div className={`flex gap-0 rounded-lg border border-border/40 overflow-hidden ${panelOpen ? 'items-start' : ''}`}>

        {/* Table — shrinks when panel is open */}
        <div className={`overflow-x-auto transition-all duration-200 ${panelOpen ? 'w-[25%] min-w-[200px] border-r border-border/40' : 'w-full'}`}>
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
                <TableHead>Applicant</TableHead>
                {!panelOpen && <TableHead className="hidden md:table-cell">Position</TableHead>}
                <TableHead>Status</TableHead>
                {!panelOpen && <TableHead className="hidden lg:table-cell">Submitted</TableHead>}
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                    {filterRules.length > 0 ? 'No applicants match your filters.' : 'No applicants yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((app) => {
                  const name = getApplicantName(app);
                  const email = app.applicant_email || app.student_profile?.email || '';
                  const position = app.position?.title;
                  const href = `${basePath}/people/${app.student_id}`;
                  const isSelected = validSelected.has(app.id);
                  const isActive = selectedApp?.id === app.id;

                  return (
                    <TableRow
                      key={app.id}
                      className={`cursor-pointer transition-colors ${isActive ? 'bg-primary/10' : isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                      onClick={() => setSelectedApp(isActive ? null : app)}
                    >
                      <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(app.id)} className="h-3.5 w-3.5" />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        {position && <div className="text-xs text-muted-foreground mt-0.5">{position}</div>}
                        {email && !panelOpen && <div className="text-xs text-muted-foreground/60 break-all">{email}</div>}
                      </TableCell>
                      {!panelOpen && (
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {position || '—'}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}>
                          {APPLICATION_STATUS_LABELS[app.status] || app.status}
                        </Badge>
                      </TableCell>
                      {!panelOpen && (
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                          {app.submitted_at ? format(new Date(app.submitted_at), 'MMM d, yyyy') : '—'}
                        </TableCell>
                      )}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Link to={href} className="text-muted-foreground hover:text-foreground" aria-label={`Full profile for ${name}`}>
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

        {/* Side panel */}
        {panelOpen && (
          <div className="flex-1 overflow-y-auto p-5 relative">
            <button
              type="button"
              onClick={() => setSelectedApp(null)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              aria-label="Close panel"
            >
              <X className="h-4 w-4" />
            </button>
            <ApplicantReviewPanel
              application={selectedApp!}
              onStatusChange={handleStatusChange}
              onNoteSaved={() => {}}
              showHeaderAvatar
            />
          </div>
        )}
      </div>

      {hospitalPage && (
        <>
          <RichEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            hospitalPageId={hospitalPage.id}
hospitalName={hospitalPage.opportunity?.name || 'ClinicalHours'}
            senderEmail={hospitalPage.gmail_email}
            selectedApplicationIds={selectedApplicationIds}
            applications={applications}
          />
          <InterviewInviteDialog
            open={interviewDialogOpen}
            onOpenChange={(open) => { setInterviewDialogOpen(open); if (!open) setSelectedIds(new Set()); }}
            hospitalPageId={hospitalPage.id}
            hospitalName={hospitalPage.opportunity?.name || 'ClinicalHours'}
            bookingUrl={hospitalPage.interview_booking_url || ''}
            selectedApplicationIds={selectedApplicationIds}
            applications={applications}
          />
        </>
      )}
    </div>
  );
}
