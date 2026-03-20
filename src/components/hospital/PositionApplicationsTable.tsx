import { useState } from 'react';
import { Loader2, Search, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { usePositionApplications } from '@/hooks/usePositionApplications';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import { format } from 'date-fns';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-700',
  under_review: 'bg-yellow-500/15 text-yellow-700',
  accepted: 'bg-green-500/15 text-green-700',
  rejected: 'bg-red-500/15 text-red-700',
  waitlisted: 'bg-purple-500/15 text-purple-700',
};

interface Props {
  positionId: string;
}

export default function PositionApplicationsTable({ positionId }: Props) {
  const {
    applications,
    allApplications,
    loading,
    statusFilter,
    setStatusFilter,
    searchTerm,
    setSearchTerm,
    refetch,
  } = usePositionApplications(positionId);

  const [selectedApp, setSelectedApp] = useState<StudentApplication | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (appId: string, newStatus: ApplicationStatus) => {
    setUpdatingStatus(true);
    try {
      const { error } = await supabase
        .from('student_applications')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', appId);

      if (error) throw error;
      toast.success(`Application ${APPLICATION_STATUS_LABELS[newStatus].toLowerCase()}`);
      refetch();
      if (selectedApp?.id === appId) {
        setSelectedApp((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Stats
  const newCount = allApplications.filter((a) => a.status === 'new').length;
  const totalCount = allApplications.length;

  return (
    <>
      <div className="space-y-4">
        {/* Stats bar */}
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium">{totalCount} application{totalCount !== 1 ? 's' : ''}</span>
          {newCount > 0 && (
            <Badge className="bg-blue-500/15 text-blue-700 text-xs">{newCount} new</Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as ApplicationStatus | 'all')}
          >
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-10 border rounded-lg">
            <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {totalCount === 0 ? 'No applications yet' : 'No matching applications'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[160px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app) => (
                  <TableRow
                    key={app.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedApp(app)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {app.student_profile?.full_name || 'Unknown'}
                        </p>
                        {app.student_profile?.university && (
                          <p className="text-xs text-muted-foreground">
                            {app.student_profile.university}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(app.submitted_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${STATUS_COLORS[app.status]}`}>
                        {APPLICATION_STATUS_LABELS[app.status]}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={app.status}
                        onValueChange={(v) => handleStatusChange(app.id, v as ApplicationStatus)}
                        disabled={updatingStatus}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Application Detail Sheet */}
      <Sheet open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedApp && (
            <>
              <SheetHeader>
                <SheetTitle>
                  {selectedApp.student_profile?.full_name || 'Application'}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Status</p>
                  <Select
                    value={selectedApp.status}
                    onValueChange={(v) => handleStatusChange(selectedApp.id, v as ApplicationStatus)}
                    disabled={updatingStatus}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium">Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedApp.submitted_at), 'MMMM d, yyyy h:mm a')}
                  </p>
                </div>

                {selectedApp.student_profile && (
                  <div className="space-y-2 border-t pt-4">
                    <p className="text-sm font-medium">Student Info</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedApp.student_profile.university && (
                        <>
                          <span className="text-muted-foreground">University</span>
                          <span>{selectedApp.student_profile.university}</span>
                        </>
                      )}
                      {selectedApp.student_profile.major && (
                        <>
                          <span className="text-muted-foreground">Major</span>
                          <span>{selectedApp.student_profile.major}</span>
                        </>
                      )}
                      {selectedApp.student_profile.graduation_year && (
                        <>
                          <span className="text-muted-foreground">Graduation Year</span>
                          <span>{selectedApp.student_profile.graduation_year}</span>
                        </>
                      )}
                    </div>
                    {selectedApp.student_profile.resume_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={selectedApp.student_profile.resume_url} target="_blank" rel="noopener noreferrer">
                          View Resume
                        </a>
                      </Button>
                    )}
                  </div>
                )}

                {selectedApp.notes && (
                  <div className="space-y-1 border-t pt-4">
                    <p className="text-sm font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{selectedApp.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
