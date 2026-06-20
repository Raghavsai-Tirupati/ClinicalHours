import { useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Search, Eye, Loader2, Columns3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminStudentSummary } from '@/lib/analytics/api';
import { AttentionBadge } from './adminStatusBadges';

export interface StudentDirectoryUser {
  summary: AdminStudentSummary;
  email: string;
}

type ColumnKey =
  | 'student'
  | 'status'
  | 'clinic'
  | 'last_active'
  | 'apps'
  | 'interviews'
  | 'eval'
  | 'hours'
  | 'joined';

const DEFAULT_COLUMNS: ColumnKey[] = [
  'student',
  'status',
  'clinic',
  'last_active',
  'apps',
  'interviews',
  'eval',
  'joined',
];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  student: 'Student',
  status: 'Status',
  clinic: 'Clinic',
  last_active: 'Last active',
  apps: 'Applications',
  interviews: 'Interviews',
  eval: 'Avg eval',
  hours: 'Volunteer hrs',
  joined: 'Joined',
};

interface StudentExplorerTableProps {
  students: StudentDirectoryUser[];
  loading?: boolean;
  onSelectStudent: (student: StudentDirectoryUser) => void;
}

type AttentionFilter = 'all' | 'needs_attention' | 'green' | 'yellow' | 'red';

export default function StudentExplorerTable({
  students,
  loading,
  onSelectStudent,
}: StudentExplorerTableProps) {
  const [search, setSearch] = useState('');
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>('all');
  const [clinicFilter, setClinicFilter] = useState('all');
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnKey>>(new Set(DEFAULT_COLUMNS));

  const clinicOptions = useMemo(() => {
    const names = new Set<string>();
    students.forEach((s) => {
      if (s.summary.clinic_names) {
        s.summary.clinic_names.split(', ').forEach((n) => names.add(n));
      }
    });
    return Array.from(names).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter(({ summary, email }) => {
      if (q) {
        const haystack = [summary.full_name, email, summary.university, summary.major, summary.clinic_names]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (attentionFilter === 'needs_attention' && !summary.needs_attention) return false;
      if (attentionFilter !== 'all' && attentionFilter !== 'needs_attention') {
        if (summary.attention_level !== attentionFilter) return false;
      }
      if (clinicFilter !== 'all' && !summary.clinic_names?.includes(clinicFilter)) return false;
      return true;
    });
  }, [students, search, attentionFilter, clinicFilter]);

  const toggleColumn = (key: ColumnKey) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const show = (key: ColumnKey) => visibleColumns.has(key);

  return (
    <Card className="bg-card/80">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">Student explorer</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{filtered.length} shown</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <Columns3 className="h-3.5 w-3.5" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(COLUMN_LABELS) as ColumnKey[]).map((key) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={visibleColumns.has(key)}
                    onCheckedChange={() => toggleColumn(key)}
                  >
                    {COLUMN_LABELS[key]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search name, email, school, clinic…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Select value={attentionFilter} onValueChange={(v) => setAttentionFilter(v as AttentionFilter)}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Attention" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All statuses</SelectItem>
              <SelectItem value="needs_attention" className="text-xs">Needs attention</SelectItem>
              <SelectItem value="green" className="text-xs">Active</SelectItem>
              <SelectItem value="yellow" className="text-xs">Review</SelectItem>
              <SelectItem value="red" className="text-xs">At risk</SelectItem>
            </SelectContent>
          </Select>
          {clinicOptions.length > 0 && (
            <Select value={clinicFilter} onValueChange={setClinicFilter}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Clinic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All clinics</SelectItem>
                {clinicOptions.map((name) => (
                  <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-t overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                {show('student') && <TableHead className="text-xs">Student</TableHead>}
                {show('status') && <TableHead className="text-xs">Status</TableHead>}
                {show('clinic') && <TableHead className="text-xs">Clinic</TableHead>}
                {show('last_active') && <TableHead className="text-xs">Last active</TableHead>}
                {show('apps') && <TableHead className="text-xs text-center">Apps</TableHead>}
                {show('interviews') && <TableHead className="text-xs text-center">Interviews</TableHead>}
                {show('eval') && <TableHead className="text-xs text-center">Eval</TableHead>}
                {show('hours') && <TableHead className="text-xs text-center">Hrs</TableHead>}
                {show('joined') && <TableHead className="text-xs">Joined</TableHead>}
                <TableHead className="text-xs text-right w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-xs text-muted-foreground">
                    No students match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((student) => {
                  const { summary } = student;
                  const lastActive = summary.last_active_at ?? summary.last_login_at;
                  return (
                    <TableRow key={summary.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => onSelectStudent(student)}>
                      {show('student') && (
                        <TableCell className="py-2.5">
                          <p className="text-sm font-medium truncate max-w-[180px]">{summary.full_name ?? 'Unnamed'}</p>
                          <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{student.email}</p>
                        </TableCell>
                      )}
                      {show('status') && (
                        <TableCell><AttentionBadge level={summary.attention_level} /></TableCell>
                      )}
                      {show('clinic') && (
                        <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">
                          {summary.clinic_names ?? '—'}
                        </TableCell>
                      )}
                      {show('last_active') && (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {lastActive ? formatDistanceToNow(new Date(lastActive), { addSuffix: true }) : 'Never'}
                        </TableCell>
                      )}
                      {show('apps') && (
                        <TableCell className="text-xs text-center tabular-nums">
                          {summary.application_count}
                          {summary.pending_applications > 0 && (
                            <span className="text-amber-600 ml-0.5">({summary.pending_applications}p)</span>
                          )}
                        </TableCell>
                      )}
                      {show('interviews') && (
                        <TableCell className="text-xs text-center tabular-nums">{summary.upcoming_interviews}</TableCell>
                      )}
                      {show('eval') && (
                        <TableCell className="text-xs text-center tabular-nums">
                          {summary.avg_evaluation_score != null ? summary.avg_evaluation_score.toFixed(1) : '—'}
                        </TableCell>
                      )}
                      {show('hours') && (
                        <TableCell className="text-xs text-center tabular-nums">{summary.volunteer_hours ?? 0}</TableCell>
                      )}
                      {show('joined') && (
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(summary.joined_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                        </TableCell>
                      )}
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onSelectStudent(student)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
