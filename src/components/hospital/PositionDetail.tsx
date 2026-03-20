import { Link, useParams } from 'react-router-dom';
import { Loader2, Pencil, Users, Clock, MapPin, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { usePositionDetail } from '@/hooks/usePositionDetail';
import PositionApplicationsTable from './PositionApplicationsTable';
import { POSITION_TYPE_LABELS, APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { PositionStatus } from '@/types/positions';
import { format } from 'date-fns';

const STATUS_COLORS: Record<PositionStatus, string> = {
  active: 'bg-green-500/15 text-green-700 border-green-500/30',
  draft: 'bg-muted text-muted-foreground',
  paused: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
  closed: 'bg-red-500/15 text-red-700 border-red-500/30',
};

export default function PositionDetail() {
  const { positionId } = useParams<{ positionId: string }>();
  const { hospitalPage } = useHospitalPageContext();
  const pageId = hospitalPage?.id || '';
  const { position, questions, loading, error } = usePositionDetail(positionId);

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
        <p className="text-muted-foreground">{error || 'Position not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-2xl font-bold">{position.title}</h2>
            <Badge className={STATUS_COLORS[position.status]}>
              {position.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {POSITION_TYPE_LABELS[position.position_type] || position.position_type}
              </Badge>
            </span>
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
        <Button asChild variant="outline" size="sm">
          <Link to={`/hospital/${pageId}/positions/${position.id}/edit`}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="applications">
        <TabsList>
          <TabsTrigger value="applications" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Applications
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="applications" className="mt-4">
          <PositionApplicationsTable positionId={position.id} />
        </TabsContent>

        <TabsContent value="details" className="mt-4">
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
