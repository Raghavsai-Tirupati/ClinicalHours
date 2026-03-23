import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Users,
  Plus,
  ArrowRight,
  Search,
  Clock,
  MapPin,
  GripVertical,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { supabase } from '@/integrations/supabase/client';
import { POSITION_TYPE_LABELS } from '@/types/positions';
import type { HospitalPosition, PositionStatus } from '@/types/positions';
import { toast } from 'sonner';
import ApplicationsHub from './ApplicationsHub';


const STATUS_DOT: Record<PositionStatus, string> = {
  active: 'bg-green-400',
  draft: 'bg-muted-foreground',
  paused: 'bg-yellow-400',
  closed: 'bg-red-400',
  archived: 'bg-muted-foreground/40',
};

/** MIME type for HTML5 DnD (also mirrored in dataTransfer for drop fallback). */
const POSITION_DRAG_MIME = 'application/x-clinicalhours-position-id';

const KANBAN_COLUMNS = [
  { key: 'draft', title: 'Draft', statuses: ['draft'] as PositionStatus[] },
  { key: 'active', title: 'Active', statuses: ['active'] as PositionStatus[] },
  { key: 'archived', title: 'Archived', statuses: ['archived', 'paused', 'closed'] as PositionStatus[] },
] as const;

export default function PositionsHub() {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'applicants' ? 'applicants' : 'positions';
  const { applications, positions, loading } = useAllApplications(hospitalPage?.id);
  const [search, setSearch] = useState('');
  const [localPositions, setLocalPositions] = useState<HospitalPosition[]>([]);
  const [draggedPositionId, setDraggedPositionId] = useState<string | null>(null);
  const [dragOverColumnKey, setDragOverColumnKey] = useState<PositionStatus | null>(null);

  useEffect(() => {
    setLocalPositions(positions);
  }, [positions]);

  const filteredPositions = useMemo(() => {
    if (!search.trim()) return localPositions;
    const q = search.toLowerCase();
    return localPositions.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.location?.toLowerCase().includes(q) ?? false),
    );
  }, [localPositions, search]);

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

  const positionsByColumn = useMemo(
    () =>
      KANBAN_COLUMNS.map((column) => ({
        ...column,
        positions: filteredPositions.filter((position) => column.statuses.includes(position.status)),
      })),
    [filteredPositions],
  );

  const handleDropToColumn = async (
    targetStatus: PositionStatus,
    dataTransfer: DataTransfer | null,
  ) => {
    const droppedId =
      draggedPositionId ||
      (typeof dataTransfer?.getData === 'function'
        ? dataTransfer.getData(POSITION_DRAG_MIME)
        : '') ||
      null;
    if (!droppedId) return;

    const draggedPosition = localPositions.find((p) => p.id === droppedId);
    if (!draggedPosition || draggedPosition.status === targetStatus) {
      setDraggedPositionId(null);
      setDragOverColumnKey(null);
      return;
    }

    const previousPositions = localPositions;
    setLocalPositions((prev) =>
      prev.map((position) =>
        position.id === droppedId ? { ...position, status: targetStatus } : position,
      ),
    );
    setDraggedPositionId(null);
    setDragOverColumnKey(null);

    const { error } = await supabase
      .from('hospital_positions')
      .update({ status: targetStatus })
      .eq('id', droppedId);

    if (error) {
      setLocalPositions(previousPositions);
      toast.error('Could not move position. Please try again.');
      return;
    }

    const statusLabel = targetStatus.charAt(0).toUpperCase() + targetStatus.slice(1);
    toast.success(`Position moved to ${statusLabel}`);
  };

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

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          const params = new URLSearchParams(searchParams);
          if (v === 'applicants') params.set('tab', 'applicants');
          else params.delete('tab');
          navigate(`${basePath}/positions${params.toString() ? `?${params.toString()}` : ''}`, { replace: true });
        }}
        className="w-full"
      >
        <TabsList>
          <TabsTrigger value="positions" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Positions
          </TabsTrigger>
          <TabsTrigger value="applicants" className="gap-2">
            <Users className="h-4 w-4" />
            All Applicants
          </TabsTrigger>
        </TabsList>
        <TabsContent value="applicants" className="mt-6">
          <ApplicationsHub embeddedInPositions />
        </TabsContent>
        <TabsContent value="positions" className="mt-6">
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

      {/* Kanban Board */}
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
        <>
          {draggedPositionId && (
            <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary">
              Drag from the <strong className="font-semibold">grip</strong> on the left edge of a card, then drop it on{' '}
              <strong className="font-semibold">Draft</strong>, <strong className="font-semibold">Active</strong>, or{' '}
              <strong className="font-semibold">Archived</strong> to update its status.
            </div>
          )}
          <div className="grid gap-4 xl:grid-cols-3">
          {positionsByColumn.map((column) => (
            <div
              key={column.key}
              className={`rounded-lg border p-3 transition-all ${
                dragOverColumnKey === column.key
                  ? 'border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]'
                  : 'border-border/50 bg-muted/20'
              }`}
              onDragOver={(event) => {
                const types = event.dataTransfer?.types;
                const fromOurDrag =
                  !!draggedPositionId ||
                  (types != null &&
                    Array.from(types as Iterable<string>).includes(POSITION_DRAG_MIME));
                if (!fromOurDrag) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDragOverColumnKey(column.key);
              }}
              onDrop={(event) => {
                event.preventDefault();
                void handleDropToColumn(column.key, event.dataTransfer);
              }}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{column.title}</h3>
                <Badge variant="outline" className="text-[10px] py-0">
                  {column.positions.length}
                </Badge>
              </div>
              <div className="space-y-3 min-h-[180px]">
                {column.positions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/70 bg-background/40 px-3 py-6 text-center text-xs text-muted-foreground">
                    No {column.title.toLowerCase()} positions
                  </div>
                ) : (
                  column.positions.map((pos) => {
                    const counts = appCountsByPosition[pos.id] ?? { total: 0, new: 0 };
                    return (
                      <div
                        key={pos.id}
                        className={`flex overflow-hidden rounded-lg border border-border/50 bg-card transition-shadow hover:border-primary/40 hover:shadow-md ${
                          draggedPositionId === pos.id ? 'opacity-80 ring-1 ring-primary/30' : ''
                        }`}
                      >
                        <button
                          type="button"
                          aria-label={`Drag to change status: ${pos.title}`}
                          className="flex w-9 shrink-0 cursor-grab touch-none items-center justify-center border-r border-border/50 bg-muted/25 text-muted-foreground hover:bg-muted/45 active:cursor-grabbing"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            setDraggedPositionId(pos.id);
                            e.dataTransfer.setData(POSITION_DRAG_MIME, pos.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragEnd={() => {
                            setDraggedPositionId(null);
                            setDragOverColumnKey(null);
                          }}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <Link
                          to={`${basePath}/positions/${pos.id}`}
                          className="group/link min-w-0 flex-1 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-r-lg"
                        >
                          <Card className="rounded-none border-0 shadow-none">
                            <CardContent className="pt-5 pb-4 px-5 flex flex-col">
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
                              <h3 className="text-sm font-semibold truncate mb-2 group-hover/link:text-primary transition-colors">
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
                                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity" />
                              </div>
                            </CardContent>
                          </Card>
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
          </div>
        </>
      )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
