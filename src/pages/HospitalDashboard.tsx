import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalAccount } from "@/hooks/useHospitalAccount";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Users,
  Loader2,
  ExternalLink,
  Calendar,
  RefreshCw,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";

interface OpportunityWithApps {
  id: string;
  name: string;
  location: string;
  type: string;
  slug: string | null;
  created_at: string;
  application_count: number;
  new_application_count: number;
}

export default function HospitalDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { hospitalAccount, isLoading: hospitalLoading } = useHospitalAccount();
  const [opportunities, setOpportunities] = useState<OpportunityWithApps[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!hospitalLoading && !hospitalAccount) {
      navigate("/dashboard");
      return;
    }
    if (!hospitalLoading && hospitalAccount?.account_status === "pending") {
      navigate("/pending-approval");
      return;
    }
    if (!hospitalLoading && hospitalAccount?.account_status === "rejected") {
      navigate("/pending-approval");
      return;
    }
  }, [authLoading, user, hospitalLoading, hospitalAccount, navigate]);

  useEffect(() => {
    if (user && hospitalAccount?.account_status === "approved") {
      fetchOpportunities();
    }
  }, [user, hospitalAccount]);

  async function fetchOpportunities(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    try {
      // Get opportunities created by this user
      const { data: opps, error: oppsError } = await supabase
        .from("opportunities")
        .select("id, name, location, type, slug, created_at")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });

      if (oppsError) {
        console.error("Error fetching opportunities:", oppsError);
        setOpportunities([]);
        return;
      }

      if (!opps || opps.length === 0) {
        setOpportunities([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get application counts for each opportunity
      const oppIds = opps.map((o) => o.id);
      const { data: apps } = await supabase
        .from("applications")
        .select("opportunity_id, status")
        .in("opportunity_id", oppIds);

      const appCounts: Record<string, { total: number; new: number }> = {};
      (apps || []).forEach((app) => {
        if (!appCounts[app.opportunity_id]) {
          appCounts[app.opportunity_id] = { total: 0, new: 0 };
        }
        appCounts[app.opportunity_id].total++;
        if (app.status === "new") {
          appCounts[app.opportunity_id].new++;
        }
      });

      const result: OpportunityWithApps[] = opps.map((opp) => ({
        ...opp,
        type: opp.type || "hospital",
        slug: opp.slug,
        application_count: appCounts[opp.id]?.total || 0,
        new_application_count: appCounts[opp.id]?.new || 0,
      }));

      setOpportunities(result);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (authLoading || hospitalLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const totalApplications = opportunities.reduce((sum, o) => sum + o.application_count, 0);
  const totalNewApplications = opportunities.reduce((sum, o) => sum + o.new_application_count, 0);

  return (
    <>
      <Helmet>
        <title>Hospital Dashboard | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Navigation />

      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Building2 className="h-4 w-4" />
                <span>Hospital Dashboard</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                {hospitalAccount?.hospital_name}
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your posted opportunities and applications
              </p>
            </div>
            <button
              onClick={() => fetchOpportunities(true)}
              disabled={refreshing}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted border border-border"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Opportunities</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{opportunities.length}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Applications</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalApplications}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                <span className="text-xs text-muted-foreground">New Applications</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{totalNewApplications}</p>
            </div>
          </div>

          {/* Opportunities List */}
          {opportunities.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">No opportunities posted</p>
              <p className="text-muted-foreground text-sm">
                Your posted opportunities will appear here once they've been added to the platform.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Opportunity
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                        Location
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                        Date Posted
                      </th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Applications
                      </th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp, i) => (
                      <tr
                        key={opp.id}
                        className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                          i % 2 === 0 ? "" : "bg-muted/5"
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-foreground">{opp.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {opp.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground sm:hidden">
                                {opp.location}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate max-w-[200px]">{opp.location}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(opp.created_at), "MMM d, yyyy")}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <span className="font-medium text-foreground">
                              {opp.application_count}
                            </span>
                            {opp.new_application_count > 0 && (
                              <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                {opp.new_application_count} new
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {opp.slug ? (
                            <Link to={`/opportunities/${opp.slug}/admin`}>
                              <Button size="sm" variant="outline" className="text-xs h-7">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Manage
                              </Button>
                            </Link>
                          ) : (
                            <Button size="sm" variant="outline" className="text-xs h-7" disabled>
                              No Link
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
