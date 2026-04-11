import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, ExternalLink, Mail, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAllApplications } from '@/hooks/useAllApplications';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import RichEmailDialog from '@/components/hospital/RichEmailDialog';
import InterviewInviteDialog from '@/components/hospital/InterviewInviteDialog';
import { format } from 'date-fns';

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
] as const;

function emailToColor(email: string): string {
  const hash = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

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
  const candidates = [
    app.applicant_name,
    app.student_profile?.full_name,
  ];
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

interface PeopleTabProps {
  clinicId: string;
}

export default function PeopleTab({ clinicId: _clinicId }: PeopleTabProps) {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, loading } = useAllApplications(hospitalPage?.id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');

  // ── Selection & Bulk Actions ──────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return applications
      .filter((a) => statusFilter === 'all' || a.status === statusFilter)
      .filter((a) => {
        if (!q) return true;
        const name = getApplicantName(a).toLowerCase();
        const email = (a.applicant_email || a.student_profile?.email || '').toLowerCase();
        const pos = (a.position?.title || '').toLowerCase();
        return name.includes(q) || email.includes(q) || pos.includes(q);
      })
      .sort(
        (a, b) =>
          new Date(b.submitted_at || 0).getTime() -
          new Date(a.submitted_at || 0).getTime(),
      );
  }, [applications, search, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a) => a.id)));
    }
  };

  // Clear selection when filters change
  const handleSearchChange = (v: string) => {
    setSearch(v);
    setSelectedIds(new Set());
  };
  const handleStatusChange = (v: string) => {
    setStatusFilter(v as ApplicationStatus | 'all');
    setSelectedIds(new Set());
  };

  const selectedApplicationIds = useMemo(() => [...selectedIds], [selectedIds]);

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email, position…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-44">
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
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} {filtered.length === 1 ? 'application' : 'applications'}
        </p>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEmailDialogOpen(true)}
              className="gap-1.5"
            >
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
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs"
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onCheckedChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Position</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden lg:table-cell">Submitted</TableHead>
              <TableHead className="w-10"></TableHead>
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
                  No people match your filters yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((app) => {
                const name = getApplicantName(app);
                const email = app.applicant_email || app.student_profile?.email || '';
                const href = app.student_id ? `${basePath}/people/${app.student_id}` : null;
                return (
                  <TableRow key={app.id} className="cursor-pointer">
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(app.id)}
                        onCheckedChange={() => toggleSelect(app.id)}
                        className="h-3.5 w-3.5"
                      />
                    </TableCell>
                    <TableCell>
                      {href ? (
                        <Link to={href} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            {app.student_profile?.avatar_url && (
                              <AvatarImage src={app.student_profile.avatar_url} alt={name} />
                            )}
                            <AvatarFallback
                              className={`text-xs font-semibold text-white ${emailToColor(email || name)}`}
                            >
                              {getInitials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium hover:underline">{name}</div>
                            {email && (
                              <div className="text-xs text-muted-foreground break-all">{email}</div>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback
                              className={`text-xs font-semibold text-white ${emailToColor(email || name)}`}
                            >
                              {getInitials(name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium">{name}</div>
                            {email && (
                              <div className="text-xs text-muted-foreground break-all">{email}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {href ? (
                        <Link to={href} className="block">{app.position?.title || '—'}</Link>
                      ) : (
                        <span>{app.position?.title || '—'}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {href ? (
                        <Link to={href} className="block">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}>
                            {APPLICATION_STATUS_LABELS[app.status] || app.status}
                          </Badge>
                        </Link>
                      ) : (
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}>
                          {APPLICATION_STATUS_LABELS[app.status] || app.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {app.submitted_at ? format(new Date(app.submitted_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell>
                      {href && (
                        <Link
                          to={href}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Open ${name}'s profile`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Email Dialog */}
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
            onOpenChange={(open) => {
              setInterviewDialogOpen(open);
              if (!open) setSelectedIds(new Set());
            }}
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
