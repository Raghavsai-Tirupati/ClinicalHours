import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WaitlistSubmission, WaitlistSettings } from '@/components/waitlist/types';

export function useWaitlistSubmissions(clinicId: string | undefined) {
  const [submissions, setSubmissions] = useState<WaitlistSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('waitlist_submissions')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('submitted_at', { ascending: false });

    if (!error && data) setSubmissions(data as WaitlistSubmission[]);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  // Realtime subscription
  useEffect(() => {
    if (!clinicId) return;

    const channel = supabase
      .channel(`waitlist-${clinicId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'waitlist_submissions',
          filter: `clinic_id=eq.${clinicId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setSubmissions((prev) => [payload.new as WaitlistSubmission, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setSubmissions((prev) =>
              prev.map((s) => (s.id === (payload.new as WaitlistSubmission).id ? (payload.new as WaitlistSubmission) : s)),
            );
          } else if (payload.eventType === 'DELETE') {
            setSubmissions((prev) => prev.filter((s) => s.id !== (payload.old as { id: string }).id));
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clinicId]);

  return { submissions, loading, refetch: fetch };
}

export function useWaitlistSettings(clinicId: string | undefined) {
  const [settings, setSettings] = useState<WaitlistSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('waitlist_settings')
      .select('*')
      .eq('clinic_id', clinicId)
      .maybeSingle();

    if (!error && data) setSettings(data as WaitlistSettings);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createSettings = useCallback(async (slug: string) => {
    if (!clinicId) return null;
    const { data, error } = await supabase
      .from('waitlist_settings')
      .insert({ clinic_id: clinicId, slug, is_open: true })
      .select()
      .single();
    if (error) throw error;
    const ws = data as WaitlistSettings;
    setSettings(ws);
    return ws;
  }, [clinicId]);

  const updateSettings = useCallback(async (updates: Partial<Pick<WaitlistSettings, 'is_open' | 'welcome_message' | 'slug'>>) => {
    if (!settings) return;
    const { data, error } = await supabase
      .from('waitlist_settings')
      .update(updates)
      .eq('id', settings.id)
      .select()
      .single();
    if (error) throw error;
    setSettings(data as WaitlistSettings);
  }, [settings]);

  return { settings, loading, refetch: fetch, createSettings, updateSettings };
}
