import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record: Record<string, unknown>;
  userId?: string;
}

const MAX_EVENTS = 200;

export function useActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    function addEvent(table: string, payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) {
      const event: ActivityEvent = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        table,
        action: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        record: payload.new || payload.old,
        userId: (payload.new?.user_id || payload.new?.id || payload.old?.user_id) as string | undefined,
      };
      setEvents(prev => [event, ...prev].slice(0, MAX_EVENTS));
    }

    const channel = supabase
      .channel('admin-activity-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        addEvent('profiles', payload as Parameters<typeof addEvent>[1]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hospital_accounts' }, (payload) => {
        addEvent('hospital_accounts', payload as Parameters<typeof addEvent>[1]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'saved_opportunities' }, (payload) => {
        addEvent('saved_opportunities', payload as Parameters<typeof addEvent>[1]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'experience_entries' }, (payload) => {
        addEvent('experience_entries', payload as Parameters<typeof addEvent>[1]);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { events, isConnected };
}
