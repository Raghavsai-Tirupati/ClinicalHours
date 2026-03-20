import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const LegacyDashboard = lazy(() => import('@/pages/HospitalDashboard'));

/**
 * Redirects /hospital-dashboard to /hospital/:pageId
 * by looking up the user's hospital_pages record via admin_email.
 *
 * If no hospital_pages record exists but the user has a hospital_members
 * record (old system), auto-creates a hospital_pages record to bridge them
 * to the new dashboard.
 *
 * Falls back to the old HospitalDashboard if neither system matches.
 */
export default function HospitalDashboardRedirect() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [useLegacy, setUseLegacy] = useState(false);

  useEffect(() => {
    if (authLoading || !user?.email) return;

    const lookup = async () => {
      // 1. Check if user already has a hospital_pages record
      const { data: page } = await supabase
        .from('hospital_pages')
        .select('id')
        .eq('admin_email', user.email!)
        .limit(1)
        .maybeSingle();

      if (page) {
        navigate(`/hospital/${page.id}`, { replace: true });
        return;
      }

      // 2. No hospital_pages record — check old system (hospital_members)
      const { data: member } = await supabase
        .from('hospital_members')
        .select(`
          account_id,
          hospital_accounts (
            hospital_id
          )
        `)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (member) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = member.hospital_accounts as any;
        const hospitalId = account?.hospital_id;

        if (hospitalId) {
          // Check if a hospital_pages record already exists for this hospital
          const { data: existingPage } = await supabase
            .from('hospital_pages')
            .select('id')
            .eq('hospital_id', hospitalId)
            .limit(1)
            .maybeSingle();

          if (existingPage) {
            // Page exists but with a different admin email — redirect anyway
            navigate(`/hospital/${existingPage.id}`, { replace: true });
            return;
          }

          // Auto-create a hospital_pages record to bridge old → new system
          const { data: newPage, error: createError } = await supabase
            .from('hospital_pages')
            .insert({
              hospital_id: hospitalId,
              admin_email: user.email!.toLowerCase(),
              is_claimed: true,
              claimed_at: new Date().toISOString(),
              created_by: user.id,
            })
            .select('id')
            .single();

          if (!createError && newPage) {
            navigate(`/hospital/${newPage.id}`, { replace: true });
            return;
          }
        }
      }

      // 3. Neither system matched — show legacy dashboard
      setUseLegacy(true);
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
