import { Link, useParams } from 'react-router-dom';
import { Loader2, Pencil, Users, Clock, MapPin, Calendar, BarChart2, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { usePositionDetail } from '@/hooks/usePositionDetail';
import { usePositionApplications } from '@/hooks/usePositionApplications';
import PositionApplicationsTable from './PositionApplicationsTable';
import ResponseAnalytics from './ResponseAnalytics';
import { POSITION_TYPE_LABELS } from '@/types/positions';
import type { PositionStatus } from '@/types/positions';
import { format } from 'date-fns';
import { isPositionDeadlinePassed } from '@/lib/positionAvailability';

const STATUS_COLORS: Record<PositionStatus, string> = {
  active: 'bg-green-500/15 text-green-700 border-green-500/30',
  draft: 'bg-muted text-muted-foreground',
  paused: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
  closed: 'bg-red-500/15 text-red-700 border-red-500/30',
  archived: 'bg-muted text-muted-foreground opacity-60',
};

export default function PositionDetail() {
  const { positionId } = useParams<{ positionId: string }>();
  const { basePath } = useHospitalPageContext();
  const { position, questions, loading, error } = usePositionDetail(positionId, { adminMode: true });
  const { allApplications } = usePositionApplications(positionId || '');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !position) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">{error === 'Applications for this position have closed.' || error === 'This position is no longer accepting applications.' ? 'Position not found or failed to load.' : (error || 'Position not found')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      {position.status !== 'active' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          This position is <span className="font-medium">{position.status}</span> — it is not shown to students.
          You can still review applicants, edit, or move it between columns from the Positions board.
        </div>
      )}

      {position.status === 'active' && isPositionDeadlinePassed(position.application_deadline) && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          The application deadline has passed. New students may not be able to apply until you extend the deadline
          or change status.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
            <h2 className="text-2xl font-bold break-words">{position.title}</h2>
            <Badge className={STATUS_COLORS[position.status]}>
              {position.status}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {POSITION_TYPE_LABELS[position.position_type] || position.position_type}
            </Badge>
            {position.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {position.location}
              </span>
            )}
            {position.hours_per_week && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {position.hours_per_week} hrs/wk
              </span>
            )}
            {position.application_deadline && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Deadline: {format(new Date(position.application_deadline), 'MMM d, yyyy')}
              </span>
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 self-start">
          <Link to={`${basePath}/positions/${position.id}/edit`}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Tabs: Applicants, Analytics, Settings */}
      <Tabs defaultValue="applicants">
        <TabsList className="inline-flex h-auto min-h-10 w-full max-w-full flex-wrap gap-1 bg-muted p-1 sm:h-10 sm:flex-nowrap">
          <TabsTrigger value="applicants" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Applicants
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applicants" className="mt-4">
          <PositionApplicationsTable positionId={position.id} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <ResponseAnalytics
            applications={allApplications}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {position.description || 'No description provided'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {position.requirements || 'No specific requirements'}
                </p>
              </CardContent>
            </Card>

            {position.duration && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Duration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{position.duration}</p>
                </CardContent>
              </Card>
            )}

            {position.spots_available && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Spots Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{position.spots_available}</p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Application Flow</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  Ask for availability:{' '}
                  <span className="font-medium">
                    {position.ask_for_availability !== false ? 'Yes' : 'No'}
                  </span>
                </p>
              </CardContent>
            </Card>
          </div>

          {questions.length > 0 && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Application Questions ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="flex gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                    <div>
                      <span>{q.question_text}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({q.question_type.replace('_', ' ')})
                        {q.is_required && ' *'}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
