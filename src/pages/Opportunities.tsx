import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, MapPin, Clock, Phone, Mail, Star, AlertCircle, ChevronDown, MessageCircle, Loader2, Plus, Check } from "lucide-react";
import { ReminderDialog } from "@/components/ReminderDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useOpportunities } from "@/hooks/useOpportunities";
import { supabase } from "@/integrations/supabase/client";
import opportunitiesAccent from "@/assets/opportunities-accent.png";
import ReviewForm from "@/components/ReviewForm";
import ReviewsList from "@/components/ReviewsList";
import { QASection } from "@/components/QASection";

const Opportunities = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [expandedReviews, setExpandedReviews] = useState<Record<string, boolean>>({});
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { opportunities, loading, hasMore, loadMore, totalCount } = useOpportunities({
    userLocation,
    filterType,
    searchTerm: debouncedSearch,
    pageSize: 20,
  });

  // Fetch saved opportunities on mount
  useEffect(() => {
    const fetchSavedOpportunities = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("saved_opportunities")
        .select("opportunity_id")
        .eq("user_id", user.id);
      
      if (!error && data) {
        setSavedOpportunityIds(new Set(data.map((item) => item.opportunity_id)));
      }
    };

    fetchSavedOpportunities();
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          toast({
            title: "Location access denied",
            description: "Unable to sort by distance. Showing all opportunities.",
            variant: "destructive",
          });
        }
      );
    }
  }, [toast]);

  const handleAddToTracker = async (opportunityId: string) => {
    if (!user) return;
    
    setSavingIds((prev) => new Set(prev).add(opportunityId));
    
    const { error } = await supabase
      .from("saved_opportunities")
      .insert({
        user_id: user.id,
        opportunity_id: opportunityId,
      });
    
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(opportunityId);
      return next;
    });
    
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
    
    setSavedOpportunityIds((prev) => new Set(prev).add(opportunityId));
    toast({
      title: "Added to tracker!",
      description: "View it in your Dashboard to track your progress.",
    });
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

  const toggleReviews = (opportunityId: string) => {
    setExpandedReviews((prev) => ({
      ...prev,
      [opportunityId]: !prev[opportunityId],
    }));
  };

  const handleReviewSubmitted = () => {
    setReviewRefreshTrigger((prev) => prev + 1);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-4">Clinical Opportunities Near You</h1>
              <p className="text-lg text-muted-foreground">
                Discover clinical opportunities sorted by distance from your location.
              </p>
            </div>
            <div className="w-32 h-32 flex-shrink-0">
              <img src={opportunitiesAccent} alt="" className="w-full h-full object-contain opacity-70" />
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="hospice">Hospice</SelectItem>
                <SelectItem value="emt">EMT</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading && opportunities.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading opportunities...</p>
            </div>
          ) : opportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No opportunities found</p>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  Showing {opportunities.length} of {totalCount} opportunities
                  {userLocation && " sorted by distance"}
                </p>
              </div>

              {opportunities.map((opportunity) => (
                <Card key={opportunity.id} className="hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-2xl mb-2">{opportunity.name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 text-base">
                          <MapPin className="h-4 w-4" />
                          {opportunity.location}
                          {opportunity.distance && (
                            <span className="text-primary font-medium">
                              • {opportunity.distance.toFixed(1)} miles away
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{opportunity.type}</Badge>
                        <Badge className={getAcceptanceColor(opportunity.acceptance_likelihood)}>
                          {opportunity.acceptance_likelihood} Acceptance
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {opportunity.description && (
                      <p className="text-muted-foreground">{opportunity.description}</p>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{opportunity.hours_required}</span>
                      </div>
                      {opportunity.avg_rating && (
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-primary fill-primary" />
                          <span>
                            {opportunity.avg_rating.toFixed(1)} ({opportunity.review_count} reviews)
                          </span>
                        </div>
                      )}
                    </div>

                    {opportunity.requirements.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Requirements:</p>
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
                      
                      {/* Add to Tracker Button */}
                      {savedOpportunityIds.has(opportunity.id) ? (
                        <Button variant="secondary" size="sm" disabled>
                          <Check className="mr-2 h-4 w-4" />
                          In Tracker
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleAddToTracker(opportunity.id)}
                          disabled={savingIds.has(opportunity.id)}
                        >
                          {savingIds.has(opportunity.id) ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="mr-2 h-4 w-4" />
                          )}
                          Add to Tracker
                        </Button>
                      )}
                      
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

                    {/* Community Section - Reviews & Q&A */}
                    <Collapsible
                      open={expandedReviews[opportunity.id]}
                      onOpenChange={() => toggleReviews(opportunity.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full mt-4">
                          <ChevronDown
                            className={`h-4 w-4 mr-2 transition-transform ${
                              expandedReviews[opportunity.id] ? "rotate-180" : ""
                            }`}
                          />
                          <MessageCircle className="h-4 w-4 mr-2" />
                          {expandedReviews[opportunity.id] ? "Hide Community" : "Reviews & Q&A"}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
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
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={loadMore}
                    disabled={loading}
                    className="min-w-[200px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Load More Opportunities
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Opportunities;
