import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePositionApplications } from '@/hooks/usePositionApplications';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import { format } from 'date-fns';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-700',
  under_review: 'bg-yellow-500/15 text-yellow-700',
  accepted: 'bg-green-500/15 text-green-700',
  rejected: 'bg-red-500/15 text-red-700',
  waitlisted: 'bg-purple-500/15 text-purple-700',
};

interface Props {
  positionId: string;
}

export default function PositionApplicationsTable({ positionId }: Props) {
  const { hospitalPage } = useHospitalPageContext();
  const {
    applications,
    allApplications,
    loading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    refetch,
  } = usePositionApplications(positionId);

  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedApplicationIds, setSelectedApplicationIds] = useState<string[]>([]);
  const [bookingUrlInput, setBookingUrlInput] = useState('');
  const [bookingSaving, setBookingSaving] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const isBcsFreeHealthClinic = (hospitalPage?.opportunity.name || '').toLowerCase().includes('bcs free health clinic');

  useEffect(() => {
    setBookingUrlInput(hospitalPage?.interview_booking_url || '');
  }, [hospitalPage?.interview_booking_url]);

  const selectedCount = useMemo(
    () => applications.filter((app) => selectedApplicationIds.includes(app.id)).length,
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

  const selectedAllVisible = applications.length > 0 && applications.every((app) => selectedApplicationIds.includes(app.id));

  const isValidHttpsUrl = (value: string): boolean => {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !!url.host;
    } catch {
      return false;
    }
  };

  const toggleSelectApp = (id: string, checked: boolean) => {
    setSelectedApplicationIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((existingId) => existingId !== id);
    });
  };

  const toggleSelectVisible = (checked: boolean) => {
    if (checked) {
      const visibleIds = applications.map((app) => app.id);
      setSelectedApplicationIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
      return;
    }
    const visibleSet = new Set(applications.map((app) => app.id));
    setSelectedApplicationIds((prev) => prev.filter((id) => !visibleSet.has(id)));
  };

  const handleSaveBookingUrl = async () => {
    if (!hospitalPage?.id) return;
    const value = bookingUrlInput.trim();
    if (value && !isValidHttpsUrl(value)) {
      toast.error('Enter a valid HTTPS booking URL');
      return;
    }
    setBookingSaving(true);
    try {
      const { error } = await supabase
        .from('hospital_pages')
        .update({ interview_booking_url: value || null })
        .eq('id', hospitalPage.id);
      if (error) throw error;
      toast.success('Interview booking link saved');
    } catch {
      toast.error('Failed to save interview booking link');
    } finally {
      setBookingSaving(false);
    }
  };

  const handleSendInterviewInvites = async () => {
    if (!hospitalPage?.id) return;
    if (selectedApplicationIds.length === 0) {
      toast.error('Select at least one applicant first');
      return;
    }
    setInviteSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId: hospitalPage.id,
          applicationIds: selectedApplicationIds,
          customMessage: inviteMessage.trim() || undefined,
        },
      });
      if (error) throw new Error(error.message || 'Failed to send interview invites');
      if (!data?.success) throw new Error(data?.error || 'Failed to send interview invites');
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      if (sent > 0) {
        toast.success(`Interview invites sent to ${sent} applicant${sent === 1 ? '' : 's'}`);
      } else {
        toast.info('No invites were sent');
      }
      if (failed > 0) {
        toast.error(`${failed} invite${failed === 1 ? '' : 's'} failed`);
      }
      setInviteDialogOpen(false);
      setInviteMessage('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send interview invites';
      toast.error(message);
    } finally {
      setInviteSending(false);
    }
  };

  const handleSendGeneralEmail = async () => {
    if (!hospitalPage?.id) return;
    if (selectedApplicationIds.length === 0) {
      toast.error('Select at least one applicant first');
      return;
    }
    if (!emailSubject.trim()) {
      toast.error('Email subject is required');
      return;
    }
    if (!emailBody.trim()) {
      toast.error('Email body is required');
      return;
    }
    setEmailSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId: hospitalPage.id,
          applicationIds: selectedApplicationIds,
          emailType: 'general',
          subject: emailSubject.trim(),
          body: emailBody.trim(),
        },
      });
      if (error) throw new Error(error.message || 'Failed to send emails');
      if (!data?.success) throw new Error(data?.error || 'Failed to send emails');
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      if (sent > 0) {
        toast.success(`Email sent to ${sent} applicant${sent === 1 ? '' : 's'}`);
      } else {
        toast.info('No emails were sent');
      }
      if (failed > 0) {
        toast.error(`${failed} email${failed === 1 ? '' : 's'} failed`);
      }
      setEmailDialogOpen(false);
      setEmailSubject('');
      setEmailBody('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send emails';
      toast.error(message);
    } finally {
      setEmailSending(false);
    }
  };
  const getApplicantName = (app: StudentApplication) =>
    app.applicant_name?.trim() ||
    app.student_profile?.full_name?.trim() ||
    app.applicant_email?.split('@')[0] ||
    'Applicant';

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('student_applications')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', appId);

      if (error) throw error;
      toast.success(`Application ${APPLICATION_STATUS_LABELS[newStatus].toLowerCase()}`);
      refetch();
      if (selectedApp?.id === appId) {
        setSelectedApp((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Stats
  const newCount = allApplications.filter((a) => a.status === 'new').length;
  const totalCount = allApplications.length;

  return (
    <>
      <div className="space-y-4">
        {isBcsFreeHealthClinic && (
          <div className="rounded-lg border p-4 space-y-3">
            <p className="font-medium text-sm">Interview Settings (BCS only)</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={bookingUrlInput}
                onChange={(e) => setBookingUrlInput(e.target.value)}
                placeholder="https://calendly.com/your-clinic/interviews"
              />
              <Button onClick={handleSaveBookingUrl} disabled={bookingSaving}>
                {bookingSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save link'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Save your Calendly link once, then select applicants and send interview invites.
            </p>
          </div>
        )}

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <span className="font-medium">{totalCount} application{totalCount !== 1 ? 's' : ''}</span>
          {newCount > 0 && (
            <Badge className="bg-blue-500/15 text-blue-700 text-xs">{newCount} new</Badge>
          )}
          {selectedCount > 0 && (
            <Badge variant="outline" className="text-xs">
              {selectedCount} selected ({selectedRecipientCount} unique emails)
            </Badge>
          )}
          <Button size="sm" variant="outline" disabled={selectedCount === 0} onClick={() => setEmailDialogOpen(true)}>
            Email selected applicants
          </Button>
          {isBcsFreeHealthClinic && (
            <Button size="sm" variant="outline" disabled={selectedCount === 0} onClick={() => setInviteDialogOpen(true)}>
              Send interview invite
            </Button>
          )}
          {selectedCount > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelectedApplicationIds([])}>
              Clear selection
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ApplicationStatus | 'all')}
          >
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-10 border rounded-lg">
            <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {totalCount === 0 ? 'No applications yet' : 'No matching applications'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedAllVisible}
                      onCheckedChange={(checked) => toggleSelectVisible(!!checked)}
                      aria-label="Select all visible applications"
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow
                    key={app.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedApp(app)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedApplicationIds.includes(app.id)}
                        onCheckedChange={(checked) => toggleSelectApp(app.id, !!checked)}
                        aria-label={`Select ${getApplicantName(app)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {getApplicantName(app)}
                        </p>
                        {app.student_profile?.university && (
                          <p className="text-xs text-muted-foreground">
                            {app.student_profile.university}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[app.status]}`}>
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
                            <SelectItem key={key} value={key}>{label}</SelectItem>
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

      <Dialog open={isBcsFreeHealthClinic ? inviteDialogOpen : false} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Interview Invites</DialogTitle>
            <DialogDescription>
              Sends your interview booking link to the selected applicants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {selectedCount} selected application{selectedCount === 1 ? '' : 's'} ({selectedRecipientCount} unique email{selectedRecipientCount === 1 ? '' : 's'}).
            </p>
            <Textarea
              value={inviteMessage}
              onChange={(e) => setInviteMessage(e.target.value)}
              rows={5}
              placeholder="Optional custom message..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={inviteSending}>Cancel</Button>
            <Button onClick={handleSendInterviewInvites} disabled={inviteSending}>
              {inviteSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invites'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Applicants</DialogTitle>
            <DialogDescription>
              Send an email to the selected applicants.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {selectedCount} selected application{selectedCount === 1 ? '' : 's'} ({selectedRecipientCount} unique email{selectedRecipientCount === 1 ? '' : 's'}).
            </p>
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
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSending}>Cancel</Button>
            <Button onClick={handleSendGeneralEmail} disabled={emailSending}>
              {emailSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Email'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Application Detail Sheet */}
      <Sheet open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedApp && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {getApplicantName(selectedApp)}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Status</p>
                  <Select
                    value={selectedApp.status}
                    onValueChange={(v) => handleStatusChange(selectedApp.id, v as ApplicationStatus)}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedApp.submitted_at), 'MMMM d, yyyy h:mm a')}
                  </p>
                </div>

                {(selectedApp.applicant_email || selectedApp.student_profile?.email) && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedApp.applicant_email || selectedApp.student_profile?.email}
                    </p>
                  </div>
                )}

                {selectedApp.student_profile && (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-medium">Student Info</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedApp.student_profile.university && (
                        <>
                          <span className="text-muted-foreground">University</span>
                          <span>{selectedApp.student_profile.university}</span>
                        </>
                      )}
                      {selectedApp.student_profile.major && (
                        <>
                          <span className="text-muted-foreground">Major</span>
                          <span>{selectedApp.student_profile.major}</span>
                        </>
                      )}
                      {selectedApp.student_profile.graduation_year && (
                        <>
                          <span className="text-muted-foreground">Graduation Year</span>
                          <span>{selectedApp.student_profile.graduation_year}</span>
                        </>
                      )}
                    </div>
                    {selectedApp.student_profile.resume_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedApp.student_profile.resume_url} target="_blank" rel="noopener noreferrer">
                          View Resume
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {selectedApp.notes && (
                  <div className="space-y-1 border-t pt-4">
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{selectedApp.notes}</p>
                  </div>
                )}

                <div className="space-y-2 border-t pt-4">
                  <p className="text-sm font-medium">Application Details</p>
                  {selectedApp.answers && selectedApp.answers.length > 0 ? (
                    <div className="space-y-3">
                      {selectedApp.answers
                        .slice()
                        .sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0))
                        .map((ans) => (
                          <div key={ans.id} className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {ans.question?.question_text || 'Question'}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">
                              {ans.answer_text?.trim() || '—'}
                            </p>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No application answers were saved.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
