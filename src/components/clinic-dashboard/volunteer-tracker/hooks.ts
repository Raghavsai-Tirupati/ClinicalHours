import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  TrackerCategory,
  TrackerColumn,
  TrackerEntry,
  TrackerValue,
} from './types';

// ── Categories ────────────────────────────────────────────────

export function useTrackerCategories(clinicId: string | undefined) {
  const [categories, setCategories] = useState<TrackerCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('volunteer_tracker_categories')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('sort_order');
    setCategories((data as TrackerCategory[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (name: string, color: string) => {
    if (!clinicId) return;
    const maxSort = categories.length > 0 ? Math.max(...categories.map(c => c.sort_order)) + 1 : 0;
    const { error } = await supabase
      .from('volunteer_tracker_categories')
      .insert({ clinic_id: clinicId, name, color, sort_order: maxSort });
    if (!error) await fetch();
    return error;
  }, [clinicId, categories, fetch]);

  const update = useCallback(async (id: string, updates: Partial<Pick<TrackerCategory, 'name' | 'color' | 'sort_order'>>) => {
    const { error } = await supabase
      .from('volunteer_tracker_categories')
      .update(updates)
      .eq('id', id);
    if (!error) await fetch();
    return error;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('volunteer_tracker_categories')
      .delete()
      .eq('id', id);
    if (!error) await fetch();
    return error;
  }, [fetch]);

  return { categories, loading, refetch: fetch, add, update, remove };
}

// ── Columns ───────────────────────────────────────────────────

export function useTrackerColumns(clinicId: string | undefined) {
  const [columns, setColumns] = useState<TrackerColumn[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('volunteer_tracker_columns')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('sort_order');
    setColumns((data as TrackerColumn[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (name: string, column_type: string) => {
    if (!clinicId) return;
    const maxSort = columns.length > 0 ? Math.max(...columns.map(c => c.sort_order)) + 1 : 0;
    const { error } = await supabase
      .from('volunteer_tracker_columns')
      .insert({ clinic_id: clinicId, name, column_type, sort_order: maxSort });
    if (!error) await fetch();
    return error;
  }, [clinicId, columns, fetch]);

  const update = useCallback(async (id: string, updates: Partial<Pick<TrackerColumn, 'name' | 'column_type' | 'sort_order'>>) => {
    const { error } = await supabase
      .from('volunteer_tracker_columns')
      .update(updates)
      .eq('id', id);
    if (!error) await fetch();
    return error;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('volunteer_tracker_columns')
      .delete()
      .eq('id', id);
    if (!error) await fetch();
    return error;
  }, [fetch]);

  return { columns, loading, refetch: fetch, add, update, remove };
}

// ── Entries ───────────────────────────────────────────────────

export function useTrackerEntries(clinicId: string | undefined) {
  const [entries, setEntries] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('volunteer_tracker_entries')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('sort_order');
    setEntries((data as TrackerEntry[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = useCallback(async (category_id: string, volunteer_name: string, volunteer_user_id?: string | null) => {
    if (!clinicId) return;
    const catEntries = entries.filter(e => e.category_id === category_id);
    const maxSort = catEntries.length > 0 ? Math.max(...catEntries.map(e => e.sort_order)) + 1 : 0;
    const { error } = await supabase
      .from('volunteer_tracker_entries')
      .insert({
        clinic_id: clinicId,
        category_id,
        volunteer_name,
        volunteer_user_id: volunteer_user_id || null,
        sort_order: maxSort,
      });
    if (!error) await fetch();
    return error;
  }, [clinicId, entries, fetch]);

  const update = useCallback(async (id: string, updates: Partial<Pick<TrackerEntry, 'volunteer_name' | 'category_id' | 'sort_order'>>) => {
    const { error } = await supabase
      .from('volunteer_tracker_entries')
      .update(updates)
      .eq('id', id);
    if (!error) await fetch();
    return error;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('volunteer_tracker_entries')
      .delete()
      .eq('id', id);
    if (!error) await fetch();
    return error;
  }, [fetch]);

  return { entries, loading, refetch: fetch, add, update, remove };
}

// ── Values ────────────────────────────────────────────────────

export function useTrackerValues(entryIds: string[]) {
  const [values, setValues] = useState<TrackerValue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (entryIds.length === 0) {
      setValues([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('volunteer_tracker_values')
      .select('*')
      .in('entry_id', entryIds);
    setValues((data as TrackerValue[]) || []);
    setLoading(false);
  }, [entryIds.join(',')]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsert = useCallback(async (entry_id: string, column_id: string, value: string | null) => {
    const { error } = await supabase
      .from('volunteer_tracker_values')
      .upsert(
        { entry_id, column_id, value },
        { onConflict: 'entry_id,column_id' }
      );
    if (!error) {
      // Optimistic local update
      setValues(prev => {
        const existing = prev.findIndex(v => v.entry_id === entry_id && v.column_id === column_id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = { ...next[existing], value };
          return next;
        }
        return [...prev, { id: crypto.randomUUID(), entry_id, column_id, value }];
      });
    }
    return error;
  }, []);

  return { values, loading, refetch: fetch, upsert };
}
