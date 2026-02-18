import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  MapPin,
  Clock,
  Star,
  Loader2,
  Plus,
  Check,
  AlertCircle,
  ChevronDown,
  Phone,
  Mail,
  Globe,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useOpportunities } from "@/hooks/useOpportunities";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { GuestGate } from "@/components/GuestGate";

const Opportunities = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const { user, loading: authLoading, isReady, isGuest } = useAuth();
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

  // Fetch saved opportunities on mount - wait for auth to be ready
  useEffect(() => {
    const fetchSavedOpportunities = async () => {
      if (!user || !isReady) return;
      
      const { data, error } = await supabase
        .from("saved_opportunities")
        .select("opportunity_id")
        .eq("user_id", user.id);
      
      if (!error && data) {
        setSavedOpportunityIds(new Set(data.map((item) => item.opportunity_id)));
      }
    };

    fetchSavedOpportunities();
  }, [user, isReady]);

  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      navigate("/auth");
    }
  }, [user, authLoading, isGuest, navigate]);

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
          logger.error("Error getting location", error);
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
    if (isGuest) {
      setGuestGateOpen(true);
      return;
    }
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

  const getTypeColor = (type: string) => {
    switch (type) {
      case "hospital":
        return "bg-red-500/20 text-red-300 border-red-500/30";
      case "clinic":
        return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "hospice":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "emt":
        return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      default:
        return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };


  if (authLoading || !isReady || (!user && !isGuest)) {
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

      <div className="container mx-auto px-4 pt-28 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4 scroll-mt-28">Clinical Opportunities Near You</h1>
            <p className="text-lg text-muted-foreground">
              Discover clinical opportunities sorted by distance from your location.
            </p>
          </div>

          {/* Contact notice for broken links */}
          <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span>
              Found a broken link or outdated info?{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Let us know
              </Link>
              {" "}and we'll fix it.
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name or location..."
                value={searchTerm}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 100); // Limit to 100 chars
                  setSearchTerm(value);
                }}
                className="pl-10"
                maxLength={100}
                aria-label="Search opportunities by name or location"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[200px]" aria-label="Filter opportunities by type">
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
                <Card 
                  key={opportunity.id} 
                  className="bg-card/50 border-border"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-lg font-semibold text-foreground">{opportunity.name}</h3>
                          <Badge className={getTypeColor(opportunity.type)}>
                            {opportunity.type === 'emt' ? 'EMT' : opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <span className="break-words">
                              {opportunity.location}
                              {opportunity.distance && (
                                <span className="text-primary ml-1">({opportunity.distance.toFixed(1)} mi)</span>
                              )}
                            </span>
                          </div>
                          {opportunity.description && (
                            <p className="text-muted-foreground mt-2 line-clamp-2 sm:line-clamp-none">{opportunity.description}</p>
                          )}
                          {opportunity.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 flex-shrink-0" />
                              <a
                                href={`tel:${opportunity.phone}`}
                                className="text-primary hover:underline min-h-[44px] flex items-center sm:min-h-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {opportunity.phone}
                              </a>
                            </div>
                          )}
                          {opportunity.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 flex-shrink-0" />
                              <a
                                href={`mailto:${opportunity.email}`}
                                className="text-primary hover:underline truncate min-h-[44px] flex items-center sm:min-h-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {opportunity.email}
                              </a>
                            </div>
                          )}
                          {opportunity.website && (
                            <div className="flex items-center gap-2">
                              <Globe className="h-4 w-4 flex-shrink-0" />
                              <a
                                href={opportunity.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline min-h-[44px] flex items-center sm:min-h-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Visit Website
                              </a>
                            </div>
                          )}
                          {opportunity.review_count != null && opportunity.review_count > 0 && (
                            <div className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
                              <span>
                                {opportunity.avg_rating?.toFixed(1) ?? '0.0'} ({opportunity.review_count} review{opportunity.review_count !== 1 ? 's' : ''})
                              </span>
                            </div>
                          )}
                          {opportunity.hours_required && (
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 flex-shrink-0" />
                              <span>{opportunity.hours_required}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Buttons: horizontal full-width on mobile, vertical on desktop */}
                      <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                        {savedOpportunityIds.has(opportunity.id) ? (
                          <Button variant="secondary" size="sm" disabled className="flex-1 sm:flex-none h-11 sm:h-9">
                            <Check className="h-4 w-4 mr-2" />
                            In Tracker
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleAddToTracker(opportunity.id)}
                            size="sm"
                            disabled={savingIds.has(opportunity.id)}
                            className="flex-1 sm:flex-none h-11 sm:h-9"
                          >
                            {savingIds.has(opportunity.id) ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-2" />
                            )}
                            Add to Tracker
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => navigate(`/opportunities/${opportunity.slug ?? opportunity.id}`)}
                          className="flex-1 sm:flex-none h-11 sm:h-9"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
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

      {/* Guest Gate Dialog */}
      <GuestGate
        open={guestGateOpen}
        onOpenChange={setGuestGateOpen}
        action="save opportunities to your tracker"
      />
    </div>
  );
};

export default Opportunities;
