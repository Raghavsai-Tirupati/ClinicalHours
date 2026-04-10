import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, FileText, TrendingUp, Plus, ArrowRight, Clock, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { APPLICATION_STATUS_LABELS, POSITION_TYPE_LABELS } from '@/types/positions';
import type { ApplicationStatus, PositionStatus, StudentApplication } from '@/types/positions';
import { format } from 'date-fns';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  under_review: 'bg-yellow-500/15 text-yellow-400',
  interview: 'bg-amber-500/15 text-amber-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  waitlisted: 'bg-purple-500/15 text-purple-400',
};

const POSITION_STATUS_COLORS: Record<PositionStatus, string> = {
  active: 'bg-green-500/15 text-green-400',
  draft: 'bg-muted text-muted-foreground',
  paused: 'bg-yellow-500/15 text-yellow-400',
  closed: 'bg-red-500/15 text-red-400',
  archived: 'bg-muted text-muted-foreground opacity-60',
};

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

function getApplicantName(app: StudentApplication): string {
  if (app.applicant_name?.trim() && !PLACEHOLDER_NAME_REGEX.test(app.applicant_name.trim())) {
    return app.applicant_name.trim();
  }
  if (app.student_profile?.full_name?.trim()) {
    return app.student_profile.full_name.trim();
  }
  if (app.applicant_email) {
    return app.applicant_email.split('@')[0];
  }
  return `Student ${app.student_id.slice(0, 8)}`;
}

export default function HospitalOverview() {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, positions, stats, loading } = useAllApplications(hospitalPage?.id);
  const [positionStatusFilter, setPositionStatusFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');
  const [appSearch, setAppSearch] = useState('');
  const [appStatusFilter, setAppStatusFilter] = useState<ApplicationStatus | 'all'>('all');

  const filteredPositions = positions.filter((position) => {
    if (positionStatusFilter === 'all') return true;
    return position.status === positionStatusFilter;
  });

  const filteredApps = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    return applications
      .filter((a) => appStatusFilter === 'all' || a.status === appStatusFilter)
      .filter((a) => {
        if (!q) return true;
        const name = getApplicantName(a).toLowerCase();
        const email = (a.applicant_email || a.student_profile?.email || '').toLowerCase();
        const pos = (a.position?.title || '').toLowerCase();
        return name.includes(q) || email.includes(q) || pos.includes(q);
      });
  }, [applications, appSearch, appStatusFilter]);

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight break-words">Overview</h1>
          <p className="text-muted-foreground text-sm mt-1 text-pretty break-words">
            Manage incoming applications
          </p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link to={`${basePath}/positions/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Position
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Applications
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                <FileText className="h-4 w-4 text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {positions.length} position{positions.length !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                New Applications
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/15">
                <Clock className="h-4 w-4 text-yellow-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.new}</div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Under Review
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
                <TrendingUp className="h-4 w-4 text-amber-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.underReview}</div>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Accepted
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
                <Users className="h-4 w-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.accepted}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.acceptanceRate}% acceptance rate
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Applications — primary content */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>
              Applications
              {!loading && (
                <span className="ml-2 text-base font-normal text-muted-foreground">
                  ({filteredApps.length}{appStatusFilter !== 'all' || appSearch ? ` of ${applications.length}` : ''})
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1 text-pretty break-words">
              All submissions across every position
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search + filter controls */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by name, email, or position…"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={appStatusFilter}
              onValueChange={(value) => setAppStatusFilter(value as ApplicationStatus | 'all')}
            >
              <SelectTrigger className="h-10 sm:w-[170px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {(Object.entries(APPLICATION_STATUS_LABELS) as [ApplicationStatus, string][]).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
                  <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                  <Skeleton className="h-4 flex-1 max-w-[160px]" />
                  <Skeleton className="h-4 flex-1 max-w-[120px]" />
                  <Skeleton className="h-5 w-20 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">
                {applications.length === 0 ? 'No applications yet' : 'No applications match your filters'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {applications.length === 0
                  ? 'Applications will appear here once students apply'
                  : 'Try adjusting your search or status filter'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="pb-2 pr-4 text-left font-medium">Name</th>
                    <th className="pb-2 pr-4 text-left font-medium hidden sm:table-cell">Position</th>
                    <th className="pb-2 pr-4 text-left font-medium">Status</th>
                    <th className="pb-2 pr-4 text-left font-medium hidden md:table-cell">Date Applied</th>
                    <th className="pb-2 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredApps.map((app) => {
                    const displayName = getApplicantName(app);
                    const positionTitle = app.position?.title || 'Unknown Position';
                    return (
                      <tr key={app.id} className="group hover:bg-muted/30 transition-colors">
                        <td className="py-3 pr-4">
                          <Link
                            to={`${basePath}/applicants/${app.id}`}
                            className="font-medium hover:underline break-words"
                          >
                            {displayName}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden sm:table-cell">
                          <span className="break-words line-clamp-1">{positionTitle}</span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            variant="secondary"
                            className={`text-[11px] whitespace-nowrap ${STATUS_COLORS[app.status]}`}
                          >
                            {APPLICATION_STATUS_LABELS[app.status]}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell whitespace-nowrap">
                          {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            to={`${basePath}/applicants/${app.id}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            View
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Positions — secondary / compact */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold tracking-tight break-words">Positions</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Filter</span>
              <Select
                value={positionStatusFilter}
                onValueChange={(value) =>
                  setPositionStatusFilter(value as 'all' | 'active' | 'draft' | 'archived')
                }
              >
                <SelectTrigger className="h-8 min-w-0 flex-1 sm:w-[150px] sm:flex-initial">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="w-full shrink-0 sm:w-auto" asChild>
              <Link to={`${basePath}/positions/new`}>
                <Plus className="h-4 w-4 mr-1" />
                Add Position
              </Link>
            </Button>
          </div>
        </div>
        {!loading && positions.length > 0 && (
          <p className="text-xs text-muted-foreground mb-3">
            Showing {filteredPositions.length} of {positions.length} position{positions.length !== 1 ? 's' : ''}
          </p>
        )}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <Skeleton className="h-4 w-40 flex-1" />
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-12 ml-auto" />
              </div>
            ))}
          </div>
        ) : positions.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No positions yet</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create your first position to start receiving applications
              </p>
              <Button asChild size="sm">
                <Link to={`${basePath}/positions/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Position
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : filteredPositions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Briefcase className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground font-medium text-sm">No positions match this filter</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredPositions.map((pos) => {
              const appCount = applications.filter((a) => a.position_id === pos.id).length;
              return (
                <Link
                  key={pos.id}
                  to={`${basePath}/positions/${pos.id}`}
                  className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-muted/20"
                >
                  <span className="flex-1 min-w-0 text-sm font-medium line-clamp-1 break-words">
                    {pos.title}
                  </span>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-[10px] ${POSITION_STATUS_COLORS[pos.status]}`}
                  >
                    {pos.status}
                  </Badge>
                  <Badge variant="outline" className="shrink-0 text-[10px] hidden sm:inline-flex">
                    {POSITION_TYPE_LABELS[pos.position_type] || pos.position_type}
                  </Badge>
                  <span className="shrink-0 text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {appCount}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
