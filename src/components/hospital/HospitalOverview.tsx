import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Users, FileText, TrendingUp, Plus, ArrowRight, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import { APPLICATION_STATUS_LABELS, POSITION_TYPE_LABELS } from '@/types/positions';
import type { ApplicationStatus, PositionStatus } from '@/types/positions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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

function getApplicantName(app: {
  applicant_name?: string | null;
  student_profile?: { full_name: string | null };
  applicant_email?: string | null;
  student_id: string;
}): string {
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
  const { applications, positions, stats, loading, updateApplicationLocally } = useAllApplications(hospitalPage?.id);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [positionStatusFilter, setPositionStatusFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all');

  const activePositionCount = positions.filter((p) => p.status === 'active').length;
  const recentApps = applications.slice(0, 5);
  const filteredPositions = positions.filter((position) => {
    if (positionStatusFilter === 'all') return true;
    return position.status === positionStatusFilter;
  });

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    setUpdatingId(appId);
    try {
      const { error } = await supabase
        .from('student_applications')
        .update(buildStudentApplicationStatusUpdate(newStatus))
        .eq('id', appId);

      if (error) throw error;
      toast.success(`Status updated to ${APPLICATION_STATUS_LABELS[newStatus]}`);
      updateApplicationLocally(appId, { status: newStatus });
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight break-words">Overview</h2>
          <p className="text-muted-foreground text-sm mt-1 text-pretty break-words">
            Manage positions, review applications, and track progress
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
                Acceptance Rate
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/15">
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.acceptanceRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.accepted} accepted of {stats.accepted + stats.rejected} decided
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Positions
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/15">
                <Briefcase className="h-4 w-4 text-purple-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activePositionCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Currently accepting</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle>Recent Applications</CardTitle>
            <p className="text-sm text-muted-foreground mt-1 text-pretty break-words">
              Latest submissions across all positions
            </p>
          </div>
          {applications.length > 5 && (
            <Button variant="ghost" size="sm" className="shrink-0 self-start sm:self-center" asChild>
              <Link to={`${basePath}/positions`}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : recentApps.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No applications yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Applications will appear here once students apply
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentApps.map((app) => {
                const positionTitle = app.position?.title || 'Unknown Position';
                const displayName = getApplicantName(app);
                return (
                  <div
                    key={app.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                        {displayName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium break-words">{displayName}</p>
                        <p className="text-xs text-muted-foreground break-words">{positionTitle}</p>
                        <span className="mt-1 text-xs text-muted-foreground sm:hidden">
                          {format(new Date(app.submitted_at), 'MMM d')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                    <Badge
                      variant="secondary"
                      className={`max-w-full whitespace-normal text-[11px] leading-snug ${STATUS_COLORS[app.status]}`}
                    >
                      {APPLICATION_STATUS_LABELS[app.status]}
                    </Badge>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      {format(new Date(app.submitted_at), 'MMM d')}
                    </span>
                    <Select
                      value={app.status}
                      onValueChange={(val) => handleStatusChange(app.id, val as ApplicationStatus)}
                      disabled={updatingId === app.id}
                    >
                      <SelectTrigger className="h-9 min-w-[8.5rem] flex-1 text-xs sm:h-7 sm:w-[120px] sm:flex-initial">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.entries(APPLICATION_STATUS_LABELS) as [ApplicationStatus, string][]).map(
                          ([value, label]) => (
                            <SelectItem key={value} value={value} className="text-xs">
                              {label}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Positions at a Glance */}
      <div className="min-w-0">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold tracking-tight break-words">Positions at a Glance</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">View</span>
              <Select
                value={positionStatusFilter}
                onValueChange={(value) =>
                  setPositionStatusFilter(value as 'all' | 'active' | 'draft' | 'archived')
                }
              >
                <SelectTrigger className="h-8 min-w-0 flex-1 sm:w-[150px] sm:flex-initial">
                  <SelectValue placeholder="All position statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All position statuses</SelectItem>
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
            Showing {filteredPositions.length} of {positions.length} positions
          </p>
        )}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-5 w-40 mb-3" />
                  <div className="flex gap-2 mb-4">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
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
            <CardContent className="py-10 text-center">
              <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No positions match this status</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try switching to another status filter.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPositions.map((pos) => {
              const appCount = applications.filter((a) => a.position_id === pos.id).length;
              return (
                <Link key={pos.id} to={`${basePath}/positions/${pos.id}`} className="group">
                  <Card className="transition-colors group-hover:border-primary/40">
                    <CardContent className="pt-6">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <h4 className="line-clamp-2 text-sm font-semibold break-words">{pos.title}</h4>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-4">
                        <Badge
                          variant="secondary"
                          className={`text-[10px] ${POSITION_STATUS_COLORS[pos.status]}`}
                        >
                          {pos.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {POSITION_TYPE_LABELS[pos.position_type] || pos.position_type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                          {appCount} application{appCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
