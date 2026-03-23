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
  Trash2,
  FilePlus,
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
import AdminDeletionEventsTab from '@/components/admin/AdminDeletionEventsTab';
import AdminCreateHospitalPageTab from '@/components/admin/AdminCreateHospitalPageTab';

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
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Platform management and oversight
              </p>
            </div>
            <Badge variant="outline" className="text-sm">
              {user?.email}
            </Badge>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-10">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Students</span>
              </TabsTrigger>
              <TabsTrigger value="hospitals" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline">Hospitals</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Pending</span>
                {pendingCount > 0 && (
                  <Badge className="bg-yellow-500 text-white text-xs px-1.5 py-0 ml-0.5 h-5 min-w-[1.25rem]">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tools" className="flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                <span className="hidden sm:inline">Tools</span>
              </TabsTrigger>
              <TabsTrigger value="logos" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Logos</span>
              </TabsTrigger>
              <TabsTrigger value="pages" className="flex items-center gap-2">
                <FilePlus className="h-4 w-4" />
                <span className="hidden sm:inline">Pages</span>
              </TabsTrigger>
              <TabsTrigger value="guest-sessions" className="flex items-center gap-2">
                <Ghost className="h-4 w-4" />
                <span className="hidden sm:inline">Guests</span>
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-2">
                <Radio className="h-4 w-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
              <TabsTrigger value="deletions" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Deletions</span>
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

            <TabsContent value="pages">
              <TabErrorBoundary tabName="Hospital Pages">
                <AdminCreateHospitalPageTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="guest-sessions">
              <TabErrorBoundary tabName="Guest Sessions">
                <GuestSessionsTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="activity">
              <TabErrorBoundary tabName="Activity">
                <AdminActivityTab />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="deletions">
              <TabErrorBoundary tabName="Deletions">
                <AdminDeletionEventsTab />
              </TabErrorBoundary>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Footer />
    </>
  );
}