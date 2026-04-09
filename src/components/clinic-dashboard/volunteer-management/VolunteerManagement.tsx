import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Table as TableIcon, UserCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useClinicRoles, useClinicMembers } from './hooks';
import MembersTab from './MembersTab';
import PeopleTab from './PeopleTab';
import VolunteerTracker from '../volunteer-tracker/VolunteerTracker';

// Renamed from "Team" → "People" in the People refactor.
// Three tabs:
//   • People  – everyone who has ever applied (any status)
//   • Members – only people promoted from accepted applications (incl. alumni)
//   • Tracker – the volunteer hours tracker (unchanged)
export default function VolunteerManagement() {
  const { hospitalPage } = useHospitalPageContext();
  const rawId = hospitalPage?.id;
  // virtual- IDs are placeholders when the hospital page hasn't been provisioned yet
  const clinicId = rawId && !rawId.startsWith('virtual-') ? rawId : undefined;

  const { roles, loading: rolesLoading } = useClinicRoles(clinicId);
  const { members, loading: membersLoading, refetch: refetchMembers } = useClinicMembers(clinicId);

  // Support legacy ?tab= deep links and the new "people" default.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') ?? 'people';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const qp = searchParams.get('tab');
    // Redirect any deep links to removed tabs back to People.
    if (qp && ['onboarding', 'files', 'roles'].includes(qp)) {
      const next = new URLSearchParams(searchParams);
      next.delete('tab');
      setSearchParams(next, { replace: true });
      setActiveTab('people');
      return;
    }
    if (qp && qp !== activeTab) setActiveTab(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (next: string) => {
    setActiveTab(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'people') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };

  if (!clinicId) return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">
        People management is not available yet. Please reload the page or contact support if this persists.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">People</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Everyone who has ever applied, your active members, and your hours tracker — all in one place.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="people" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">People</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5 text-xs">
            <UserCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="tracker" className="gap-1.5 text-xs">
            <TableIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tracker</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="mt-6">
          <PeopleTab clinicId={clinicId} />
        </TabsContent>

        <TabsContent value="members" className="mt-6">
          <MembersTab
            clinicId={clinicId}
            members={members}
            roles={roles}
            loading={membersLoading || rolesLoading}
            onRefresh={refetchMembers}
          />
        </TabsContent>

        <TabsContent value="tracker" className="mt-6">
          <VolunteerTracker />
        </TabsContent>
      </Tabs>
    </div>
  );
}
