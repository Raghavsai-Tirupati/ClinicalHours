import { Fragment, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Mail,
  Calendar,
  BarChart2,
  List,
  Columns3,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import ResponseAnalytics from '@/components/hospital/ResponseAnalytics';
import RichEmailDialog from '@/components/hospital/RichEmailDialog';
import ApplicationFilterBar from '@/components/hospital/ApplicationFilterBar';
import ApplicantReviewPanel from '@/components/hospital/ApplicantReviewPanel';
import ApplicationKanban from '@/components/hospital/ApplicationKanban';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import {
  applyApplicationFilters,
  getApplicantSortName,
  sortApplications,
  type ApplicationFilterRule,
  type SortColumn,
  type SortState,
} from '@/lib/applicationFilters';
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import { useAutoMarkApplicationUnderReview } from '@/hooks/useAutoMarkApplicationUnderReview';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus, type StudentApplication } from '@/types/positions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  under_review: 'bg-yellow-500/15 text-yellow-400',
  interview: 'bg-cyan-500/15 text-cyan-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  waitlisted: 'bg-purple-500/15 text-purple-400',
};

function defaultDirectionFor(column: SortColumn): 'asc' | 'desc' {
  if (column === 'submitted' || column === 'gpa' || column === 'clinical_hours') return 'desc';
  return 'asc';
}

function SortableTh({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: SortColumn;
  label: string;
  sort: SortState;
  onSort: (c: SortColumn) => void;
  className?: string;
}) {
  const active = sort.column === column;
  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors -ml-1 px-1 py-0.5 rounded"
      >
        {label}
        {active ? (
          sort.direction === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-primary" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-primary" />
          )
        ) : (
          <span className="w-3.5 h-3.5 inline-block opacity-0" aria-hidden />
        )}
      </button>
    </TableHead>
  );
}

function ApplicantReviewWhenExpanded({
  application,
  onStatusChange,
  onNoteSaved,
  onApplicationPatched,
}: {
  application: StudentApplication;
  onStatusChange: (appId: string, status: ApplicationStatus) => void | Promise<void>;
  onNoteSaved: () => void;
  onApplicationPatched: (appId: string, patch: Partial<StudentApplication>) => void;
}) {
  const autoReviewing = useAutoMarkApplicationUnderReview(application, true, onApplicationPatched);
  return (
    <ApplicantReviewPanel
      application={application}
      onStatusChange={onStatusChange}
      onNoteSaved={onNoteSaved}
      showHeaderAvatar
      autoReviewing={autoReviewing}
    />
  );
}

interface ApplicationsHubProps {
  /** When true, shows "All Applicants" header for use under Positions tab */
  embeddedInPositions?: boolean;
}

export default function ApplicationsHub({ embeddedInPositions }: ApplicationsHubProps = {}) {
  const navigate = useNavigate();
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, positions, stats, loading, updateApplicationLocally } = useAllApplications(hospitalPage?.id);

  const [activeTab, setActiveTab] = useState<'applications' | 'kanban' | 'analytics'>('applications');
  const [filterRules, setFilterRules] = useState<ApplicationFilterRule[]>([]);
  const [sortState, setSortState] = useState<SortState | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  const effectiveSort: SortState = sortState ?? { column: 'submitted', direction: 'desc' };

  const handleSortClick = useCallback((column: SortColumn) => {
    setSortState((prev) => {
      const current = prev ?? { column: 'submitted', direction: 'desc' };
      if (current.column === column) {
        return { column, direction: current.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: defaultDirectionFor(column) };
    });
  }, []);

  const filtered = useMemo(
    () => applyApplicationFilters(applications, filterRules),
    [applications, filterRules],
  );

  const sorted = useMemo(() => sortApplications(filtered, effectiveSort), [filtered, effectiveSort]);

  const selectedAllVisible = sorted.length > 0 && sorted.every((app) => selectedIds.includes(app.id));

  const selectedRecipientCount = useMemo(() => {
    const emails = new Set<string>();
    for (const app of sorted) {
      if (!selectedIds.includes(app.id)) continue;
      const email = (app.applicant_email || app.student_profile?.email || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails.size;
  }, [sorted, selectedIds]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...sorted.map((a) => a.id)])));
    } else {
      const visibleSet = new Set(sorted.map((a) => a.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    }
  };

  const handleApplicationPatched = useCallback(
    (appId: string, patch: Partial<StudentApplication>) => {
      updateApplicationLocally(appId, patch);
    },
    [updateApplicationLocally],
  );

  const handleStatusChange = useCallback(
    async (appId: string, newStatus: ApplicationStatus) => {
      setUpdatingStatus(true);
      try {
        const { error } = await supabase
          .from('student_applications')
          .update(buildStudentApplicationStatusUpdate(newStatus))
          .eq('id', appId);
        if (error) throw error;
        toast.success(`Application ${APPLICATION_STATUS_LABELS[newStatus].toLowerCase()}`);
        updateApplicationLocally(appId, { status: newStatus });
      } catch {
        toast.error('Failed to update status');
      } finally {
        setUpdatingStatus(false);
      }
    },
    [updateApplicationLocally],
  );

  const handleViewApplicantFromAnalytics = useCallback((applicationId: string) => {
    setActiveTab('applications');
    setExpandedId(applicationId);
    setTimeout(() => {
      document.getElementById(`applicant-row-${applicationId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const handleSendEmail = async () => {
    if (!hospitalPage?.id || selectedIds.length === 0) return;
    if (!emailSubject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!emailBody.trim()) {
      toast.error('Message body is required');
      return;
    }
    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId: hospitalPage.id,
          applicationIds: selectedIds,
          emailType: 'general',
          subject: emailSubject.trim(),
          body: emailBody.trim(),
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      const sent = data?.sent ?? 0;
      if (sent > 0) toast.success(`Email sent to ${sent} applicant${sent === 1 ? '' : 's'}`);
      if (data?.failed > 0) toast.error(`${data.failed} email(s) failed`);
      setEmailDialogOpen(false);
      setEmailSubject('');
      setEmailBody('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setEmailSending(false);
    }
  };

  const handleSendInvites = async () => {
    if (!hospitalPage?.id || selectedIds.length === 0) return;
    setInviteSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId: hospitalPage.id,
          applicationIds: selectedIds,
          customMessage: inviteMessage.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      const sent = data?.sent ?? 0;
      if (sent > 0) toast.success(`Interview invites sent to ${sent} applicant${sent === 1 ? '' : 's'}`);
      if (data?.failed > 0) toast.error(`${data.failed} invite(s) failed`);
      setInviteDialogOpen(false);
      setInviteMessage('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setInviteSending(false);
    }
  };

  const selectedCount = sorted.filter((a) => selectedIds.includes(a.id)).length;

  const toggleExpand = (appId: string) => {
    setExpandedId((id) => (id === appId ? null : appId));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold break-words">{embeddedInPositions ? 'All Applicants' : 'Applications'}</h2>
        <p className="text-sm text-muted-foreground mt-1 break-words text-pretty">
          {embeddedInPositions ? 'Applicants across all positions' : 'All applications across every position'}
        </p>
        <div className="-mx-1 mt-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-border px-1 pb-px [-webkit-overflow-scrolling:touch]">
          <button
            type="button"
            onClick={() => setActiveTab('applications')}
            className={`flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors sm:px-4 ${
              activeTab === 'applications'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <List className="h-4 w-4" />
            Applicants
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('kanban')}
            className={`flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors sm:px-4 ${
              activeTab === 'kanban'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Columns3 className="h-4 w-4" />
            Kanban Board
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors sm:px-4 ${
              activeTab === 'analytics'
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart2 className="h-4 w-4" />
            Response Analytics
          </button>
        </div>
      </div>

      {activeTab === 'analytics' && (
        <ResponseAnalytics applications={applications} onViewApplicant={handleViewApplicantFromAnalytics} />
      )}

      {activeTab === 'kanban' && (
        <ApplicationKanban
          applications={applications}
          onStatusChange={handleStatusChange}
          updateApplicationLocally={updateApplicationLocally}
        />
      )}

      {activeTab === 'applications' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-sm py-1 px-3">
              {stats.total} total
            </Badge>
            <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.new}`}>{stats.new} new</Badge>
            <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.under_review}`}>{stats.underReview} reviewing</Badge>
            <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.interview}`}>{stats.interview} interview</Badge>
            <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.accepted}`}>{stats.accepted} accepted</Badge>
            <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.rejected}`}>{stats.rejected} rejected</Badge>
          </div>

          <ApplicationFilterBar
            hospitalPageId={hospitalPage?.id}
            rules={filterRules}
            onRulesChange={setFilterRules}
            positions={positions}
            applications={applications}
          />

          <p className="text-xs text-muted-foreground text-pretty break-words">
            Showing <span className="text-foreground font-medium">{sorted.length}</span> of {applications.length}{' '}
            applicants after filters. Sort by clicking a column header. Default: newest first.
          </p>

          {selectedCount > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-3 py-3 sm:px-4">
              <Badge variant="outline" className="max-w-full whitespace-normal text-xs leading-snug">
                {selectedCount} selected ({selectedRecipientCount} unique emails)
              </Badge>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEmailDialogOpen(true)}>
                <Mail className="h-3.5 w-3.5" />
                Email
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInviteDialogOpen(true)}>
                <Calendar className="h-3.5 w-3.5" />
                Interview Invite
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          )}

          {sorted.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <List className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  {applications.length === 0
                    ? 'No applications yet. Applications will appear here once students apply.'
                    : 'No applicants match your filters. Adjust or clear filters to see more.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 overflow-hidden">
              <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-border/60">
                      <TableHead className="w-[40px]">
                        <Checkbox
                          checked={selectedAllVisible}
                          onCheckedChange={(c) => toggleSelectAll(!!c)}
                          aria-label="Select all visible"
                        />
                      </TableHead>
                      <TableHead className="w-[36px]" />
                      <SortableTh column="name" label="Applicant" sort={effectiveSort} onSort={handleSortClick} />
                      <SortableTh column="university" label="University" sort={effectiveSort} onSort={handleSortClick} className="max-w-[140px]" />
                      <SortableTh column="position" label="Position" sort={effectiveSort} onSort={handleSortClick} />
                      <SortableTh column="submitted" label="Submitted" sort={effectiveSort} onSort={handleSortClick} />
                      <SortableTh column="status" label="Status" sort={effectiveSort} onSort={handleSortClick} />
                      <SortableTh column="gpa" label="GPA" sort={effectiveSort} onSort={handleSortClick} className="w-[72px]" />
                      <SortableTh
                        column="clinical_hours"
                        label="Clin. h"
                        sort={effectiveSort}
                        onSort={handleSortClick}
                        className="w-[80px]"
                      />
                      <SortableTh column="grad_year" label="Grad yr" sort={effectiveSort} onSort={handleSortClick} className="w-[80px]" />
                      <TableHead className="w-[150px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((app) => (
                      <Fragment key={app.id}>
                        <TableRow
                          id={`applicant-row-${app.id}`}
                          className={`border-border/50 ${expandedId === app.id ? 'bg-muted/25' : ''}`}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedIds.includes(app.id)}
                              onCheckedChange={(c) => toggleSelect(app.id, !!c)}
                              aria-label={`Select ${getApplicantSortName(app)}`}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0"
                              onClick={() => toggleExpand(app.id)}
                              aria-expanded={expandedId === app.id}
                              aria-label={expandedId === app.id ? 'Collapse' : 'Expand applicant'}
                            >
                              {expandedId === app.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <button
                              type="button"
                              className="w-full text-left"
                              onClick={() => toggleExpand(app.id)}
                            >
                              <p className="text-sm font-medium break-words">{getApplicantSortName(app)}</p>
                            </button>
                          </TableCell>
                          <TableCell className="max-w-[140px] text-sm text-muted-foreground">
                            <span className="block break-words leading-snug">{app.student_profile?.university || '—'}</span>
                          </TableCell>
                          <TableCell className="max-w-[180px] text-sm text-muted-foreground">
                            <span className="block break-words leading-snug">{app.position?.title || '—'}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Badge className={`max-w-[140px] whitespace-normal text-xs leading-snug ${STATUS_COLORS[app.status] || ''}`}>
                              {APPLICATION_STATUS_LABELS[app.status]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {typeof app.student_profile?.gpa === 'number' ? app.student_profile.gpa.toFixed(2) : '—'}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {typeof app.student_profile?.clinical_hours === 'number'
                              ? app.student_profile.clinical_hours
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm tabular-nums">
                            {app.student_profile?.graduation_year ?? '—'}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => navigate(`${basePath}/applicants/${app.id}`)}
                                aria-label="Open applicant profile"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                              <Select
                                value={app.status}
                                onValueChange={(v) => handleStatusChange(app.id, v as ApplicationStatus)}
                                disabled={updatingStatus}
                              >
                                <SelectTrigger className="h-8 text-xs ml-auto w-[130px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>
                                      {label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedId === app.id && (
                          <TableRow className="border-border/50 bg-muted/15 hover:bg-muted/15">
                            <TableCell colSpan={11} className="p-0 border-l-2 border-l-primary/40">
                              <div className="max-w-3xl px-3 py-5 sm:px-6">
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                                  Applicant review
                                </p>
                                <ApplicantReviewWhenExpanded
                                  application={app}
                                  onStatusChange={handleStatusChange}
                                  onNoteSaved={() => updateApplicationLocally(app.id, {})}
                                  onApplicationPatched={handleApplicationPatched}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          <RichEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            hospitalPageId={hospitalPage?.id || ''}
            hospitalName={hospitalPage?.opportunity?.name}
            senderEmail={hospitalPage?.gmail_email}
            selectedApplicationIds={selectedIds.filter(id => sorted.some(a => a.id === id))}
            applications={sorted}
          />

          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Interview Invites</DialogTitle>
                <DialogDescription>
                  Send your interview booking link to {selectedCount} selected applicant
                  {selectedCount === 1 ? '' : 's'}.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={5}
                placeholder="Optional custom message..."
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={inviteSending}>
                  Cancel
                </Button>
                <Button onClick={handleSendInvites} disabled={inviteSending} className="gap-1.5">
                  {inviteSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calendar className="h-4 w-4" />}
                  Send Invites
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
