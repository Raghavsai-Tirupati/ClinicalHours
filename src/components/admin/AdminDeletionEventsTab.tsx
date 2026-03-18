import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2, RefreshCw, Search, Loader2, Mail, User } from 'lucide-react';

interface DeletionEvent {
  id: string;
  user_id: string;
  email: string | null;
  reason: string;
  deleted_at: string;
}

const REASON_LABELS: Record<string, string> = {
  user_requested: 'User requested',
  unverified_cleanup: 'Unverified cleanup',
};

export default function AdminDeletionEventsTab() {
  const [events, setEvents] = useState<DeletionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');

  async function fetchEvents() {
    setLoading(true);
    try {
      let query = supabase
        .from('account_deletion_events')
        .select('*')
        .order('deleted_at', { ascending: false })
        .limit(200);

      if (reasonFilter !== 'all') {
        query = query.eq('reason', reasonFilter);
      }

      if (searchEmail.trim()) {
        query = query.ilike('email', `%${searchEmail.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching deletion events:', error);
      toast.error('Failed to load deletion events');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reasonFilter]);

  const formatDateTime = (value: string) =>
    new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const reasonCounts = events.reduce<Record<string, number>>((acc, ev) => {
    acc[ev.reason] = (acc[ev.reason] || 0) + 1;
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Account Deletions
        </CardTitle>
        <CardDescription>
          View users whose accounts were deleted, including self-deletions and automatic cleanup of unverified accounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex gap-2 flex-1 max-w-md">
            <Input
              placeholder="Filter by email..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchEvents()}
              className="flex-1"
            />
            <Button variant="outline" onClick={fetchEvents} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All reasons</option>
              <option value="user_requested">User requested</option>
              <option value="unverified_cleanup">Unverified cleanup</option>
            </select>
            <Button variant="outline" size="icon" onClick={fetchEvents} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Total events loaded: {events.length}</span>
          <span>|</span>
          <span>User requested: {reasonCounts['user_requested'] || 0}</span>
          <span>|</span>
          <span>Unverified cleanup: {reasonCounts['unverified_cleanup'] || 0}</span>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Deleted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No deletion events found
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium truncate max-w-[220px]" title={event.user_id}>
                            {event.user_id}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          <span className="truncate max-w-[220px]" title={event.email || ''}>
                            {event.email || 'Unknown email'}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.reason === 'user_requested' ? 'outline' : 'secondary'}>
                        {REASON_LABELS[event.reason] || event.reason}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDateTime(event.deleted_at)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

