import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  ClinicRole,
  ClinicMember,
  OnboardingStep,
  OnboardingProgress,
  ClinicFile,
} from './types';

// ── Roles ──────────────────────────────────────────────────────

export function useClinicRoles(clinicId: string | undefined) {
  const [roles, setRoles] = useState<ClinicRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('clinic_roles')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('sort_order');
    setRoles((data as ClinicRole[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const seedDefaults = useCallback(async () => {
    if (!clinicId) return;
    await supabase.rpc('seed_default_clinic_roles', { p_clinic_id: clinicId });
    await fetch();
  }, [clinicId, fetch]);

  return { roles, loading, refetch: fetch, seedDefaults };
}

// ── Members ────────────────────────────────────────────────────

export function useClinicMembers(clinicId: string | undefined) {
  const [members, setMembers] = useState<ClinicMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('clinic_members')
      .select('*, role:clinic_roles(*)')
      .eq('clinic_id', clinicId)
      .order('full_name');
    setMembers((data as ClinicMember[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { members, loading, refetch: fetch };
}

// ── Onboarding Steps ───────────────────────────────────────────

export function useOnboardingSteps(clinicId: string | undefined) {
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('onboarding_steps')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('sort_order');
    setSteps((data as OnboardingStep[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const seedDefaults = useCallback(async () => {
    if (!clinicId) return;
    await supabase.rpc('seed_default_onboarding_steps', { p_clinic_id: clinicId });
    await fetch();
  }, [clinicId, fetch]);

  return { steps, loading, refetch: fetch, seedDefaults };
}

// ── Onboarding Progress ────────────────────────────────────────

export function useOnboardingProgress(memberIds: string[]) {
  const [progress, setProgress] = useState<OnboardingProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (memberIds.length === 0) {
      setProgress([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('onboarding_progress')
      .select('*')
      .in('member_id', memberIds);
    setProgress((data as OnboardingProgress[]) || []);
    setLoading(false);
  }, [memberIds.join(',')]);

  useEffect(() => { fetch(); }, [fetch]);

  return { progress, loading, refetch: fetch };
}

// ── Files ──────────────────────────────────────────────────────

export function useClinicFiles(clinicId: string | undefined, memberId?: string | null) {
  const [files, setFiles] = useState<ClinicFile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    let query = supabase
      .from('clinic_files')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });

    if (memberId === null) {
      // Shared files only
      query = query.is('member_id', null);
    } else if (memberId) {
      // Member-specific files
      query = query.eq('member_id', memberId);
    }
    // If memberId is undefined, fetch all files for the clinic

    const { data } = await query;
    setFiles((data as ClinicFile[]) || []);
    setLoading(false);
  }, [clinicId, memberId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { files, loading, refetch: fetch };
}
