import { Link } from 'react-router-dom';
import { Briefcase, Users, Clock, Plus, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { usePositions } from '@/hooks/usePositions';
import { POSITION_TYPE_LABELS } from '@/types/positions';
import type { PositionStatus } from '@/types/positions';

const STATUS_VARIANT: Record<PositionStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  draft: 'secondary',
  paused: 'outline',
  closed: 'destructive',
};

export default function HospitalOverview() {
  const { hospitalPage, basePath } = useHospitalPageContext();
  const { positions, loading } = usePositions(hospitalPage?.id);

  const activeCount = positions.filter((p) => p.status === 'active').length;
  const draftCount = positions.filter((p) => p.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Overview</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your positions and review applications
          </p>
        </div>
        <Button asChild>
          <Link to={`${basePath}/positions/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Position
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Positions</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positions.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeCount} active, {draftCount} draft
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Positions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently accepting applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Hospital</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium truncate">{hospitalPage?.opportunity.name}</div>
            <p className="text-xs text-muted-foreground truncate">
              {hospitalPage?.opportunity.location}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Positions list */}
      <Card>
        <CardHeader>
          <CardTitle>Positions</CardTitle>
          <CardDescription>All positions you've created</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
          ) : positions.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">No positions yet</p>
              <Button asChild size="sm">
                <Link to={`${basePath}/positions/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Position
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {positions.map((pos) => (
                <Link
                  key={pos.id}
                  to={`${basePath}/positions/${pos.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{pos.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {POSITION_TYPE_LABELS[pos.position_type] || pos.position_type}
                      </Badge>
                      <Badge variant={STATUS_VARIANT[pos.status]}className="text-xs">
                        {pos.status}
                      </Badge>
                      {pos.hours_per_week && (
                        <span className="text-xs text-muted-foreground">
                          {pos.hours_per_week} hrs/wk
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
