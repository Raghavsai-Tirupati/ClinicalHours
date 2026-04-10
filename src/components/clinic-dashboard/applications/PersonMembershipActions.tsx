import { useCallback, useEffect, useState } from 'react';
import { Loader2, GraduationCap, UserPlus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClinicRoles } from '@/components/clinic-dashboard/volunteer-management/hooks';
import {
  MEMBER_STATUS_COLORS,
  MEMBER_STATUS_LABELS,
} from '@/components/clinic-dashboard/volunteer-management/types';
import type { ClinicMember } from '@/components/clinic-dashboard/volunteer-management/types';
import type { StudentApplication } from '@/types/positions';

// Bridges an application row to its (optional) clinic_members row.
//   • If the application is accepted but no member row exists yet → show
//     "Promote to Member" with a role picker.
//   • If a member row exists → show the current status and a "Mark as
//     Alumni" button (or "Reactivate" for an alumnus).

interface Props {
  clinicId: string;
  application: StudentApplication;
  applicantName: string;
  applicantEmail: string | null;
}

export default function PersonMembershipActions({
  clinicId,
  application,
  applicantName,
  applicantEmail,
}: Props) {
  const { roles, loading: rolesLoading } = useClinicRoles(clinicId);
  const [member, setMember] = useState<ClinicMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clinic_members')
      .select('*, role:clinic_roles(*)')
      .eq('clinic_id', clinicId)
      .eq('application_id', application.id)
      .maybeSingle();
    if (error) {
      console.error('[membership] fetch failed', error);
    }
    setMember((data as ClinicMember) || null);
    setLoading(false);
  }, [clinicId, application.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handlePromote = async () => {
    if (!selectedRoleId) {
      toast.error('Pick a role first.');
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from('clinic_members').insert({
        clinic_id: clinicId,
        user_id: application.student_id || null,
        application_id: application.id,
        full_name: applicantName,
        email: applicantEmail,
        role_id: selectedRoleId,
        status: 'active',
        onboarding_source: 'new_applicant',
        join_date: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      toast.success(`${applicantName} added to staff`);
      await refresh();
    } catch (err: any) {
      console.error('[membership] promote failed', err);
      toast.error(err?.message || err?.details || 'Failed to promote');
    } finally {
      setBusy(false);
    }
  };

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
          ? `${applicantName} marked as alumni`
          : `${applicantName} reactivated`,
      );
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setBusy(false);
    }
  };

  // Only show this card once an application has a final-ish status.
  const isPromotable = application.status === 'accepted';

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
              {member.role?.role_name && (
                <span className="text-xs text-muted-foreground">
                  Role:{' '}
                  <span className="font-medium text-foreground">
                    {member.role.role_name}
                    {member.status === 'alumni' && ' (Alumni)'}
                  </span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Joined {new Date(member.join_date).toLocaleDateString()}
            </p>
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
        ) : isPromotable ? (
          <>
            <p className="text-xs text-muted-foreground">
              Accepted but not yet on staff. Pick a role and confirm to add them
              to your roster.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={selectedRoleId}
                onValueChange={setSelectedRoleId}
                disabled={rolesLoading || busy || roles.length === 0}
              >
                <SelectTrigger className="h-9 w-48">
                  <SelectValue
                    placeholder={
                      roles.length === 0 ? 'No roles configured' : 'Pick a role'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={busy || !selectedRoleId}
                onClick={handlePromote}
                className="gap-1.5"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )}
                Promote to Staff
              </Button>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            This person is not on staff yet. Set their application status to
            <span className="font-medium text-foreground"> Accepted </span>
            to enable promotion.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
