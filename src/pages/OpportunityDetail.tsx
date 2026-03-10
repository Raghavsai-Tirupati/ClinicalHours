import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, Phone, Mail, Star, Loader2, Plus, Check, ArrowLeft, ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ReminderDialog } from "@/components/ReminderDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import ReviewForm from "@/components/ReviewForm";
import ReviewsList from "@/components/ReviewsList";
import { QASection } from "@/components/QASection";
import { GuestGate } from "@/components/GuestGate";
import { logger } from "@/lib/logger";

interface Opportunity {
  id: string;
  name: string;
  type: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  hours_required: string;
  acceptance_likelihood: string;
  description: string | null;
  requirements: string[];
  phone: string | null;
  email: string | null;
  website: string | null;
  hospital_id?: string | null;
  avg_rating?: number;
  review_count?: number;
}

const OpportunityDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading, isReady, isGuest } = useAuth();
  const { toast } = useToast();
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  // If a hospital account is linked to this opportunity, store its id for Apply
  const [directApplyAccountId, setDirectApplyAccountId] = useState<string | null>(null);

  useEffect(() => {
    if (isReady && !user && !isGuest) {
      navigate("/auth");
    }
  }, [user, isReady, isGuest, navigate]);

  useEffect(() => {
    const fetchOpportunity = async () => {
      if (!slug) return;

      setLoading(true);
      try {
        // Try slug first, fall back to ID
        let { data, error } = await supabase
          .from("opportunities_with_ratings")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        // If not found by slug, try by ID
        if (!data && !error) {
          const byId = await supabase
            .from("opportunities_with_ratings")
            .select("*")
            .eq("id", slug)
            .maybeSingle();
          data = byId.data;
          error = byId.error;
        }

        if (error) throw error;
        if (!data) {
          setOpportunity(null);
          setLoading(false);
          return;
        }

        if (data) {
          setOpportunity({
            id: data.id,
            name: data.name,
            type: data.type,
            location: data.location,
            latitude: data.latitude,
            longitude: data.longitude,
            hours_required: data.hours_required,
            acceptance_likelihood: data.acceptance_likelihood,
            description: data.description,
            requirements: data.requirements || [],
            phone: data.phone,
            email: data.email,
            website: data.website,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hospital_id: (data as any).hospital_id ?? null,
            avg_rating: data.avg_rating,
            review_count: data.review_count,
          });
        }
      } catch (error) {
        logger.error("Error fetching opportunity", error);
        toast({
          title: "Error",
          description: "Failed to load opportunity. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunity();
  }, [slug, navigate, toast]);

  useEffect(() => {
    const checkSaved = async () => {
      if (!isReady || !user || !opportunity?.id) {
        setSavedLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("saved_opportunities")
          .select("id")
          .eq("user_id", user.id)
          .eq("opportunity_id", opportunity.id)
          .single();

        setSaved(!!data);
      } finally {
        setSavedLoading(false);
      }
    };

    checkSaved();
  }, [isReady, user, opportunity?.id]);

  // Look up the hospital_accounts row linked to this opportunity (if any)
  useEffect(() => {
    setDirectApplyAccountId(null);
    if (!opportunity?.hospital_id) return;

    supabase
      .from("hospital_accounts")
      .select("id")
      .eq("hospital_id", opportunity.hospital_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) setDirectApplyAccountId(data.id);
      });
  }, [opportunity?.hospital_id]);

  const handleAddToTracker = async () => {
    if (isGuest) {
      setGuestGateOpen(true);
      return;
    }
    if (!user || !opportunity?.id) return;

    setSaving(true);
    const { error } = await supabase.from("saved_opportunities").insert({
      user_id: user.id,
      opportunity_id: opportunity.id,
    });

    setSaving(false);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Already in tracker",
          description: "This opportunity is already in your tracker.",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to add to tracker. Please try again.",
          variant: "destructive",
        });
      }
      return;
    }

    setSaved(true);
    toast({
      title: "Added to tracker!",
      description: "View it in your Dashboard to track your progress.",
    });
  };

  const handleReviewSubmitted = async () => {
    setReviewRefreshTrigger((prev) => prev + 1);
    // Refresh opportunity data to update rating
    if (opportunity?.id) {
      const { data, error } = await supabase
        .from("opportunities_with_ratings")
        .select("*")
        .eq("id", opportunity.id)
        .single();
      
      if (error) {
        logger.error("Error fetching updated rating", error);
      } else if (data) {
        setOpportunity((prev) =>
          prev
            ? {
                ...prev,
                avg_rating: data.avg_rating,
                review_count: data.review_count,
              }
            : null
        );
      }
    }
  };

  const getAcceptanceColor = (rate: string) => {
    switch (rate.toLowerCase()) {
      case "high":
        return "bg-success text-success-foreground";
      case "medium":
        return "bg-primary text-primary-foreground";
      case "low":
        return "bg-destructive text-destructive-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading opportunity...</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!opportunity) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Opportunity not found</p>
            <Button onClick={() => navigate("/opportunities")}>Back to Opportunities</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button
          variant="outline"
          onClick={() => navigate("/opportunities")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Opportunities
        </Button>

        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <CardTitle className="text-3xl mb-2">{opportunity.name}</CardTitle>
                <CardDescription className="flex items-center gap-2 text-base">
                  <MapPin className="h-4 w-4" />
                  {opportunity.location}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{opportunity.type === 'emt' ? 'EMT' : opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}</Badge>
                <Badge className={getAcceptanceColor(opportunity.acceptance_likelihood)}>
                  {opportunity.acceptance_likelihood} Acceptance
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {opportunity.description && (
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{opportunity.description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{opportunity.hours_required}</span>
              </div>
              {opportunity.review_count != null && opportunity.review_count > 0 && (
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary fill-primary" />
                  <span>
                    {opportunity.avg_rating?.toFixed(1) ?? '0.0'} ({opportunity.review_count} review{opportunity.review_count !== 1 ? "s" : ""})
                  </span>
                </div>
              )}
            </div>

            {opportunity.requirements.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Requirements</h3>
                <div className="flex flex-wrap gap-2">
                  {opportunity.requirements.map((req, idx) => (
                    <Badge key={idx} variant="secondary">
                      {req}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              {opportunity.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${opportunity.phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call
                  </a>
                </Button>
              )}
              {opportunity.email && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:${opportunity.email}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </a>
                </Button>
              )}
              {opportunity.website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={opportunity.website} target="_blank" rel="noopener noreferrer">
                    Visit Website
                  </a>
                </Button>
              )}

              {savedLoading ? (
                <Skeleton className="h-9 w-28 rounded-md" />
              ) : saved ? (
                <Button variant="secondary" size="sm" disabled>
                  <Check className="mr-2 h-4 w-4" />
                  In Tracker
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddToTracker}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Add to Tracker
                </Button>
              )}

              {/* Apply: shown when a hospital admin has set up this hospital */}
              {directApplyAccountId ? (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate(`/opportunities/${slug}/apply`)}
                  className="gap-1.5"
                >
                  <ExternalLink className="h-4 w-4" />
                  Apply
                </Button>
              ) : opportunity?.hospital_id ? (
                <Button variant="outline" size="sm" disabled className="gap-1.5 opacity-50">
                  <ExternalLink className="h-4 w-4" />
                  Apply (not enabled)
                </Button>
              ) : null}

              <ReviewForm
                opportunityId={opportunity.id}
                opportunityName={opportunity.name}
                onReviewSubmitted={handleReviewSubmitted}
              />
              <ReminderDialog
                opportunityId={opportunity.id}
                opportunityName={opportunity.name}
                opportunityLocation={opportunity.location}
                opportunityDescription={opportunity.description || undefined}
                opportunityWebsite={opportunity.website || undefined}
                userId={user?.id || ""}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Community</CardTitle>
            <CardDescription>
              Reviews and questions from other students
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="reviews" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="reviews">Reviews</TabsTrigger>
                <TabsTrigger value="qa">Q&A</TabsTrigger>
              </TabsList>
              <TabsContent value="reviews">
                <ReviewsList
                  opportunityId={opportunity.id}
                  refreshTrigger={reviewRefreshTrigger}
                />
              </TabsContent>
              <TabsContent value="qa">
                <QASection
                  opportunityId={opportunity.id}
                  opportunityName={opportunity.name}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Footer />

      {/* Guest Gate Dialog */}
      <GuestGate
        open={guestGateOpen}
        onOpenChange={setGuestGateOpen}
        action="save opportunities to your tracker"
      />
    </div>
  );
};

export default OpportunityDetail;

