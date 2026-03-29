import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { EmailTemplate, EmailSendLog } from './types';

// ── Email Templates ─────────────────────────────────────────

export function useEmailTemplates(clinicId: string | undefined) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('category')
      .order('name');
    setTemplates((data as EmailTemplate[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { templates, loading, refetch: fetch };
}

// ── Email Send Logs ─────────────────────────────────────────

export function useEmailSendLogs(clinicId: string | undefined) {
  const [logs, setLogs] = useState<EmailSendLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!clinicId) return;
    setLoading(true);
    const { data } = await supabase
      .from('email_send_logs')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('created_at', { ascending: false })
      .limit(50);
    setLogs((data as EmailSendLog[]) || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { logs, loading, refetch: fetch };
}
