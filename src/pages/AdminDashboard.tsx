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
  BarChart3,
  Wrench,
  Laptop,
  Zap,
} from 'lucide-react';
import { TabErrorBoundary } from '@/components/admin/TabErrorBoundary';
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminFunnelTab from '@/components/admin/AdminFunnelTab';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminHospitalsTab from '@/components/admin/AdminHospitalsTab';
import AdminAutomationTab from '@/components/admin/AdminAutomationTab';
import AdminHospitalConsoleTab from '@/components/admin/AdminHospitalConsoleTab';
import AdminToolsTab from '@/components/admin/AdminToolsTab';
import AdminChatbot from '@/components/admin/AdminChatbot';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Navigation />

      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto max-w-7xl px-3 sm:px-4">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold sm:gap-3 sm:text-3xl">
                <Shield className="h-7 w-7 shrink-0 text-primary sm:h-8 sm:w-8" />
                <span className="break-words">Admin Dashboard</span>
              </h1>
              <p className="text-muted-foreground mt-1 text-pretty break-words">
                Platform management and oversight
              </p>
            </div>
            <Badge variant="outline" className="w-fit max-w-full whitespace-normal break-all text-left text-sm leading-snug sm:max-w-sm">
              {user?.email}
            </Badge>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="flex h-auto w-full flex-wrap items-stretch justify-start gap-1 rounded-md bg-muted p-1">
              <TabsTrigger value="dashboard" className="flex shrink-0 items-center gap-2 px-3">
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span>Dashboard</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex shrink-0 items-center gap-2 px-3">
                <Users className="h-4 w-4 shrink-0" />
                <span>Users</span>
              </TabsTrigger>
              <TabsTrigger value="hospitals" className="flex shrink-0 items-center gap-2 px-3">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Hospitals</span>
                {pendingCount > 0 && (
                  <Badge className="ml-0.5 h-5 min-w-[1.25rem] shrink-0 bg-yellow-500 px-1.5 py-0 text-xs text-white">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="automation" className="flex shrink-0 items-center gap-2 px-3">
                <Zap className="h-4 w-4 shrink-0" />
                <span>Automation</span>
              </TabsTrigger>
              <TabsTrigger value="supply" className="flex shrink-0 items-center gap-2 px-3">
                <Laptop className="h-4 w-4 shrink-0" />
                <span>Supply</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex shrink-0 items-center gap-2 px-3">
                <Wrench className="h-4 w-4 shrink-0" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard">
              <TabErrorBoundary tabName="Dashboard">
                <div className="space-y-8">
                  <AdminOverviewTab />
                  <AdminFunnelTab />
                </div>
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="users">
              <TabErrorBoundary tabName="Users">
                <AdminUsersTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="hospitals">
              <TabErrorBoundary tabName="Hospitals">
                <AdminHospitalsTab onPendingCountChange={setPendingCount} />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="automation">
              <TabErrorBoundary tabName="Automation">
                <AdminAutomationTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="supply">
              <TabErrorBoundary tabName="Supply">
                <AdminHospitalConsoleTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="settings">
              <TabErrorBoundary tabName="Settings">
                <AdminToolsTab />
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
