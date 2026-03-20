import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { HospitalPageWithOpportunity } from '@/types/positions';

/**
 * Finds the hospital page for the current user.
 * 1. Checks hospital_pages by admin_email match
 * 2. Falls back to hospital_members → hospital_accounts → opportunities
 *    to build a HospitalPageWithOpportunity without requiring a hospital_pages record.
 */
export function useHospitalPageByUser() {
  const { user, loading: authLoading } = useAuth();
  const [hospitalPage, setHospitalPage] = useState<HospitalPageWithOpportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  const fetchPage = useCallback(async () => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try hospital_pages by admin_email
      const { data: page } = await supabase
        .from('hospital_pages')
        .select(`
          id, hospital_id, admin_email, is_claimed, claimed_at, created_at, created_by,
          opportunities:hospital_id (id, name, location, type, website, logo_url, description)
        `)
        .eq('admin_email', user.email!)
        .limit(1)
        .maybeSingle();

      if (page) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const opp = (page as any).opportunities;
        setPageId(page.id);
        setHospitalPage({
          id: page.id,
          hospital_id: page.hospital_id,
          admin_email: page.admin_email,
          is_claimed: page.is_claimed,
          claimed_at: page.claimed_at,
          created_at: page.created_at,
          created_by: page.created_by,
          opportunity: {
            id: opp?.id || page.hospital_id,
            name: opp?.name || 'Unknown Hospital',
            location: opp?.location || '',
            type: opp?.type || '',
            website: opp?.website || null,
            logo_url: opp?.logo_url || null,
            description: opp?.description || null,
          },
        });
        return;
      }

      // 2. Fall back to hospital_members → hospital_accounts → hospitals
      //    Then look up the opportunity by hospitals.id
      const { data: member } = await supabase
        .from('hospital_members')
        .select(`
          id,
          account_id,
          hospital_accounts (
            hospital_id,
            hospitals:hospital_id (id, name, website)
          )
        `)
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (member) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = member.hospital_accounts as any;
        const hospitalId = account?.hospital_id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const hospital = account?.hospitals as any;

        if (hospitalId) {
          // Find the opportunity linked to this hospital
          const { data: opp } = await supabase
            .from('opportunities')
            .select('id, name, location, type, website, logo_url, description')
            .eq('hospital_id', hospitalId)
            .limit(1)
            .maybeSingle();

          // Check if a hospital_pages record exists, or auto-create one
          const opportunityId = opp?.id;
          let realPageId: string | null = null;

          if (opportunityId) {
            const { data: existingPage } = await supabase
              .from('hospital_pages')
              .select('id')
              .eq('hospital_id', opportunityId)
              .limit(1)
              .maybeSingle();

            if (existingPage) {
              realPageId = existingPage.id;
            } else {
              // Auto-create hospital_pages record so positions can reference it
              const { data: newPage, error: insertError } = await supabase
                .from('hospital_pages')
                .insert({
                  hospital_id: opportunityId,
                  admin_email: user.email!,
                  is_claimed: true,
                  created_by: user.id,
                })
                .select('id')
                .single();

              if (insertError) {
                console.error('Failed to auto-create hospital_pages:', insertError.message);
              }
              realPageId = newPage?.id || null;
            }
          }

          const pageIdToUse = realPageId || `virtual-${hospitalId}`;
          setPageId(realPageId);

          setHospitalPage({
            id: pageIdToUse,
            hospital_id: opportunityId || hospitalId,
            admin_email: user.email!,
            is_claimed: true,
            claimed_at: null,
            created_at: new Date().toISOString(),
            created_by: user.id,
            opportunity: {
              id: opportunityId || hospitalId,
              name: opp?.name || hospital?.name || 'Unknown Hospital',
              location: opp?.location || '',
              type: opp?.type || '',
              website: opp?.website || hospital?.website || null,
              logo_url: opp?.logo_url || null,
              description: opp?.description || null,
            },
          });
          return;
        }
      }

      // 3. Nothing found
      setError('No hospital found for your account');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hospital page');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchPage();
    }
  }, [authLoading, fetchPage]);

  return { hospitalPage, loading: loading || authLoading, error, refetch: fetchPage, pageId };
}
