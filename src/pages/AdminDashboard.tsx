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
  Clock,
  BarChart3,
  Wrench,
  Radio,
  ImageIcon,
  Ghost,
  Crown,
  Laptop,
} from 'lucide-react';
import { TabErrorBoundary } from '@/components/admin/TabErrorBoundary';
import AdminOverviewTab from '@/components/admin/AdminOverviewTab';
import AdminUserList from '@/components/admin/AdminUserList';
import AdminHospitalsTab from '@/components/admin/AdminHospitalsTab';
import AdminPendingApprovalsTab from '@/components/admin/AdminPendingApprovalsTab';
import AdminToolsTab from '@/components/admin/AdminToolsTab';
import { AdminActivityTab } from '@/components/admin/AdminActivityTab';
import AdminLogosTab from '@/components/admin/AdminLogosTab';
import GuestSessionsTab from '@/components/admin/GuestSessionsTab';
import AdminPremiumTab from '@/components/admin/AdminPremiumTab';
import AdminHospitalConsoleTab from '@/components/admin/AdminHospitalConsoleTab';

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
          {/* Header */}
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

          {/* Tabs — consolidated admin tools */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="flex h-auto w-full max-w-full min-w-0 flex-nowrap items-stretch justify-start gap-1 overflow-x-auto overflow-y-hidden rounded-md bg-muted p-1 [-webkit-overflow-scrolling:touch]">
              <TabsTrigger value="overview" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <BarChart3 className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Users className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Students</span>
              </TabsTrigger>
              <TabsTrigger value="hospitals" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Hospitals</span>
              </TabsTrigger>
              <TabsTrigger value="clinic-consoles" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Laptop className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Clinic admin</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Clock className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Pending</span>
                {pendingCount > 0 && (
                  <Badge className="ml-0.5 h-5 min-w-[1.25rem] shrink-0 bg-yellow-500 px-1.5 py-0 text-xs text-white">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Wrench className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Tools</span>
              </TabsTrigger>
              <TabsTrigger value="logos" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <ImageIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Logos</span>
              </TabsTrigger>
              <TabsTrigger value="guest-sessions" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Ghost className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Guests</span>
              </TabsTrigger>
              <TabsTrigger value="premium" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Crown className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Premium</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex shrink-0 items-center gap-2 px-2.5 sm:px-3">
                <Radio className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <TabErrorBoundary tabName="Overview">
                <AdminOverviewTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="students">
              <TabErrorBoundary tabName="Students">
                <AdminUserList />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="hospitals">
              <TabErrorBoundary tabName="Hospitals">
                <AdminHospitalsTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="clinic-consoles">
              <TabErrorBoundary tabName="Clinic admin">
                <AdminHospitalConsoleTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="pending">
              <TabErrorBoundary tabName="Pending Approvals">
                <AdminPendingApprovalsTab onPendingCountChange={setPendingCount} />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="tools">
              <TabErrorBoundary tabName="Tools">
                <AdminToolsTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="logos">
              <TabErrorBoundary tabName="Logos">
                <AdminLogosTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="guest-sessions">
              <TabErrorBoundary tabName="Guest Sessions">
                <GuestSessionsTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="premium">
              <TabErrorBoundary tabName="Premium">
                <AdminPremiumTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="activity">
              <TabErrorBoundary tabName="Activity">
                <AdminActivityTab />
              </TabErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </>
  );
}
