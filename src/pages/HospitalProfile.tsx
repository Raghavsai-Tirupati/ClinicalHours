import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Globe,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Helmet } from "react-helmet-async";

interface HospitalData {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  address: string | null;
  website: string | null;
  status: string;
  slug: string;
}

interface AccountData {
  id: string;
}

export default function HospitalProfile() {
  const { slug } = useParams<{ slug: string }>();
  const [hospital, setHospital] = useState<HospitalData | null>(null);
  const [account, setAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchHospital() {
      const { data: hosp, error } = await supabase
        .from("hospitals")
        .select("id, name, city, state, address, website, status, slug")
        .eq("slug", slug)
        .maybeSingle();

      if (error || !hosp) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setHospital(hosp as HospitalData);

      // Check if hospital has an active account
      const { data: acc } = await supabase
        .from("hospital_accounts")
        .select("id")
        .eq("hospital_id", hosp.id)
        .maybeSingle();

      if (acc) setAccount(acc as AccountData);
      setLoading(false);
    }

    fetchHospital();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !hospital) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center px-4 pt-28 pb-16">
          <div className="text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground mb-2">Hospital Not Found</h1>
            <p className="text-muted-foreground max-w-md">
              The hospital you're looking for doesn't exist or the link may be incorrect.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isVerified = hospital.status === "seeded" || hospital.status === "verified";
  const location = [hospital.city, hospital.state].filter(Boolean).join(", ");
  const canApply = isVerified && account;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>{hospital.name} | ClinicalHours</title>
        <meta name="description" content={`Apply for clinical volunteer opportunities at ${hospital.name}${location ? ` in ${location}` : ""}.`} />
      </Helmet>

      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-2xl mx-auto">
          {/* Hospital Card */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="bg-muted/30 border-b border-border px-6 py-8">
              <div className="flex items-start gap-4">
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h1 className="text-2xl font-bold text-foreground">{hospital.name}</h1>
                    {isVerified && (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <CheckCircle2 className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                  </div>
                  {location && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span>{location}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {hospital.address && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</span>
                  <p className="text-sm text-foreground mt-1">{hospital.address}</p>
                </div>
              )}

              {hospital.website && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Website</span>
                  <a
                    href={hospital.website.startsWith("http") ? hospital.website : `https://${hospital.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
                  >
                    <Globe className="h-4 w-4 flex-shrink-0" />
                    {hospital.website}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {/* Direct Apply CTA */}
              {canApply ? (
                <div className="pt-4 border-t border-border">
                  <Button asChild className="w-full h-12 text-base font-semibold gap-2">
                    <Link to={`/hospital/apply/${account!.id}`}>
                      <Building2 className="h-5 w-5" />
                      Direct Apply
                    </Link>
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Submit your application directly to {hospital.name}
                  </p>
                </div>
              ) : !isVerified ? (
                <div className="pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground text-center py-2">
                    This hospital is not currently accepting direct applications.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
