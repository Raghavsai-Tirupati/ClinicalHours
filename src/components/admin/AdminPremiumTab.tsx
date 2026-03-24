import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Crown, RefreshCw, User, Users, Ghost, Ticket, UserPlus, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

type TrackingEvent = {
  id: string;
  user_id: string | null;
  session_id: string;
  page_url: string;
  created_at: string;
};

type ProfileLite = {
  id: string;
  full_name: string | null;
  is_premium: boolean;
  stripe_subscription_id: string | null;
  premium_expires_at: string | null;
  premium_source: "paid" | "promo_code" | "directly_added" | null;
};

type SubscriptionLite = {
  user_id: string;
  status: string;
};

type PremiumSource = "promo_code" | "directly_added" | "paid";

type PremiumUserRow = {
  id: string;
  name: string;
  source: PremiumSource;
  premiumExpiresAt: string | null;
};

function sourceBadge(source: PremiumSource) {
  if (source === "paid") {
    return (
      <Badge variant="outline" className="text-[11px] border-emerald-500/30 text-emerald-400">
        <CreditCard className="h-3 w-3 mr-1" />
        Paid
      </Badge>
    );
  }
  if (source === "promo_code") {
    return (
      <Badge variant="outline" className="text-[11px] border-amber-500/30 text-amber-400">
        <Ticket className="h-3 w-3 mr-1" />
        Promo code
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[11px] border-blue-500/30 text-blue-400">
      <UserPlus className="h-3 w-3 mr-1" />
      Directly added
    </Badge>
  );
}

export default function AdminPremiumTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [profilesById, setProfilesById] = useState<Map<string, ProfileLite>>(new Map());
  const [premiumUsers, setPremiumUsers] = useState<PremiumUserRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const [eventsResult, profilesResult, subscriptionsResult] = await Promise.all([
        supabase
          .from("tracking_events")
          .select("id, user_id, session_id, page_url, created_at")
          .eq("event_type", "page_view")
          .or("page_url.eq./premium,page_url.eq./premium/purchase")
          .order("created_at", { ascending: false })
          .limit(400),
        supabase
          .from("profiles")
          .select("id, full_name, is_premium, stripe_subscription_id, premium_expires_at, premium_source")
          .eq("is_premium", true),
        supabase
          .from("subscriptions")
          .select("user_id, status")
          .in("status", ["active", "trialing"]),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      if (subscriptionsResult.error) throw subscriptionsResult.error;

      const eventRows = (eventsResult.data ?? []) as TrackingEvent[];
      const profileRows = (profilesResult.data ?? []) as ProfileLite[];
      const subscriptionRows = (subscriptionsResult.data ?? []) as SubscriptionLite[];

      const profileMap = new Map<string, ProfileLite>();
      profileRows.forEach((p) => profileMap.set(p.id, p));
      setProfilesById(profileMap);
      setEvents(eventRows);

      const activeSubscriptionUsers = new Set(subscriptionRows.map((s) => s.user_id));
      const premiumList: PremiumUserRow[] = profileRows.map((p) => {
        const hasStripeSub = Boolean(p.stripe_subscription_id);
        const hasActiveSub = activeSubscriptionUsers.has(p.id);

        let source: PremiumSource;
        if (p.premium_source) {
          source = p.premium_source;
        } else if (hasStripeSub || hasActiveSub) {
          source = "paid";
        } else if (p.premium_expires_at) {
          // Best-effort classification for non-Stripe temporary access.
          source = "promo_code";
        } else {
          source = "directly_added";
        }

        return {
          id: p.id,
          name: p.full_name || `User ${p.id.slice(0, 6)}`,
          source,
          premiumExpiresAt: p.premium_expires_at,
        };
      });

      premiumList.sort((a, b) => a.name.localeCompare(b.name));
      setPremiumUsers(premiumList);
      setLastUpdatedAt(new Date());
    } catch (error) {
      console.error("Failed to load premium admin data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const premiumViews = useMemo(() => {
    const byUserOrSession = new Map<string, { key: string; label: string; isGuest: boolean; lastSeen: string }>();
    for (const event of events) {
      const key = event.user_id ?? `guest:${event.session_id}`;
      if (byUserOrSession.has(key)) continue;

      const profile = event.user_id ? profilesById.get(event.user_id) : null;
      byUserOrSession.set(key, {
        key,
        label: profile?.full_name || (event.user_id ? `User ${event.user_id.slice(0, 6)}` : `Guest ${event.session_id.slice(0, 6)}`),
        isGuest: !event.user_id,
        lastSeen: event.created_at,
      });
    }
    return [...byUserOrSession.values()];
  }, [events, profilesById]);

  const sourceCounts = useMemo(() => {
    return premiumUsers.reduce(
      (acc, user) => {
        acc[user.source] += 1;
        return acc;
      },
      { paid: 0, promo_code: 0, directly_added: 0 } as Record<PremiumSource, number>
    );
  }, [premiumUsers]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-400" />
            Premium
          </h2>
          <span className="text-xs text-muted-foreground">
            Live every 10s {refreshing ? "• updating..." : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdatedAt && (
            <span className="text-[11px] text-muted-foreground">
              Updated {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-lg font-bold">{premiumViews.length}</p>
            <p className="text-[11px] text-muted-foreground">Viewed Premium</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-lg font-bold">{premiumUsers.length}</p>
            <p className="text-[11px] text-muted-foreground">Current Premium Users</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-lg font-bold">{sourceCounts.paid}</p>
            <p className="text-[11px] text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-lg font-bold">{sourceCounts.promo_code}</p>
            <p className="text-[11px] text-muted-foreground">Promo Code</p>
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-4">
            <p className="text-lg font-bold">{sourceCounts.directly_added}</p>
            <p className="text-[11px] text-muted-foreground">Directly Added</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Live Premium Feature Activity (All Accounts)</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading activity...</p>
            ) : premiumViews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No premium page activity yet.</p>
            ) : (
              <ScrollArea className="h-[360px]">
                <div className="space-y-2">
                  {premiumViews.map((viewer) => (
                    <div key={viewer.key} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {viewer.isGuest ? (
                          <Ghost className="h-4 w-4 text-orange-400 shrink-0" />
                        ) : (
                          <User className="h-4 w-4 text-blue-400 shrink-0" />
                        )}
                        <span className="text-sm truncate">{viewer.label}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(new Date(viewer.lastSeen), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Who Has Premium + Source</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading premium users...</p>
            ) : premiumUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No premium users found.</p>
            ) : (
              <ScrollArea className="h-[360px]">
                <div className="space-y-2">
                  {premiumUsers.map((user) => (
                    <div key={user.id} className="rounded-md border border-border/60 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">{user.name}</span>
                        </div>
                        {sourceBadge(user.source)}
                      </div>
                      {user.premiumExpiresAt && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Expires {new Date(user.premiumExpiresAt).toLocaleDateString()}
                        </p>
                      )}
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
