import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { WaitlistSubmission, WaitlistSettings } from '@/components/waitlist/types';

// Local type for the new `waitlists` table. Not (yet) in generated types.
export interface Waitlist {
  id: string;
  clinic_id: string;
  title: string;
  description: string;
  status: 'open' | 'closed';
  position_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WaitlistInput {
  title: string;
  description: string;
  status?: 'open' | 'closed';
  position_id?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export function useWaitlists(clinicId: string | undefined) {
  const [waitlists, setWaitlists] = useState<Waitlist[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data, error } = await db
      .from('waitlists')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false });
    if (!error && data) setWaitlists(data as Waitlist[]);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createWaitlist = useCallback(async (input: WaitlistInput) => {
    if (!clinicId) throw new Error('No clinic');
    if (!input.title.trim()) throw new Error('Title is required');
    if (!input.description.trim()) throw new Error('Description is required');
    const { data, error } = await db
      .from('waitlists')
      .insert({
        clinic_id: clinicId,
        title: input.title.trim(),
        description: input.description.trim(),
        status: input.status ?? 'open',
        position_id: input.position_id ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    setWaitlists((prev) => [data as Waitlist, ...prev]);
    return data as Waitlist;
  }, [clinicId]);

  const updateWaitlist = useCallback(async (id: string, updates: Partial<WaitlistInput>) => {
    if (updates.title !== undefined && !updates.title.trim()) throw new Error('Title is required');
    if (updates.description !== undefined && !updates.description.trim()) throw new Error('Description is required');
    const { data, error } = await db
      .from('waitlists')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    setWaitlists((prev) => prev.map((w) => (w.id === id ? (data as Waitlist) : w)));
    return data as Waitlist;
  }, []);

  const deleteWaitlist = useCallback(async (id: string) => {
    const { error } = await db.from('waitlists').delete().eq('id', id);
    if (error) throw error;
    setWaitlists((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return { waitlists, loading, refetch: fetch, createWaitlist, updateWaitlist, deleteWaitlist };
}

export function useWaitlistSubmissions(clinicId: string | undefined, waitlistId?: string) {
  const [submissions, setSubmissions] = useState<WaitlistSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    let query = supabase
      .from('waitlist_submissions')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('submitted_at', { ascending: false });
    if (waitlistId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).eq('waitlist_id', waitlistId);
    }
    const { data, error } = await query;
    if (!error && data) setSubmissions(data as WaitlistSubmission[]);
    setLoading(false);
  }, [clinicId, waitlistId]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel(`waitlist-${clinicId}-${waitlistId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waitlist_submissions', filter: `clinic_id=eq.${clinicId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as WaitlistSubmission & { waitlist_id?: string };
            if (waitlistId && row.waitlist_id !== waitlistId) return;
            setSubmissions((prev) => [row, ...prev]);
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
  }, [clinicId, waitlistId]);

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
