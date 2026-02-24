import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, Building2, Briefcase, FileText, Clock, Activity, RefreshCw } from 'lucide-react';
import GuestSessionStats from './GuestSessionStats';

interface OverviewStats {
  totalStudents: number;
  approvedHospitals: number;
  pendingHospitals: number;
  rejectedHospitals: number;
  totalOpportunities: number;
  totalApplications: number;
  totalHoursLogged: number;
  activeUsers7d: number;
  activeUsers30d: number;
}

export default function AdminOverviewTab() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const [
        { count: totalStudents },
        { count: approvedHospitals },
        { count: pendingHospitals },
        { count: rejectedHospitals },
        { count: totalOpportunities },
        { count: totalApplications },
        { data: hoursData },
        { count: activeUsers7d },
        { count: activeUsers30d },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'approved'),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'pending'),
        supabase.from('hospital_accounts').select('*', { count: 'exact', head: true }).eq('account_status', 'rejected'),
        supabase.from('opportunities').select('*', { count: 'exact', head: true }),
        supabase.from('applications').select('*', { count: 'exact', head: true }),
        supabase.from('experience_entries').select('hours'),
        supabase
          .from('tracking_events')
          .select('*', { count: 'exact', head: true })
          .not('user_id', 'is', null)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('tracking_events')
          .select('*', { count: 'exact', head: true })
          .not('user_id', 'is', null)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const totalHoursLogged = (hoursData || []).reduce((sum, e) => sum + (e.hours ?? 0), 0);

      setStats({
        totalStudents: totalStudents ?? 0,
        approvedHospitals: approvedHospitals ?? 0,
        pendingHospitals: pendingHospitals ?? 0,
        rejectedHospitals: rejectedHospitals ?? 0,
        totalOpportunities: totalOpportunities ?? 0,
        totalApplications: totalApplications ?? 0,
        totalHoursLogged,
        activeUsers7d: activeUsers7d ?? 0,
        activeUsers30d: activeUsers30d ?? 0,
      });
    } catch (err) {
      console.error('Error fetching overview stats:', err);
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
          label: 'Applications',
          value: stats.totalApplications,
          icon: FileText,
          color: 'text-orange-400',
          bg: 'bg-orange-400/10',
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

      {/* Guest session / activity chart */}
      <GuestSessionStats />
    </div>
  );
}
