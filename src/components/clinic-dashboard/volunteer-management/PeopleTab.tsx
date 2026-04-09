import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { format } from 'date-fns';

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

// People = anyone who has ever applied (any status). Click a row to open
// their full profile in the existing /applicants/:id route.
export default function PeopleTab({ clinicId: _clinicId }: PeopleTabProps) {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, loading } = useAllApplications(hospitalPage?.id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, position…"
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as ApplicationStatus | 'all')}
        >
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
          {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
        </p>
      </div>

      <div className="rounded-lg border border-border/40 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                  No people match your filters yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((app) => {
                const name = getApplicantName(app);
                const email = app.applicant_email || app.student_profile?.email || '';
                const href = `${basePath}/applicants/${app.id}`;
                return (
                  <TableRow key={app.id} className="cursor-pointer">
                    <TableCell>
                      <Link to={href} className="block">
                        <div className="font-medium hover:underline">{name}</div>
                        {email && (
                          <div className="text-xs text-muted-foreground break-all">
                            {email}
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      <Link to={href} className="block">
                        {app.position?.title || '—'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link to={href} className="block">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}
                        >
                          {APPLICATION_STATUS_LABELS[app.status] || app.status}
                        </Badge>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      <Link to={href} className="block">
                        {app.submitted_at
                          ? format(new Date(app.submitted_at), 'MMM d, yyyy')
                          : '—'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={href}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Open ${name}'s profile`}
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
    </div>
  );
}
