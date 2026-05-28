import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Users,
  Building2,
  Briefcase,
  Clock,
  Activity,
  RefreshCw,
  Globe,
  Ghost,
  UserPlus,
} from 'lucide-react';
import GuestSessionStats from './GuestSessionStats';
import ActivityFeed from './ActivityFeed';

interface OverviewStats {
  totalStudents: number;
  approvedHospitals: number;
  pendingHospitals: number;
  rejectedHospitals: number;
  totalOpportunities: number;
  totalHoursLogged: number;
  activeUsers30d: number;
}

interface FunnelStats {
  landingVisitorsToday: number;
  guestSessionsToday: number;
  newSignupsToday: number;
}

export default function AdminOverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startOfTodayIso = startOfToday.toISOString();

      const [
        { count: totalStudents },
        { count: approvedHospitals },
        { count: pendingHospitals },
        { count: rejectedHospitals },
        { count: totalOpportunities },
        { data: hoursData },
        { data: activeUsers30dData },
        { data: landingEvents },
        { data: signupEvents },
        { data: guestSessionsTodayData },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'approved'),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'rejected'),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }),
        supabase.from('experience_entries').select('hours'),
        supabase
          .from('tracking_events')
          .select('user_id')
          .not('user_id', 'is', null)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('tracking_events')
          .select('session_id, created_at, page_url, event_type')
          .eq('event_type', 'page_view')
          .eq('page_url', '/')
          .gte('created_at', startOfTodayIso),
        supabase
          .from('tracking_events')
          .select('user_id, created_at, event_type')
          .eq('event_type', 'signup')
          .gte('created_at', startOfTodayIso),
        supabase
          .from('guest_sessions')
          .select('session_id, created_at')
          .gte('created_at', startOfTodayIso),
      ]);

      const totalHoursLogged = (hoursData || []).reduce((sum, e) => sum + (e.hours ?? 0), 0);
      const activeUsers30d = new Set((activeUsers30dData ?? []).map((e: { user_id: string }) => e.user_id)).size;

      setStats({
        totalStudents: totalStudents ?? 0,
        approvedHospitals: approvedHospitals ?? 0,
        pendingHospitals: pendingHospitals ?? 0,
        rejectedHospitals: rejectedHospitals ?? 0,
        totalOpportunities: totalOpportunities ?? 0,
        totalHoursLogged,
        activeUsers30d,
      });

      const landingSessionIds = new Set<string>();
      (landingEvents || []).forEach((row: { session_id: string | null }) => {
        if (row.session_id) {
          landingSessionIds.add(row.session_id);
        }
      });

      const signupUserIds = new Set<string>();
      (signupEvents || []).forEach((row: { user_id: string | null }) => {
        if (row.user_id) {
          signupUserIds.add(row.user_id);
        }
      });

      const guestSessionIdsToday = new Set<string>();
      (guestSessionsTodayData || []).forEach((row: { session_id: string | null }) => {
        if (row.session_id) {
          guestSessionIdsToday.add(row.session_id);
        }
      });

      setFunnel({
        landingVisitorsToday: landingSessionIds.size,
        guestSessionsToday: guestSessionIdsToday.size,
        newSignupsToday: signupUserIds.size,
      });
    } catch (err) {
      console.error('Error fetching overview stats:', err);
      // Keep any existing stats but ensure funnel snapshot falls back to zeroed values
      setFunnel((prev) => prev ?? { landingVisitorsToday: 0, guestSessionsToday: 0, newSignupsToday: 0 });
    } finally {
      setLoading(false);
    }
  }

  const statCards = stats
    ? [
        {
          label: 'Total Students',
          value: stats.totalStudents,
          icon: Users,
          color: 'text-blue-400',
          bg: 'bg-blue-400/10',
        },
        {
          label: 'Approved Hospitals',
          value: stats.approvedHospitals,
          icon: Building2,
          color: 'text-green-400',
          bg: 'bg-green-400/10',
        },
        {
          label: 'Pending Hospitals',
          value: stats.pendingHospitals,
          icon: Building2,
          color: 'text-yellow-400',
          bg: 'bg-yellow-400/10',
        },
        {
          label: 'Rejected Hospitals',
          value: stats.rejectedHospitals,
          icon: Building2,
          color: 'text-red-400',
          bg: 'bg-red-400/10',
        },
        {
          label: 'Opportunities',
          value: stats.totalOpportunities,
          icon: Briefcase,
          color: 'text-purple-400',
          bg: 'bg-purple-400/10',
        },
        {
          label: 'Clinical Hours Logged',
          value: Math.round(stats.totalHoursLogged),
          icon: Clock,
          color: 'text-teal-400',
          bg: 'bg-teal-400/10',
        },
        {
          label: 'Active Users (30d)',
          value: stats.activeUsers30d,
          icon: Activity,
          color: 'text-pink-400',
          bg: 'bg-pink-400/10',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {/* Funnel snapshot (today) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {(funnel?.landingVisitorsToday ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Landing visitors (today)</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Ghost className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {(funnel?.guestSessionsToday ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Guest sessions started (today)</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">
              {(funnel?.newSignupsToday ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-1">New signups (today)</p>
          </CardContent>
        </Card>
      </div>

      {/* Stats grid */}
      {loading && !stats ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="bg-card border-border">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {card.value.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Live Activity Stream + Guest Session Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Live Activity Stream
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed />
          </CardContent>
        </Card>

        <div>
          <GuestSessionStats />
        </div>
      </div>
    </div>
  );
}
