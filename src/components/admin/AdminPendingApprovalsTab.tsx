import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  Mail,
  Globe,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface PendingHospital {
  id: string;
  hospital_name: string;
  contact_email: string;
  contact_phone: string | null;
  website: string | null;
  address: string | null;
  description: string | null;
  created_at: string;
}

interface ReviewedHospital {
  id: string;
  hospital_name: string;
  contact_email: string;
  account_status: string;
  admin_note: string | null;
  reviewed_at: string;
}

interface AdminPendingApprovalsTabProps {
  onPendingCountChange?: (count: number) => void;
}

export default function AdminPendingApprovalsTab({ onPendingCountChange }: AdminPendingApprovalsTabProps) {
  const [pending, setPending] = useState<PendingHospital[]>([]);
  const [reviewed, setReviewed] = useState<ReviewedHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingHospital | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a ref to latest pending count to avoid stale closure in polling
  const pendingCountRef = useRef(0);

  useEffect(() => {
    fetchData();
    pollingRef.current = setInterval(fetchData, 60_000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function fetchData() {
    try {
      const [{ data: pendingData }, { data: reviewedData }] = await Promise.all([
        supabase
          .from('hospital_accounts')
          .select(
            'id, hospital_name, contact_email, contact_phone, website, address, description, created_at'
          )
          .eq('account_status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('hospital_accounts')
          .select('id, hospital_name, contact_email, account_status, admin_note, reviewed_at')
          .in('account_status', ['approved', 'rejected'])
          .not('reviewed_at', 'is', null)
          .order('reviewed_at', { ascending: false })
          .limit(50),
      ]);

      const newPending = (pendingData || []) as PendingHospital[];
      setPending(newPending);
      setReviewed((reviewedData || []) as ReviewedHospital[]);
      pendingCountRef.current = newPending.length;
      onPendingCountChange?.(newPending.length);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
    } finally {
      setLoading(false);
    }
  }

  async function getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function callHospitalReview(hospitalId: string, action: 'approve' | 'reject', note?: string) {
    const token = await getAuthToken();
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hospital-review`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hospitalId, action, note }),
      }
    );
    const result = await res.json();
    if (!result.success) throw new Error(result.error || `${action} failed`);
    return result;
  }

  async function handleApprove(hospital: PendingHospital) {
    setProcessingId(hospital.id);
    try {
      await callHospitalReview(hospital.id, 'approve');
      // Optimistically remove from queue
      setPending((prev) => {
        const next = prev.filter((h) => h.id !== hospital.id);
        pendingCountRef.current = next.length;
        onPendingCountChange?.(next.length);
        return next;
      });
      toast.success(`${hospital.hospital_name} approved — confirmation email sent`);
      fetchData(); // refresh history
    } catch (err) {
      console.error('Approval error:', err);
      toast.error(err instanceof Error ? err.message : 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget) return;
    const target = rejectTarget;
    const note = rejectNote.trim() || undefined;
    setProcessingId(target.id);
    try {
      await callHospitalReview(target.id, 'reject', note);
      setPending((prev) => {
        const next = prev.filter((h) => h.id !== target.id);
        pendingCountRef.current = next.length;
        onPendingCountChange?.(next.length);
        return next;
      });
      setRejectTarget(null);
      setRejectNote('');
      toast.success(`${target.hospital_name} rejected — notification email sent`);
      fetchData();
    } catch (err) {
      console.error('Rejection error:', err);
      toast.error(err instanceof Error ? err.message : 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                Pending Hospital Approvals
                {pending.length > 0 && (
                  <Badge className="bg-yellow-500 text-white ml-1">{pending.length}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Review and approve or reject new hospital account registrations
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : pending.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="font-medium text-foreground">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">No pending hospital approvals</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending.map((hospital) => (
                <div
                  key={hospital.id}
                  className="bg-muted/20 border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-start gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <p className="font-semibold text-foreground truncate">
                        {hospital.hospital_name}
                      </p>
                    </div>
                    <div className="space-y-1 mt-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        {hospital.contact_email}
                      </p>
                      {hospital.website && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Globe className="h-3 w-3 flex-shrink-0" />
                          <a
                            href={hospital.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate"
                          >
                            {hospital.website}
                          </a>
                        </p>
                      )}
                      {hospital.address && (
                        <p className="text-sm text-muted-foreground">{hospital.address}</p>
                      )}
                      {hospital.description && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {hospital.description}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      Submitted{' '}
                      {formatDistanceToNow(new Date(hospital.created_at), { addSuffix: true })}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-shrink-0 sm:flex-col">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none"
                      onClick={() => handleApprove(hospital)}
                      disabled={processingId === hospital.id}
                    >
                      {processingId === hospital.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-1" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 sm:flex-none"
                      onClick={() => {
                        setRejectTarget(hospital);
                        setRejectNote('');
                      }}
                      disabled={processingId === hospital.id}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review History */}
      <Card>
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setShowHistory((v) => !v)}
        >
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Review History ({reviewed.length})
            </span>
            {showHistory
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
        </CardHeader>
        {showHistory && (
          <CardContent>
            {reviewed.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No reviews yet</p>
            ) : (
              <div className="space-y-0">
                {reviewed.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{h.hospital_name}</p>
                        <Badge
                          variant={h.account_status === 'approved' ? 'default' : 'destructive'}
                          className="text-xs flex-shrink-0"
                        >
                          {h.account_status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{h.contact_email}</p>
                      {h.admin_note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Note: {h.admin_note}
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {format(new Date(h.reviewed_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Reject Dialog */}
      <AlertDialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setRejectNote('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Hospital Account</AlertDialogTitle>
            <AlertDialogDescription>
              Reject <strong>{rejectTarget?.hospital_name}</strong>? They will receive a
              notification email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Optional: add a note explaining the rejection (will be included in the email)..."
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setRejectTarget(null);
                setRejectNote('');
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={processingId !== null}
            >
              {processingId ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Reject Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
