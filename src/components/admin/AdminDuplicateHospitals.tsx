import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Search,
  Trash2,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Building2,
} from 'lucide-react';

interface Hospital {
  id: string;
  name: string;
  contact_phone: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  status: string | null;
}

interface DuplicateGroup {
  group_key: string;
  duplicate_reason: string;
  hospitals: Hospital[];
}

export default function AdminDuplicateHospitals() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [keepSelections, setKeepSelections] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmGroup, setConfirmGroup] = useState<DuplicateGroup | null>(null);

  async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }

  async function scanDuplicates() {
    setScanning(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hospital-duplicates`,
        { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Scan failed');

      setGroups(result.groups);
      setScanned(true);
      // Default keep selection to first hospital in each group
      const defaults: Record<string, string> = {};
      for (const g of result.groups) {
        defaults[g.group_key] = g.hospitals[0].id;
      }
      setKeepSelections(defaults);

      if (result.groups.length === 0) {
        toast.success('No duplicates found!');
      } else {
        toast.info(`Found ${result.groups.length} duplicate group(s)`);
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error(error instanceof Error ? error.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  }

  async function handleDelete(group: DuplicateGroup) {
    const keepId = keepSelections[group.group_key];
    if (!keepId) return;

    setDeleting(group.group_key);
    setConfirmGroup(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');

      const deleteIds = group.hospitals.filter((h) => h.id !== keepId).map((h) => h.id);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hospital-duplicates`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            delete_ids: deleteIds,
            keep_id: keepId,
            duplicate_reason: group.duplicate_reason,
          }),
        }
      );
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Delete failed');

      toast.success(`Deleted ${result.deleted} duplicate(s)`);
      setGroups((prev) => prev.filter((g) => g.group_key !== group.group_key));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  const reasonLabel: Record<string, string> = {
    name_match: 'Name Match',
    phone_match: 'Phone Match',
    coordinate_match: 'Coordinate Match',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Duplicate Hospital Detection
        </CardTitle>
        <CardDescription>
          Scan the hospitals table for potential duplicates based on name, phone, or coordinates. Review and selectively remove duplicates.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Button onClick={scanDuplicates} disabled={scanning} className="gap-2">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {scanning ? 'Scanning...' : 'Scan for Duplicates'}
        </Button>

        {scanned && groups.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-500" />
            No duplicate hospitals found.
          </div>
        )}

        {groups.map((group) => {
          const keepId = keepSelections[group.group_key];
          const isDeleting = deleting === group.group_key;

          return (
            <Card key={group.group_key} className="border-yellow-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium text-sm">
                      {group.hospitals.length} records
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {reasonLabel[group.duplicate_reason] || group.duplicate_reason}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isDeleting || !keepId}
                    onClick={() => setConfirmGroup(group)}
                    className="gap-1.5"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete Unselected
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="overflow-x-auto overflow-x-auto-touch">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Keep</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-xs">ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.hospitals.map((h) => (
                        <TableRow
                          key={h.id}
                          className={keepId === h.id ? 'bg-green-500/10' : 'bg-red-500/5'}
                        >
                          <TableCell>
                            <input
                              type="radio"
                              name={`keep-${group.group_key}`}
                              checked={keepId === h.id}
                              onChange={() =>
                                setKeepSelections((prev) => ({
                                  ...prev,
                                  [group.group_key]: h.id,
                                }))
                              }
                              className="h-4 w-4"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{h.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {h.contact_phone || '—'}
                          </TableCell>
                          <TableCell className="text-sm">{h.city || '—'}</TableCell>
                          <TableCell className="text-sm">{h.state || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {h.status || 'unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono max-w-[100px] truncate">
                            {h.id.slice(0, 8)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {/* Confirmation Dialog */}
        <AlertDialog open={!!confirmGroup} onOpenChange={() => setConfirmGroup(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Duplicate Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmGroup && (
                  <>
                    You are about to delete{' '}
                    <strong>{confirmGroup.hospitals.length - 1}</strong> hospital record(s) and keep{' '}
                    <strong>
                      {confirmGroup.hospitals.find(
                        (h) => h.id === keepSelections[confirmGroup.group_key]
                      )?.name || 'selected record'}
                    </strong>
                    . This action is logged but cannot be undone.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => confirmGroup && handleDelete(confirmGroup)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Duplicates
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
