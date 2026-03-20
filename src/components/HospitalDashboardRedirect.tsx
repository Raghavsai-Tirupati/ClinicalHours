import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const LegacyDashboard = lazy(() => import('@/pages/HospitalDashboard'));

/**
 * Redirects /hospital-dashboard to /hospital/:pageId
 * by looking up the user's hospital_pages record via admin_email.
 * Falls back to the old HospitalDashboard if no hospital_pages record exists.
 */
export default function HospitalDashboardRedirect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [useLegacy, setUseLegacy] = useState(false);

  useEffect(() => {
    if (authLoading || !user?.email) return;

    const lookup = async () => {
      const { data } = await supabase
        .from('hospital_pages')
        .select('id')
        .eq('admin_email', user.email!)
        .limit(1)
        .maybeSingle();

      if (data) {
        navigate(`/hospital/${data.id}`, { replace: true });
      } else {
        setUseLegacy(true);
      }
    };
    lookup();
  }, [user, authLoading, navigate]);

  if (useLegacy) {
    return (
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <LegacyDashboard />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
