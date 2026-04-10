import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, LayoutList, Search, Table2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type StudentApplication,
} from '@/types/positions';
import ApplicationDetailSheet from '@/components/hospital/ApplicationDetailSheet';

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
  const { applications, loading, updateApplicationLocally } = useAllApplications(hospitalPage?.id);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | 'all'>('all');
  const [applicationView, setApplicationView] = useState(false);
  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null);

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

  const handleStatusChange = useCallback(
    async (appId: string, newStatus: ApplicationStatus) => {
      const update = buildStudentApplicationStatusUpdate(newStatus);
      updateApplicationLocally(appId, update);
      if (selectedApp?.id === appId) {
        setSelectedApp((prev) => prev ? { ...prev, ...update } : null);
      }
      const { error } = await supabase
        .from('student_applications')
        .update(update)
        .eq('id', appId);
      if (error) {
        toast.error('Failed to update status');
      }
    },
    [selectedApp, updateApplicationLocally],
  );

  const handleApplicationPatched = useCallback(
    (appId: string, patch: Partial<StudentApplication>) => {
      updateApplicationLocally(appId, patch);
      if (selectedApp?.id === appId) {
        setSelectedApp((prev) => prev ? { ...prev, ...patch } : null);
      }
    },
    [selectedApp, updateApplicationLocally],
  );

  const handleRowClick = useCallback(
    (app: StudentApplication) => {
      if (applicationView) {
        setSelectedApp(app);
      }
    },
    [applicationView],
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Applicants</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {applicationView
            ? 'Click any row to open their profile in a side panel.'
            : 'Click any name to open their full profile and review answers, files, notes, and membership status.'}
        </p>
      </div>

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
        <Button
          variant={applicationView ? 'default' : 'outline'}
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => {
            setApplicationView((v) => !v);
            setSelectedApp(null);
          }}
        >
          {applicationView ? (
            <><Table2 className="h-4 w-4" />Table view</>
          ) : (
            <><LayoutList className="h-4 w-4" />Application view</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} {filtered.length === 1 ? 'applicant' : 'applicants'}
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
              {!applicationView && <TableHead className="w-10"></TableHead>}
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
                <TableCell
                  colSpan={5}
                  className="text-center text-sm text-muted-foreground py-10"
                >
                  No applicants match your filters yet.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((app) => {
                const name = getApplicantName(app);
                const email = app.applicant_email || app.student_profile?.email || '';
                const href = `${basePath}/people/${app.student_id}`;
                const isSelected = selectedApp?.id === app.id;

                if (applicationView) {
                  return (
                    <TableRow
                      key={app.id}
                      className={`cursor-pointer transition-colors ${isSelected ? 'bg-muted/60' : 'hover:bg-muted/30'}`}
                      onClick={() => handleRowClick(app)}
                    >
                      <TableCell>
                        <div className="font-medium">{name}</div>
                        {email && (
                          <div className="text-xs text-muted-foreground break-all">
                            {email}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">
                        {app.position?.title || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}
                        >
                          {APPLICATION_STATUS_LABELS[app.status] || app.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                        {app.submitted_at
                          ? format(new Date(app.submitted_at), 'MMM d, yyyy')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                }

                return (
                  <TableRow key={app.id}>
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

      <ApplicationDetailSheet
        application={selectedApp}
        onClose={() => setSelectedApp(null)}
        onStatusChange={handleStatusChange}
        onNoteSaved={() => {}}
        onApplicationPatched={handleApplicationPatched}
      />
    </div>
  );
}
