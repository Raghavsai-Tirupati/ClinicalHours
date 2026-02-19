import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Building2,
  Loader2,
  CheckCircle2,
  XCircle,
  Globe,
  MapPin,
  Mail,
  Phone,
  User,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface PendingHospital {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  website: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  submitted_at: string | null;
  status: string;
}

export default function AdminHospitals() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();
  const [hospitals, setHospitals] = useState<PendingHospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || adminLoading) return;
    if (!user || !isAdmin) return;
    fetchPending();
  }, [user, isAdmin, authLoading, adminLoading]);

  async function fetchPending() {
    const { data } = await supabase
      .from("hospitals")
      .select("id, name, city, state, website, contact_name, contact_email, contact_phone, submitted_at, status")
      .eq("status", "pending")
      .order("submitted_at", { ascending: false });
    setHospitals((data as PendingHospital[]) || []);
    setLoading(false);
  }

  async function updateStatus(id: string, newStatus: "verified" | "rejected") {
    setUpdating(id);
    const { error } = await supabase
      .from("hospitals")
      .update({
        status: newStatus,
        reviewed_by_user_id: user!.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update status: " + error.message);
    } else {
      toast.success(`Hospital ${newStatus === "verified" ? "approved" : "rejected"}`);
      setHospitals((prev) => prev.filter((h) => h.id !== id));
    }
    setUpdating(null);
  }

  // Auth/admin guards
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center px-4 pt-28 pb-16">
          <div className="text-center">
            <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-muted-foreground">You must be a platform admin to view this page.</p>
            <Button onClick={() => navigate("/")} variant="outline" className="mt-4">
              Return Home
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Hospital Approvals | Admin | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
            <Shield className="h-4 w-4" />
            <span>Admin</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Hospital Approvals</h1>
          <p className="text-muted-foreground mb-8">
            Review and approve pending hospital registrations.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : hospitals.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">All caught up!</p>
              <p className="text-muted-foreground text-sm">
                No pending hospital requests at this time.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {hospitals.map((h) => (
                <div key={h.id} className="bg-card border border-border rounded-xl p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                        <h2 className="text-lg font-semibold text-foreground">{h.name}</h2>
                        <Badge variant="outline" className="text-xs">Pending</Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {(h.city || h.state) && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{[h.city, h.state].filter(Boolean).join(", ")}</span>
                          </div>
                        )}
                        {h.website && (
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                            <a href={h.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate">
                              {h.website}
                            </a>
                          </div>
                        )}
                        {h.contact_name && (
                          <div className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{h.contact_name}</span>
                          </div>
                        )}
                        {h.contact_email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                            <a href={`mailto:${h.contact_email}`} className="text-primary hover:underline">{h.contact_email}</a>
                          </div>
                        )}
                        {h.contact_phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                            <span>{h.contact_phone}</span>
                          </div>
                        )}
                        {h.submitted_at && (
                          <div className="text-xs text-muted-foreground">
                            Submitted {format(new Date(h.submitted_at), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => updateStatus(h.id, "verified")}
                        disabled={updating === h.id}
                        className="gap-1.5"
                      >
                        {updating === h.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatus(h.id, "rejected")}
                        disabled={updating === h.id}
                        className="gap-1.5"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
