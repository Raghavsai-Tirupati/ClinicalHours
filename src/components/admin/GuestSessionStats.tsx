import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users,
  RefreshCw,
  Loader2,
  Calendar,
  Clock,
  TrendingUp,
  UserCheck,
  Eye,
  Link2,
  AlertCircle,
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay, startOfWeek, parseISO } from 'date-fns';

interface DailyCount {
  date: string;
  count: number;
}

interface HourlyCount {
  hour: number;
  count: number;
}

interface GuestSession {
  created_at: string;
  converted_to_user_id: string | null;
  referrer: string | null;
  page_views: number | null;
  last_activity: string | null;
}

interface ReferrerCount {
  referrer: string;
  count: number;
}

export default function GuestSessionStats() {
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [weekCount, setWeekCount] = useState<number>(0);
  const [convertedCount, setConvertedCount] = useState<number>(0);
  const [activeSessionsCount, setActiveSessionsCount] = useState<number>(0);
  const [dailyCounts, setDailyCounts] = useState<DailyCount[]>([]);
  const [hourlyCounts, setHourlyCounts] = useState<HourlyCount[]>([]);
  const [topReferrers, setTopReferrers] = useState<ReferrerCount[]>([]);
  const [avgPageViews, setAvgPageViews] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<string | null>(null);

  // Get user's timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  async function fetchStats() {
    setLoading(true);
    setError(null);
    setDiagnosticInfo(null);
    try {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const todayEnd = endOfDay(now).toISOString();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 }).toISOString();
      const thirtyDaysAgo = subDays(now, 30).toISOString();
      // Active sessions: last activity within 24 hours
      const activeThreshold = subDays(now, 1).toISOString();

      // Fetch total count
      const { count: total, error: totalError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('Error fetching total guest sessions:', totalError);
        throw totalError;
      }
      setTotalCount(total || 0);

      // Fetch today's count
      const { count: today, error: todayError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd);

      if (todayError) throw todayError;
      setTodayCount(today || 0);

      // Fetch this week's count
      const { count: week, error: weekError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekStart);

      if (weekError) throw weekError;
      setWeekCount(week || 0);

      // Fetch converted count
      const { count: converted, error: convertedError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true })
        .not('converted_to_user_id', 'is', null);

      if (convertedError) {
        console.warn('Could not fetch converted count:', convertedError.message);
      } else {
        setConvertedCount(converted || 0);
      }

      // Fetch active sessions (last activity within 24 hours)
      const { count: activeSessions, error: activeError } = await supabase
        .from('guest_sessions')
        .select('*', { count: 'exact', head: true })
        .gte('last_activity', activeThreshold);

      if (activeError) {
        console.warn('Could not fetch active sessions count:', activeError.message);
      } else {
        setActiveSessionsCount(activeSessions || 0);
      }

      // Fetch sessions from last 30 days for detailed breakdown (paginate for accuracy)
      const sessions: GuestSession[] = [];
      const PAGE_SIZE = 1000;
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error: sessionsError } = await supabase
          .from('guest_sessions')
          .select('created_at, converted_to_user_id, referrer, page_views, last_activity')
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE_SIZE - 1);

        if (sessionsError) throw sessionsError;
        if (!data || data.length === 0) break;

        sessions.push(...(data as GuestSession[]));
        if (data.length < PAGE_SIZE) break;
      }

      // Update diagnostic info
      setDiagnosticInfo(`Loaded ${sessions.length} sessions from last 30 days. Timezone: ${userTimezone}`);

      // Group by day (using user's timezone for display)
      const dailyMap = new Map<string, number>();
      const hourlyMap = new Map<number, number>();
      const referrerMap = new Map<string, number>();
      let totalPageViews = 0;
      let sessionsWithPageViews = 0;

      // Initialize last 30 days with 0
      for (let i = 0; i < 30; i++) {
        const date = format(subDays(now, i), 'yyyy-MM-dd');
        dailyMap.set(date, 0);
      }

      // Initialize hours with 0
      for (let h = 0; h < 24; h++) {
        hourlyMap.set(h, 0);
      }

      // Count sessions
      (sessions || []).forEach((session) => {
        // Parse the UTC timestamp - JavaScript Date automatically converts to local timezone
        const localDate = new Date(session.created_at);

        const date = format(localDate, 'yyyy-MM-dd');
        const hour = localDate.getHours();

        if (dailyMap.has(date)) {
          dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
        }
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);

        // Track referrers
        if (session.referrer) {
          try {
            const referrerHost = new URL(session.referrer).hostname;
            referrerMap.set(referrerHost, (referrerMap.get(referrerHost) || 0) + 1);
          } catch {
            referrerMap.set(session.referrer.substring(0, 30), (referrerMap.get(session.referrer.substring(0, 30)) || 0) + 1);
          }
        }

        // Track page views
        if (session.page_views && session.page_views > 0) {
          totalPageViews += session.page_views;
          sessionsWithPageViews++;
        }
      });

      // Calculate average page views
      if (sessionsWithPageViews > 0) {
        setAvgPageViews(Math.round((totalPageViews / sessionsWithPageViews) * 10) / 10);
      } else {
        setAvgPageViews(0);
      }

      // Convert to arrays
      const dailyArray: DailyCount[] = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date));

      const hourlyArray: HourlyCount[] = Array.from(hourlyMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      // Get top referrers
      const referrerArray: ReferrerCount[] = Array.from(referrerMap.entries())
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setDailyCounts(dailyArray);
      setHourlyCounts(hourlyArray);
      setTopReferrers(referrerArray);
    } catch (error) {
      console.error('Error fetching guest session stats:', error);
      const errorMsg = error instanceof Error ? error.message : 'Failed to fetch guest session stats';
      setError(errorMsg);

      // Check if table exists
      if (errorMsg.includes('relation "guest_sessions" does not exist') || errorMsg.includes('does not exist')) {
        setError('Guest sessions table not found. Please run database migrations.');
      } else if (errorMsg.includes('permission denied') || errorMsg.includes('42501')) {
        setError('Permission denied. You may not have admin access to view guest sessions.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
  };

  const maxDailyCount = Math.max(...dailyCounts.map((d) => d.count), 1);
  const maxHourlyCount = Math.max(...hourlyCounts.map((h) => h.count), 1);

  // Find peak hour
  const peakHour = hourlyCounts.reduce(
    (max, curr) => (curr.count > max.count ? curr : max),
    { hour: 0, count: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guest Session Analytics
            </CardTitle>
            <CardDescription>
              Track anonymous browsing sessions from guest users
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg">
            <p className="font-medium">Error loading guest session data</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Summary Stats - Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Total Sessions</span>
            </div>
            <p className="text-3xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : totalCount.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Today</span>
            </div>
            <p className="text-3xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : todayCount.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">This Week</span>
            </div>
            <p className="text-3xl font-bold">
              {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : weekCount.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Summary Stats - Row 2 (Conversions & Engagement) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <UserCheck className="h-4 w-4" />
              <span className="text-sm">Converted to Users</span>
            </div>
            <p className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : convertedCount.toLocaleString()}
            </p>
            {totalCount > 0 && !loading && (
              <p className="text-xs text-muted-foreground mt-1">
                {((convertedCount / totalCount) * 100).toFixed(1)}% conversion rate
              </p>
            )}
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Active (24h)</span>
            </div>
            <p className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : activeSessionsCount.toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Eye className="h-4 w-4" />
              <span className="text-sm">Avg Page Views</span>
            </div>
            <p className="text-2xl font-bold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : avgPageViews}
            </p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Link2 className="h-4 w-4" />
              <span className="text-sm">Top Referrers</span>
            </div>
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : topReferrers.length > 0 ? (
              <div className="text-xs space-y-1 mt-1">
                {topReferrers.slice(0, 3).map((ref) => (
                  <div key={ref.referrer} className="flex justify-between">
                    <span className="truncate max-w-[100px]">{ref.referrer}</span>
                    <span className="font-medium">{ref.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No referrer data</p>
            )}
          </div>
        </div>

        {/* Sessions by Day */}
        <div>
          <h3 className="text-sm font-medium mb-3">Sessions by Day (Last 30 Days)</h3>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dailyCounts.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">No data available</p>
            ) : (
              dailyCounts.slice(0, 14).map((day) => (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-24 flex-shrink-0">
                    {format(parseISO(day.date), 'MMM d, EEE')}
                  </span>
                  <div className="flex-1 h-5 bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${(day.count / maxDailyCount) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{day.count}</span>
                </div>
              ))
            )}
          </div>
          {dailyCounts.length > 14 && (
            <p className="text-xs text-muted-foreground mt-2">
              Showing last 14 days. Total of {dailyCounts.length} days of data.
            </p>
          )}
        </div>

        {/* Peak Hours */}
        <div>
          <h3 className="text-sm font-medium mb-3">
            Peak Hours ({userTimezone})
            {peakHour.count > 0 && (
              <span className="text-muted-foreground font-normal ml-2">
                (Busiest: {formatHour(peakHour.hour)})
              </span>
            )}
          </h3>
          <div className="grid grid-cols-12 gap-1">
            {hourlyCounts.map((hourData) => (
              <div key={hourData.hour} className="flex flex-col items-center">
                <div
                  className="w-full bg-muted rounded-t relative"
                  style={{ height: '60px' }}
                >
                  <div
                    className="absolute bottom-0 w-full bg-primary/70 rounded-t transition-all duration-300"
                    style={{
                      height: `${(hourData.count / maxHourlyCount) * 100}%`,
                      minHeight: hourData.count > 0 ? '4px' : '0',
                    }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground mt-1">
                  {hourData.hour % 6 === 0 ? formatHour(hourData.hour) : ''}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>12 AM</span>
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>11 PM</span>
          </div>
        </div>

        {/* Diagnostic Info */}
        {diagnosticInfo && !error && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-4 border-t">
            <AlertCircle className="h-3 w-3" />
            <span>{diagnosticInfo}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
