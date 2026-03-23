import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Plus,
  ArrowRight,
  Search,
  Clock,
  MapPin,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { POSITION_TYPE_LABELS } from '@/types/positions';
import type { PositionStatus } from '@/types/positions';


const STATUS_DOT: Record<PositionStatus, string> = {
  active: 'bg-green-400',
  draft: 'bg-muted-foreground',
  paused: 'bg-yellow-400',
  closed: 'bg-red-400',
  archived: 'bg-muted-foreground/40',
};

export default function PositionsHub() {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { applications, positions, loading } = useAllApplications(hospitalPage?.id);
  const [search, setSearch] = useState('');

  const filteredPositions = useMemo(() => {
    if (!search.trim()) return positions;
    const q = search.toLowerCase();
    return positions.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.location?.toLowerCase().includes(q) ?? false),
    );
  }, [positions, search]);

  const appCountsByPosition = useMemo(() => {
    const counts: Record<string, { total: number; new: number }> = {};
    for (const app of applications) {
      const pid = app.position_id;
      if (!counts[pid]) counts[pid] = { total: 0, new: 0 };
      counts[pid].total++;
      if (app.status === 'new') counts[pid].new++;
    }
    return counts;
  }, [applications]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Positions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage positions and review applicants
          </p>
        </div>
        <Button asChild>
          <Link to={`${basePath}/positions/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Position
          </Link>
        </Button>
      </div>

      {/* Search */}
      {positions.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search positions..."
            className="pl-9 h-9"
          />
        </div>
      )}

      {/* Position Cards */}
      {filteredPositions.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Briefcase className="h-8 w-8 text-muted-foreground/50" />
            </div>
            {positions.length === 0 ? (
              <>
                <p className="text-base font-medium text-foreground mb-1">No positions yet</p>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                  Create your first position to start receiving applications from students
                </p>
                <Button asChild size="sm">
                  <Link to={`${basePath}/positions/new`}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Position
                  </Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No positions match your search</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPositions.map((pos) => {
            const counts = appCountsByPosition[pos.id] ?? { total: 0, new: 0 };
            return (
              <Link key={pos.id} to={`${basePath}/positions/${pos.id}`} className="group">
                <Card className="h-full transition-all group-hover:border-primary/40 group-hover:shadow-md">
                  <CardContent className="pt-5 pb-4 px-5 flex flex-col h-full">
                    {/* Status + Type row */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[pos.status]}`} />
                        <span className="text-[11px] font-medium capitalize text-muted-foreground">
                          {pos.status}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 ml-auto">
                        {POSITION_TYPE_LABELS[pos.position_type] || pos.position_type}
                      </Badge>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold truncate mb-2 group-hover:text-primary transition-colors">
                      {pos.title}
                    </h3>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-4">
                      {pos.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {pos.location}
                        </span>
                      )}
                      {pos.hours_per_week && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {pos.hours_per_week} hrs/wk
                        </span>
                      )}
                    </div>

                    {/* App stats + arrow */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" />
                          {counts.total} applicant{counts.total !== 1 ? 's' : ''}
                        </span>
                        {counts.new > 0 && (
                          <Badge className="bg-blue-500/15 text-blue-400 text-[10px] py-0 px-1.5">
                            {counts.new} new
                          </Badge>
                        )}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
