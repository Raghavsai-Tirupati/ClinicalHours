import { Helmet } from 'react-helmet-async';
import { Outlet, useNavigate } from 'react-router-dom';
import { Loader2, AlertTriangle } from 'lucide-react';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useHospitalPageByUser } from '@/hooks/useHospitalPageByUser';
import HospitalPageContext from '@/contexts/HospitalPageContext';
import HospitalTopBar from '@/components/hospital/HospitalTopBar';
import HospitalSidebar from '@/components/hospital/HospitalSidebar';

/**
 * Renders the new hospital dashboard at /hospital-dashboard.
 * Looks up the hospital via hospital_pages (by email) or
 * hospital_members (old system) — no pageId param needed.
 */
export default function HospitalDashboardNew() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hospitalPage, loading, error, refetch, allPages, isSuperAdmin } = useHospitalPageByUser();

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
              {error || 'No hospital found for your account.'}
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

      <HospitalPageContext.Provider value={{ hospitalPage, loading, error, refetch, basePath: '/hospital-dashboard', allPages, isSuperAdmin }}>
        <SidebarProvider>
          <div className="flex min-h-screen w-full min-w-0">
            <HospitalSidebar />
            <SidebarInset>
              <HospitalTopBar />
              <main className="flex-1 min-w-0 p-3 pb-8 sm:p-6 sm:pb-6">
                <Outlet />
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </HospitalPageContext.Provider>
    </>
  );
}
