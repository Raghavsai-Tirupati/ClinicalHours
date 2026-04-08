import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, ClipboardCheck, FolderOpen, Settings2, Table as TableIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useClinicRoles, useClinicMembers } from './hooks';
import MembersTab from './MembersTab';
import ManageRolesPanel from './ManageRolesPanel';
import OnboardingTracker from './OnboardingTracker';
import FileSystem from './FileSystem';
import VolunteerTracker from '../volunteer-tracker/VolunteerTracker';

export default function VolunteerManagement() {
  const { hospitalPage } = useHospitalPageContext();
  const rawId = hospitalPage?.id;
  // virtual- IDs are placeholders when the hospital page hasn't been provisioned yet
  const clinicId = rawId && !rawId.startsWith('virtual-') ? rawId : undefined;

  const { roles, loading: rolesLoading, refetch: refetchRoles, seedDefaults: seedRoleDefaults } = useClinicRoles(clinicId);
  const { members, loading: membersLoading, refetch: refetchMembers } = useClinicMembers(clinicId);

  // Support ?tab=tracker for legacy /volunteer-tracker redirects.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') ?? 'members';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const qp = searchParams.get('tab');
    if (qp && qp !== activeTab) setActiveTab(qp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleTabChange = (next: string) => {
    setActiveTab(next);
    // Keep the URL query in sync so deep links work.
    const nextParams = new URLSearchParams(searchParams);
    if (next === 'members') nextParams.delete('tab');
    else nextParams.set('tab', next);
    setSearchParams(nextParams, { replace: true });
  };

  if (!clinicId) return (
    <div className="rounded-lg border border-dashed border-border p-12 text-center">
      <p className="text-sm text-muted-foreground">
        Volunteer management is not available yet. Please reload the page or contact support if this persists.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Volunteer Management</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your team roster, onboarding, and documents
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="members" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-1.5 text-xs">
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Onboarding</span>
          </TabsTrigger>
          <TabsTrigger value="tracker" className="gap-1.5 text-xs">
            <TableIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tracker</span>
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5 text-xs">
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Files</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-1.5 text-xs">
            <Settings2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Roles</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-6">
          <MembersTab
            clinicId={clinicId}
            members={members}
            roles={roles}
            loading={membersLoading || rolesLoading}
            onRefresh={refetchMembers}
          />
        </TabsContent>

        <TabsContent value="onboarding" className="mt-6">
          <OnboardingTracker
            clinicId={clinicId}
            members={members}
            onRefreshMembers={refetchMembers}
          />
        </TabsContent>

        <TabsContent value="tracker" className="mt-6">
          <VolunteerTracker />
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          <FileSystem clinicId={clinicId} members={members} />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <ManageRolesPanel
            clinicId={clinicId}
            roles={roles}
            onRefresh={refetchRoles}
            onSeedDefaults={seedRoleDefaults}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
