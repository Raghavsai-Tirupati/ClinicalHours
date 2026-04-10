import { useCallback, useEffect, useState } from 'react';
import { Loader2, GraduationCap, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MEMBER_STATUS_COLORS,
  MEMBER_STATUS_LABELS,
} from '@/components/clinic-dashboard/volunteer-management/types';
import type { ClinicMember } from '@/components/clinic-dashboard/volunteer-management/types';
import type { StudentApplication } from '@/types/positions';

// Shows a staff member's current status and provides Alumni / Reactivate
// controls.  Staff are auto-created when an application is accepted — there
// is no manual "Promote" step.  Roles are assigned in the Tracker tab by
// dragging the person into a role (category).

interface Props {
  clinicId: string;
  application: StudentApplication;
  applicantName: string;
  applicantEmail: string | null;
}

export default function PersonMembershipActions({
  clinicId,
  application,
}: Props) {
  const [member, setMember] = useState<ClinicMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Also fetch the tracker category name so we can show the role label.
  const [roleName, setRoleName] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_members')
      .select('*')
      .eq('clinic_id', clinicId)
      .eq('application_id', application.id)
      .maybeSingle();
    if (error) console.error('[membership] fetch failed', error);
    const m = (data as ClinicMember) || null;
    setMember(m);

    // Look up tracker category name if assigned.
    if (m?.tracker_category_id) {
      const { data: cat } = await supabase
        .from('volunteer_tracker_categories')
        .select('name')
        .eq('id', m.tracker_category_id)
        .maybeSingle();
      setRoleName((cat as { name: string } | null)?.name ?? null);
    } else {
      setRoleName(null);
    }
    setLoading(false);
  }, [clinicId, application.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleStatus = async (next: 'alumni' | 'active') => {
    if (!member) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from('clinic_members')
        .update({ status: next })
        .eq('id', member.id);
      if (error) throw error;
      toast.success(
        next === 'alumni'
          ? 'Marked as alumni'
          : 'Reactivated as staff',
      );
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5" />
          Staff
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : member ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={`text-xs ${MEMBER_STATUS_COLORS[member.status]}`}>
                {MEMBER_STATUS_LABELS[member.status]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Role:{' '}
                <span className="font-medium text-foreground">
                  {roleName
                    ? `${roleName}${member.status === 'alumni' ? ' (Alumni)' : ''}`
                    : 'Accepted (unassigned)'}
                </span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Joined {new Date(member.join_date).toLocaleDateString()}
            </p>
            {!roleName && (
              <p className="text-xs text-muted-foreground italic">
                Assign a role by dragging this person into a role in the{' '}
                <span className="font-medium text-foreground">Tracker</span> tab.
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {member.status === 'alumni' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleStatus('active')}
                  className="gap-1.5"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3.5 w-3.5" />
                  )}
                  Reactivate as Staff
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => handleStatus('alumni')}
                  className="gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GraduationCap className="h-3.5 w-3.5" />
                  )}
                  Mark as Alumni
                </Button>
              )}
            </div>
          </>
        ) : application.status === 'accepted' ? (
          <p className="text-xs text-muted-foreground">
            This person was accepted but a staff record hasn't been created yet.
            Try refreshing the page — it should be created automatically.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            This person is not on staff yet. Set their application status to
            <span className="font-medium text-foreground"> Accepted </span>
            to add them automatically.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
