import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, UserPlus, LogIn, GraduationCap, MapPin } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface RecentSignup {
  id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
}

interface RecentLogin {
  id: string;
  user_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
  profile_name: string | null;
  profile_university: string | null;
}

export default function AdminStudentsTab() {
  const [signups, setSignups] = useState<RecentSignup[]>([]);
  const [logins, setLogins] = useState<RecentLogin[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: recentSignups }, { data: loginEvents }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, university, major, city, state, created_at')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('tracking_events')
          .select('id, user_id, created_at, metadata')
          .eq('event_type', 'login')
          .not('user_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setSignups((recentSignups ?? []) as RecentSignup[]);

      if (loginEvents && loginEvents.length > 0) {
        const userIds = [...new Set(loginEvents.map((e) => e.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, university')
          .in('id', userIds);
        const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string | null; university: string | null }) => [p.id, p]));
        setLogins(
          (loginEvents as { id: string; user_id: string; created_at: string; metadata: Record<string, unknown> }[]).map((e) => ({
            id: e.id,
            user_id: e.user_id,
            created_at: e.created_at,
            metadata: e.metadata,
            profile_name: profileMap.get(e.user_id)?.full_name ?? null,
            profile_university: profileMap.get(e.user_id)?.university ?? null,
          }))
        );
      } else {
        setLogins([]);
      }
    } catch (err) {
      console.error('Error fetching student data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Students</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Recent account activity</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-400" />
              Recent Signups
              <Badge variant="outline" className="ml-auto text-[10px]">{signups.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : signups.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No signups yet.</p>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="divide-y divide-border/40">
                  {signups.map((s) => (
                    <div key={s.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-400/10 flex items-center justify-center text-sm font-bold text-emerald-400 shrink-0">
                        {s.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.full_name ?? 'Unnamed'}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {s.university && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <GraduationCap className="h-3 w-3" />
                              {s.university}
                            </span>
                          )}
                          {(s.city || s.state) && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" />
                              {[s.city, s.state].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {format(new Date(s.created_at), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Logins */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <LogIn className="h-4 w-4 text-blue-400" />
              Recent Logins
              <Badge variant="outline" className="ml-auto text-[10px]">{logins.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : logins.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No login events recorded.</p>
            ) : (
              <ScrollArea className="h-[420px]">
                <div className="divide-y divide-border/40">
                  {logins.map((l) => (
                    <div key={l.id} className="px-4 py-3 flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-400/10 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                        {l.profile_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{l.profile_name ?? `User ${l.user_id.slice(0, 6)}`}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {l.profile_university && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                              <GraduationCap className="h-3 w-3" />
                              {l.profile_university}
                            </span>
                          )}
                          {l.metadata?.method && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1">
                              {String(l.metadata.method)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60">
                          {format(new Date(l.created_at), 'MMM d')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
