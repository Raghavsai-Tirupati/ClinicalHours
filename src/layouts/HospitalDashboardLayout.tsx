import { Outlet, useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Loader2, AlertTriangle } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useHospitalPage } from '@/hooks/useHospitalPage';
import { useAllHospitalPages } from '@/hooks/useAllHospitalPages';
import { isSuperAdmin } from '@/lib/constants';
import HospitalPageContext from '@/contexts/HospitalPageContext';
import HospitalTopBar from '@/components/hospital/HospitalTopBar';
import HospitalSidebar from '@/components/hospital/HospitalSidebar';

export default function HospitalDashboardLayout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hospitalPage, loading, error, refetch } = useHospitalPage(id);
  const allPages = useAllHospitalPages();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Authentication Required
            </CardTitle>
            <CardDescription>You must be logged in to access this page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/auth')} className="w-full">Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !hospitalPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {error ? 'Error' : 'Not Found'}
            </CardTitle>
            <CardDescription>
              {error || 'This hospital page does not exist.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user email matches admin_email (or super-admin)
  const userEmail = user.email?.toLowerCase();
  const adminEmail = hospitalPage.admin_email.toLowerCase();
  if (!isSuperAdmin(user.email) && userEmail !== adminEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You don't have permission to manage this hospital page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} variant="outline" className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{hospitalPage.opportunity.name} Admin | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <HospitalPageContext.Provider value={{ hospitalPage, loading, error, refetch, basePath: `/hospital/${id}`, allPages, isSuperAdmin: isSuperAdmin(user.email) }}>
        <SidebarProvider>
          <div className="flex min-h-screen w-full">
            <HospitalSidebar />
            <SidebarInset>
              <HospitalTopBar />
              <main className="flex-1 p-6">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </HospitalPageContext.Provider>
    </>
  );
}
