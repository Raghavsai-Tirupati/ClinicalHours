import { useState, useMemo, useCallback } from 'react';
import { Search, User, Filter, Loader2, Mail, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { APPLICATION_STATUS_LABELS, POSITION_TYPE_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import ApplicationDetailSheet from '@/components/hospital/ApplicationDetailSheet';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  under_review: 'bg-yellow-500/15 text-yellow-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  waitlisted: 'bg-purple-500/15 text-purple-400',
};

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
}

function getApplicantName(app: StudentApplication): string {
  return (
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id.slice(0, 8)}`
  );
}

type SortOption = 'newest' | 'oldest' | 'name_asc';

export default function ApplicationsHub() {
  const { hospitalPage } = useHospitalPageContext();
  const { applications, positions, stats, loading, refetch } = useAllApplications(hospitalPage?.id);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSending, setInviteSending] = useState(false);

  const filtered = useMemo(() => {
    let list = [...applications];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((app) => getApplicantName(app).toLowerCase().includes(q));
    }
    if (statusFilter !== 'all') {
      list = list.filter((app) => app.status === statusFilter);
    }
    if (positionFilter !== 'all') {
      list = list.filter((app) => app.position_id === positionFilter);
    }

    switch (sortBy) {
      case 'oldest':
        list.sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
        break;
      case 'name_asc':
        list.sort((a, b) => getApplicantName(a).localeCompare(getApplicantName(b)));
        break;
      default:
        list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    }
    return list;
  }, [applications, search, statusFilter, positionFilter, sortBy]);

  const selectedAllVisible =
    filtered.length > 0 && filtered.every((app) => selectedIds.includes(app.id));

  const selectedRecipientCount = useMemo(() => {
    const emails = new Set<string>();
    for (const app of filtered) {
      if (!selectedIds.includes(app.id)) continue;
      const email = (app.applicant_email || app.student_profile?.email || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails.size;
  }, [filtered, selectedIds]);

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => (checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((a) => a.id)])));
    } else {
      const visibleSet = new Set(filtered.map((a) => a.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    }
  };

  const handleStatusChange = useCallback(
    async (appId: string, newStatus: ApplicationStatus) => {
      setUpdatingStatus(true);
      try {
        const { error } = await supabase
          .from('student_applications')
          .update({ status: newStatus, reviewed_at: new Date().toISOString() })
          .eq('id', appId);
        if (error) throw error;
        toast.success(`Application ${APPLICATION_STATUS_LABELS[newStatus].toLowerCase()}`);
        refetch();
        if (selectedApp?.id === appId) {
          setSelectedApp((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
      } catch {
        toast.error('Failed to update status');
      } finally {
        setUpdatingStatus(false);
      }
    },
    [refetch, selectedApp?.id],
  );

  const handleSendEmail = async () => {
    if (!hospitalPage?.id || selectedIds.length === 0) return;
    if (!emailSubject.trim()) { toast.error('Subject is required'); return; }
    if (!emailBody.trim()) { toast.error('Message body is required'); return; }
    setEmailSending(true);
    try {
      // BACKEND: Email delivery requires verified Resend domain. Edge function is wired correctly.
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

  const selectedCount = filtered.filter((a) => selectedIds.includes(a.id)).length;

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
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Applications</h2>
        <p className="text-sm text-muted-foreground mt-1">
          All applications across every position
        </p>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="outline" className="text-sm py-1 px-3">
          {stats.total} total
        </Badge>
        <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.new}`}>{stats.new} new</Badge>
        <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.under_review}`}>
          {stats.underReview} reviewing
        </Badge>
        <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.accepted}`}>
          {stats.accepted} accepted
        </Badge>
        <Badge className={`text-sm py-1 px-3 ${STATUS_COLORS.rejected}`}>
          {stats.rejected} rejected
        </Badge>
      </div>

      {/* Filters */}
      <Card className="border-border/50 bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ApplicationStatus | 'all')}
            >
              <SelectTrigger className="w-[150px] h-9">
                <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue placeholder="All positions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All positions</SelectItem>
                {positions.map((pos) => (
                  <SelectItem key={pos.id} value={pos.id}>
                    {pos.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="name_asc">Name A–Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Bulk actions */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
          <Badge variant="outline" className="text-xs">
            {selectedCount} selected ({selectedRecipientCount} unique emails)
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setEmailDialogOpen(true)}
          >
            <Mail className="h-3.5 w-3.5" />
            Email
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => setInviteDialogOpen(true)}
          >
            <Calendar className="h-3.5 w-3.5" />
            Interview Invite
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <User className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">
              {applications.length === 0
                ? 'No applications yet. Applications will appear here once students apply.'
                : 'No applications match your filters.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={selectedAllVisible}
                    onCheckedChange={(c) => toggleSelectAll(!!c)}
                    aria-label="Select all visible"
                  />
                </TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[160px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((app) => (
                <TableRow
                  key={app.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedApp(app)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(app.id)}
                      onCheckedChange={(c) => toggleSelect(app.id, !!c)}
                      aria-label={`Select ${getApplicantName(app)}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{getApplicantName(app)}</p>
                      {app.student_profile?.university && (
                        <p className="text-xs text-muted-foreground">
                          {app.student_profile.university}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground truncate max-w-[180px]">
                      {app.position?.title || '—'}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs ${STATUS_COLORS[app.status] || ''}`}>
                      {APPLICATION_STATUS_LABELS[app.status]}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={app.status}
                      onValueChange={(v) => handleStatusChange(app.id, v as ApplicationStatus)}
                      disabled={updatingStatus}
                    >
                      <SelectTrigger className="h-8 text-xs">
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Application Detail Sheet */}
      <ApplicationDetailSheet
        application={selectedApp}
        onClose={() => setSelectedApp(null)}
        onStatusChange={handleStatusChange}
        onNoteSaved={refetch}
      />

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Applicants</DialogTitle>
            <DialogDescription>
              Send an email to {selectedCount} selected applicant
              {selectedCount === 1 ? '' : 's'} ({selectedRecipientCount} unique email
              {selectedRecipientCount === 1 ? '' : 's'}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject"
            />
            <Textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
              placeholder="Write your message..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
              disabled={emailSending}
            >
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={emailSending} className="gap-1.5">
              {emailSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interview Invite Dialog */}
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
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
              disabled={inviteSending}
            >
              Cancel
            </Button>
            <Button onClick={handleSendInvites} disabled={inviteSending} className="gap-1.5">
              {inviteSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="h-4 w-4" />
              )}
              Send Invites
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
