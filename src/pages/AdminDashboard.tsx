import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import Footer from '@/components/Footer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Users,
  Building2,
  Wrench,
  Laptop,
  Zap,
  LayoutDashboard,
  TrendingUp,
  GitBranch,
  HeartPulse,
  MessageSquare,
  DollarSign,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { TabErrorBoundary } from '@/components/admin/TabErrorBoundary';

// Existing tabs (preserved)
import AdminFunnelTab from '@/components/admin/AdminFunnelTab';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminHospitalsTab from '@/components/admin/AdminHospitalsTab';
import AdminAutomationTab from '@/components/admin/AdminAutomationTab';
import AdminHospitalConsoleTab from '@/components/admin/AdminHospitalConsoleTab';
import AdminToolsTab from '@/components/admin/AdminToolsTab';
import AdminChatbot from '@/components/admin/AdminChatbot';
import AdminPremiumTab from '@/components/admin/AdminPremiumTab';
import AdminStudentsTab from '@/components/admin/AdminStudentsTab';

// New tabs
import ControlTowerTab from '@/components/admin/ControlTowerTab';
import ClinicPipelineTab from '@/components/admin/ClinicPipelineTab';
import MessagingTab from '@/components/admin/MessagingTab';
import DataTrustTab from '@/components/admin/DataTrustTab';
import AgentInboxTab from '@/components/admin/AgentInboxTab';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [openApprovalsCount, setOpenApprovalsCount] = useState(0);

  return (
    <>
      <Helmet>
        <title>Admin OS | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Navigation />

      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto max-w-7xl px-3 sm:px-4">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
                <Shield className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
                <span>Admin OS</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                ClinicalHours business operating system
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {openApprovalsCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {openApprovalsCount} approval{openApprovalsCount !== 1 ? 's' : ''} pending
                </Badge>
              )}
              <Badge variant="outline" className="text-sm">
                {user?.email}
              </Badge>
            </div>
          </div>

          <Tabs defaultValue="control-tower" className="space-y-6">
            <TabsList className="flex h-auto w-full flex-wrap items-stretch justify-start gap-1 rounded-md bg-muted p-1">
              <TabsTrigger value="control-tower" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <LayoutDashboard className="h-3.5 w-3.5 shrink-0" />
                <span>Control Tower</span>
                {openApprovalsCount > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-[1rem] shrink-0 bg-red-500 px-1 py-0 text-xs text-white">
                    {openApprovalsCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="students" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span>Students</span>
              </TabsTrigger>

              <TabsTrigger value="growth" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span>Growth</span>
              </TabsTrigger>

              <TabsTrigger value="clinic-pipeline" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <GitBranch className="h-3.5 w-3.5 shrink-0" />
                <span>Clinic Pipeline</span>
              </TabsTrigger>

              <TabsTrigger value="clinic-ops" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span>Clinic Ops</span>
                {pendingCount > 0 && (
                  <Badge className="ml-0.5 h-4 min-w-[1rem] shrink-0 bg-yellow-500 px-1 py-0 text-xs text-white">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger value="supply" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <Laptop className="h-3.5 w-3.5 shrink-0" />
                <span>Supply</span>
              </TabsTrigger>

              <TabsTrigger value="messaging" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span>Messaging</span>
              </TabsTrigger>

              <TabsTrigger value="revenue" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <DollarSign className="h-3.5 w-3.5 shrink-0" />
                <span>Revenue</span>
              </TabsTrigger>

              <TabsTrigger value="data-trust" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Data Trust</span>
              </TabsTrigger>

              <TabsTrigger value="agent-inbox" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <Bot className="h-3.5 w-3.5 shrink-0" />
                <span>Agent Inbox</span>
              </TabsTrigger>

              <TabsTrigger value="settings" className="flex shrink-0 items-center gap-1.5 px-3 text-xs sm:text-sm">
                <Wrench className="h-3.5 w-3.5 shrink-0" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Control Tower */}
            <TabsContent value="control-tower">
              <TabErrorBoundary tabName="Control Tower">
                <ControlTowerTab onOpenApprovalsChange={setOpenApprovalsCount} />
              </TabErrorBoundary>
            </TabsContent>

            {/* Students */}
            <TabsContent value="students">
              <TabErrorBoundary tabName="Students">
                <AdminStudentsTab />
              </TabErrorBoundary>
            </TabsContent>

            {/* Growth — existing funnel + users */}
            <TabsContent value="growth">
              <TabErrorBoundary tabName="Growth">
                <div className="space-y-8">
                  <AdminUsersTab />
                  <AdminFunnelTab />
                </div>
              </TabErrorBoundary>
            </TabsContent>

            {/* Clinic Pipeline — new lead pipeline */}
            <TabsContent value="clinic-pipeline">
              <TabErrorBoundary tabName="Clinic Pipeline">
                <ClinicPipelineTab />
              </TabErrorBoundary>
            </TabsContent>

            {/* Clinic Ops — hospital approvals + management */}
            <TabsContent value="clinic-ops">
              <TabErrorBoundary tabName="Clinic Ops">
                <AdminHospitalsTab onPendingCountChange={setPendingCount} />
              </TabErrorBoundary>
            </TabsContent>

            {/* Supply */}
            <TabsContent value="supply">
              <TabErrorBoundary tabName="Supply">
                <AdminHospitalConsoleTab />
              </TabErrorBoundary>
            </TabsContent>

            {/* Messaging */}
            <TabsContent value="messaging">
              <TabErrorBoundary tabName="Messaging">
                <MessagingTab />
              </TabErrorBoundary>
            </TabsContent>

            {/* Revenue */}
            <TabsContent value="revenue">
              <TabErrorBoundary tabName="Revenue">
                <RevenueTab />
              </TabErrorBoundary>
            </TabsContent>

            {/* Data Trust */}
            <TabsContent value="data-trust">
              <TabErrorBoundary tabName="Data Trust">
                <DataTrustTab />
              </TabErrorBoundary>
            </TabsContent>

            {/* Agent Inbox */}
            <TabsContent value="agent-inbox">
              <TabErrorBoundary tabName="Agent Inbox">
                <AgentInboxTab />
              </TabErrorBoundary>
            </TabsContent>

            {/* Settings — existing tools preserved */}
            <TabsContent value="settings">
              <TabErrorBoundary tabName="Settings">
                <div className="space-y-8">
                  <AdminAutomationTab />
                  <AdminToolsTab />
                </div>
              </TabErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />

      <AdminChatbot />
    </>
  );
}

// Inline Revenue tab (thin wrapper over existing AdminPremiumTab)
function RevenueTab() {
  return (
    <div className="space-y-6">
      <AdminPremiumTab />
    </div>
  );
}
