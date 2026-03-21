import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { usePositionApplications } from '@/hooks/usePositionApplications';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import ApplicationDetailSheet from './ApplicationDetailSheet';
import EmailDialog from './EmailDialog';
import InterviewInviteDialog from './InterviewInviteDialog';

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

const normalizeDisplayName = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
};

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  under_review: 'bg-yellow-500/15 text-yellow-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  waitlisted: 'bg-purple-500/15 text-purple-400',
};

interface Props {
  positionId: string;
}

export default function PositionApplicationsTable({ positionId }: Props) {
  const { hospitalPage } = useHospitalPageContext();
  const { applications, allApplications, loading, statusFilter, setStatusFilter, searchTerm, setSearchTerm, sortBy, setSortBy, refetch } =
    usePositionApplications(positionId);

  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [bookingUrlInput, setBookingUrlInput] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  useEffect(() => {
    setBookingUrlInput(hospitalPage?.interview_booking_url || '');
  }, [hospitalPage?.interview_booking_url]);

  const selectedCount = useMemo(
    () => applications.filter((a) => selectedApplicationIds.includes(a.id)).length,
    [applications, selectedApplicationIds],
  );

  const selectedRecipientCount = useMemo(() => {
    const emails = new Set<string>();
    for (const app of applications) {
      if (!selectedApplicationIds.includes(app.id)) continue;
      const email = (app.applicant_email || app.student_profile?.email || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails.size;
  }, [applications, selectedApplicationIds]);

  const selectedAllVisible = applications.length > 0 && applications.every((a) => selectedApplicationIds.includes(a.id));

  const getApplicantName = (app: StudentApplication) =>
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    app.student_profile?.email?.split('@')[0] ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id.slice(0, 8)}`;

  const toggleSelectApp = (id: string, checked: boolean) => {
    setSelectedApplicationIds((prev) => (checked ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  };

  const toggleSelectVisible = (checked: boolean) => {
    if (checked) {
      const ids = applications.map((a) => a.id);
      setSelectedApplicationIds((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      const visible = new Set(applications.map((a) => a.id));
      setSelectedApplicationIds((prev) => prev.filter((id) => !visible.has(id)));
    }
  };

  const handleSaveBookingUrl = async () => {
    if (!hospitalPage?.id) return;
    const value = bookingUrlInput.trim();
    if (value) {
      try {
        const url = new URL(value);
        if (url.protocol !== 'https:' || !url.host) throw new Error();
      } catch {
        toast.error('Enter a valid HTTPS booking URL');
        return;
      }
    }
    setBookingSaving(true);
    try {
      const { error } = await supabase.from('hospital_pages').update({ interview_booking_url: value || null }).eq('id', hospitalPage.id);
      if (error) throw error;
      toast.success('Interview booking link saved');
    } catch {
      toast.error('Failed to save interview booking link');
    } finally {
      setBookingSaving(false);
    }
  };

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('student_applications')
        .update({ status: newStatus, reviewed_at: new Date().toISOString() })
        .eq('id', appId);
      if (error) throw error;
      toast.success(`Application ${APPLICATION_STATUS_LABELS[newStatus].toLowerCase()}`);
      refetch();
      if (selectedApp?.id === appId) setSelectedApp((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const newCount = allApplications.filter((a) => a.status === 'new').length;
  const totalCount = allApplications.length;

  return (
    <>
      <div className="space-y-4">
        {/* Interview Settings — available to all admins */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
          <p className="text-sm font-medium">Interview Booking Link</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={bookingUrlInput}
              onChange={(e) => setBookingUrlInput(e.target.value)}
              placeholder="https://calendly.com/your-org/interviews"
              className="h-9 flex-1"
            />
            <Button size="sm" onClick={handleSaveBookingUrl} disabled={bookingSaving}>
              {bookingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save link'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Save your Calendly / booking link, then select applicants and send interview invites.
          </p>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <span className="font-medium">
            {totalCount} application{totalCount !== 1 ? 's' : ''}
          </span>
          {newCount > 0 && <Badge className="bg-blue-500/15 text-blue-400 text-xs">{newCount} new</Badge>}
          {selectedCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {selectedCount} selected ({selectedRecipientCount} unique)
            </Badge>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" disabled={selectedCount === 0} onClick={() => setEmailDialogOpen(true)}>
              Email selected
            </Button>
            <Button size="sm" variant="outline" disabled={selectedCount === 0} onClick={() => setInviteDialogOpen(true)}>
              Send interview invite
            </Button>
            {selectedCount > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSelectedApplicationIds([])}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ApplicationStatus | 'all')}>
            <SelectTrigger className="w-[150px] h-9">
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
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[220px] h-9">
              <SelectValue placeholder="Sort applications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="submitted_desc">Newest first</SelectItem>
              <SelectItem value="submitted_asc">Oldest first</SelectItem>
              <SelectItem value="gpa_desc">Highest GPA</SelectItem>
              <SelectItem value="clinical_hours_desc">Most clinical hours</SelectItem>
              <SelectItem value="experience_desc">Most relevant experience</SelectItem>
              <SelectItem value="resume_readiness_desc">Strongest resume profile</SelectItem>
              <SelectItem value="name_asc">Applicant name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {sortBy === 'resume_readiness_desc' && (
          <p className="text-xs text-muted-foreground">
            Resume profile ranking considers uploaded resumes, GPA, clinical hours, and experience depth from application responses.
          </p>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-10 border border-border/50 rounded-lg">
            <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">{totalCount === 0 ? 'No applications yet' : 'No matching applications'}</p>
          </div>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={selectedAllVisible} onCheckedChange={(c) => toggleSelectVisible(!!c)} aria-label="Select all visible" />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow key={app.id} className="cursor-pointer" onClick={() => setSelectedApp(allApplications.find((a) => a.id === app.id) || app)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedApplicationIds.includes(app.id)}
                        onCheckedChange={(c) => toggleSelectApp(app.id, !!c)}
                        aria-label={`Select ${getApplicantName(app)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{getApplicantName(app)}</p>
                        {app.student_profile?.university && <p className="text-xs text-muted-foreground">{app.student_profile.university}</p>}
                        <div className="mt-1 flex flex-wrap gap-1">
                          {typeof app.student_profile?.gpa === 'number' && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              GPA {app.student_profile.gpa.toFixed(2)}
                            </Badge>
                          )}
                          {typeof app.student_profile?.clinical_hours === 'number' && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              {app.student_profile.clinical_hours} clinical hrs
                            </Badge>
                          )}
                          {app.student_profile?.resume_url && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              Resume
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(app.submitted_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[app.status]}`}>{APPLICATION_STATUS_LABELS[app.status]}</Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={app.status} onValueChange={(v) => handleStatusChange(app.id, v as ApplicationStatus)} disabled={updatingStatus}>
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
          </div>
        )}
      </div>

      {/* Sub-components */}
      <ApplicationDetailSheet
        application={selectedApp}
        onClose={() => setSelectedApp(null)}
        onStatusChange={handleStatusChange}
        onNoteSaved={refetch}
      />

      {hospitalPage?.id && (
        <>
          <EmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            hospitalPageId={hospitalPage.id}
            selectedApplicationIds={selectedApplicationIds}
            applications={applications}
          />
          <InterviewInviteDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
            hospitalPageId={hospitalPage.id}
            selectedApplicationIds={selectedApplicationIds}
            applications={applications}
          />
        </>
      )}
    </>
  );
}
