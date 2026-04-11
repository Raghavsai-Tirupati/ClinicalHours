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

interface PersonGroup {
  key: string;
  student_id: string | null;
  name: string;
  email: string;
  avatarUrl?: string;
  applications: StudentApplication[];
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
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);

  // Group filtered applications by person (student_id, falling back to email)
  const grouped = useMemo<PersonGroup[]>(() => {
    const q = search.trim().toLowerCase();

    const matching = applications.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (q) {
        const name = getApplicantName(a).toLowerCase();
        const email = (a.applicant_email || a.student_profile?.email || '').toLowerCase();
        const pos = (a.position?.title || '').toLowerCase();
        return name.includes(q) || email.includes(q) || pos.includes(q);
      }
      return true;
    });

    const map = new Map<string, PersonGroup>();
    for (const app of matching) {
      const key = app.student_id || app.applicant_email || app.student_profile?.email || app.id;
      if (!map.has(key)) {
        map.set(key, {
          key,
          student_id: app.student_id || null,
          name: getApplicantName(app),
          email: app.applicant_email || app.student_profile?.email || '',
          avatarUrl: app.student_profile?.avatar_url,
          applications: [],
        });
      }
      map.get(key)!.applications.push(app);
    }

    const groups = [...map.values()];
    // Sort each person's apps newest first, then sort persons by most recent app
    for (const g of groups) {
      g.applications.sort(
        (a, b) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime(),
      );
    }
    groups.sort(
      (a, b) =>
        new Date(b.applications[0]?.submitted_at || 0).getTime() -
        new Date(a.applications[0]?.submitted_at || 0).getTime(),
    );
    return groups;
  }, [applications, search, statusFilter]);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedKeys.size === grouped.length && grouped.length > 0) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(grouped.map((g) => g.key)));
    }
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setSelectedKeys(new Set());
  };
  const handleStatusChange = (v: string) => {
    setStatusFilter(v as ApplicationStatus | 'all');
    setSelectedKeys(new Set());
  };

  // Collect all application IDs from selected persons for bulk actions
  const selectedApplicationIds = useMemo(
    () =>
      grouped
        .filter((g) => selectedKeys.has(g.key))
        .flatMap((g) => g.applications.map((a) => a.id)),
    [grouped, selectedKeys],
  );

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
          {grouped.length} {grouped.length === 1 ? 'profile' : 'profiles'}
        </p>
      </div>

      {/* Bulk action bar */}
      {selectedKeys.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2">
          <span className="text-sm font-medium">{selectedKeys.size} selected</span>
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
              onClick={() => setSelectedKeys(new Set())}
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
                  checked={grouped.length > 0 && selectedKeys.size === grouped.length}
                  onCheckedChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
              </TableHead>
              <TableHead>Person</TableHead>
              <TableHead className="hidden md:table-cell">Applications</TableHead>
              <TableHead className="hidden lg:table-cell">Last Applied</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : grouped.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                  No profiles match your filters yet.
                </TableCell>
              </TableRow>
            ) : (
              grouped.map((person) => {
                const href = person.student_id ? `${basePath}/people/${person.student_id}` : null;
                const avatarColor = emailToColor(person.email || person.name);
                return (
                  <TableRow key={person.key} className="cursor-pointer">
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedKeys.has(person.key)}
                        onCheckedChange={() => toggleSelect(person.key)}
                        className="h-3.5 w-3.5"
                      />
                    </TableCell>

                    {/* Person */}
                    <TableCell>
                      {href ? (
                        <Link to={href} className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            {person.avatarUrl && (
                              <AvatarImage src={person.avatarUrl} alt={person.name} />
                            )}
                            <AvatarFallback className={`text-xs font-semibold text-white ${avatarColor}`}>
                              {getInitials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium hover:underline">{person.name}</div>
                            {person.email && (
                              <div className="text-xs text-muted-foreground break-all">{person.email}</div>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className={`text-xs font-semibold text-white ${avatarColor}`}>
                              {getInitials(person.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium">{person.name}</div>
                            {person.email && (
                              <div className="text-xs text-muted-foreground break-all">{person.email}</div>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>

                    {/* Applications (position + status per app) */}
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                        {person.applications.map((app) => (
                          <div key={app.id} className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">
                              {app.position?.title || '—'}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}
                            >
                              {APPLICATION_STATUS_LABELS[app.status] || app.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </TableCell>

                    {/* Last applied date */}
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {person.applications[0]?.submitted_at
                        ? format(new Date(person.applications[0].submitted_at), 'MMM d, yyyy')
                        : '—'}
                    </TableCell>

                    <TableCell>
                      {href && (
                        <Link
                          to={href}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Open ${person.name}'s profile`}
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
              if (!open) setSelectedKeys(new Set());
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
