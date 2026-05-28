import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Loader2,
  AlertCircle,
  ChevronDown,
  Mail,
  List,
  Map,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useOpportunities } from "@/hooks/useOpportunities";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { trackOpportunityViewed, trackOpportunitySearch, trackOpportunitySaved } from "@/lib/tracking";
import { GuestGate } from "@/components/GuestGate";
import { VerificationGate } from "@/components/VerificationGate";
import { useEmailVerified } from "@/hooks/useEmailVerified";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { HospitalCard } from "@/components/HospitalCard";
import { HospitalDetail } from "@/components/HospitalDetail";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/types";

const ImmersiveMap = lazy(() => import("@/components/ImmersiveMap"));

const Opportunities = () => {
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<Set<string>>(new Set());
  const [savedLoading, setSavedLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [directApplyIds, setDirectApplyIds] = useState<Set<string>>(new Set());
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const [verificationGateOpen, setVerificationGateOpen] = useState(false);
  const { user, loading: authLoading, isReady, isGuest } = useAuth();
  const { needsVerification } = useEmailVerified();
  const { isPremium } = usePremiumStatus();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const { opportunities, loading, error: fetchError, hasMore, loadMore, totalCount, refetch } = useOpportunities({
    userLocation,
    filterType,
    searchTerm: debouncedSearch,
    pageSize: 20,
  });

  useEffect(() => {
    if (debouncedSearch.trim().length >= 2 && !loading) {
      trackOpportunitySearch(debouncedSearch, totalCount ?? 0, user?.id);
    }
  }, [debouncedSearch, totalCount, loading]);

  // Ref for detail panel to reset scroll position when switching opportunities
  const detailRef = useRef<HTMLDivElement>(null);

  // Keep last-selected opportunity so the detail panel content stays visible
  // during the CSS exit transition (after selectedId goes null).
  const lastSelectedRef = useRef<Opportunity | null>(null);
  const selectedOpportunity = opportunities.find((o) => o.id === selectedId) ?? null;
  if (selectedOpportunity) lastSelectedRef.current = selectedOpportunity;
  const displayedOpportunity = selectedOpportunity ?? lastSelectedRef.current;

  // Reset detail panel scroll when switching between opportunities
  useEffect(() => {
    if (selectedId && detailRef.current) {
      detailRef.current.scrollTop = 0;
    }
  }, [selectedId]);

  // Fetch saved opportunities
  useEffect(() => {
    const fetchSavedOpportunities = async () => {
      if (!isReady || !user) {
        setSavedLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("saved_opportunities")
          .select("opportunity_id")
          .eq("user_id", user.id);
        if (!error && data) {
          setSavedOpportunityIds(new Set(data.map((item) => item.opportunity_id)));
        }
      } finally {
        setSavedLoading(false);
      }
    };
    fetchSavedOpportunities();
  }, [user, isReady]);

  // Batch-fetch which hospitals have active positions (for Direct Apply badge)
  useEffect(() => {
    const hospitalIds = opportunities
      .map((o) => o.hospital_id)
      .filter((id): id is string => !!id);
    if (hospitalIds.length === 0) {
      setDirectApplyIds(new Set());
      return;
    }
    // Get hospital_pages for these hospital_ids, then check for active positions
    supabase
      .from("hospital_pages")
      .select("hospital_id, hospital_positions!inner(id)")
      .in("hospital_id", hospitalIds)
      .eq("hospital_positions.status", "active")
      .then(({ data }) => {
        const ids = new Set<string>();
        (data || []).forEach((page: { hospital_id: string }) => {
          if (page.hospital_id) ids.add(page.hospital_id);
        });
        setDirectApplyIds(ids);
      });
  }, [opportunities]);

  useEffect(() => {
    if (!authLoading && !user && !isGuest) {
      navigate("/auth");
    }
  }, [user, authLoading, isGuest, navigate]);

  const handleSortByDistance = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationDenied(false);
      },
      () => {
        setLocationDenied(true);
      }
    );
  };

  const handleAddToTracker = async (opportunityId: string) => {
    if (isGuest) { setGuestGateOpen(true); return; }
    if (needsVerification) { setVerificationGateOpen(true); return; }
    if (!user) return;

    setSavingIds((prev) => new Set(prev).add(opportunityId));
    const { error } = await supabase
      .from("saved_opportunities")
      .insert({ user_id: user.id, opportunity_id: opportunityId });
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(opportunityId);
      return next;
    });

    if (error) {
      if (error.code === "23505") {
        toast({ title: "Already in tracker", description: "This opportunity is already in your tracker." });
      } else {
        toast({ title: "Error", description: "Failed to add to tracker. Please try again.", variant: "destructive" });
      }
      return;
    }

    setSavedOpportunityIds((prev) => new Set(prev).add(opportunityId));
    trackOpportunitySaved(opportunityId, user.id);
    toast({ title: "Added to tracker!", description: "View it in your Dashboard to track your progress." });
  };

  const handleSelect = (id: string) => {
    setSelectedId((prev) => {
      if (prev !== id) {
        trackOpportunityViewed(id, user?.id);
      }
      return prev === id ? null : id;
    });
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "hospital": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "clinic":   return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "hospice":  return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "emt":      return "bg-orange-500/20 text-orange-300 border-orange-500/30";
      default:         return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  if (authLoading || !isReady || (!user && !isGuest)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const hasResults = opportunities.length > 0;
  const isDetailOpen = selectedId !== null;

  // Shared detail panel props
  const detailProps = displayedOpportunity
    ? {
        opportunity: displayedOpportunity,
        isPremium,
        isSaved: savedOpportunityIds.has(displayedOpportunity.id),
        isSavedLoading: savedLoading,
        isSaving: savingIds.has(displayedOpportunity.id),
        onClose: () => setSelectedId(null),
        onAddToTracker: handleAddToTracker,
        getTypeColor,
      }
    : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Helmet>
        <title>Find Clinical Opportunities — ClinicalHours</title>
        <meta name="description" content="Search thousands of hospitals, free clinics, hospices, and EMT programs accepting pre-med volunteers. Filter by type, location, and distance." />
      </Helmet>
      {/* ── Map mode: full-screen overlay ── */}
      {viewMode === "map" && (
        <>
          <Navigation />
          <div className="fixed top-20 left-0 right-0 bottom-0 z-30">
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center h-full bg-[#070c1a]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                </div>
              }
            >
              <ImmersiveMap hideNav />
            </Suspense>
          </div>
          <div className="fixed top-24 right-16 z-[60]">
            <button
              onClick={() => setViewMode("list")}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-black/50 backdrop-blur-md text-white/80 hover:text-white rounded-full border border-white/15 shadow-lg shadow-black/30 transition-colors"
            >
              <List className="h-3.5 w-3.5" /> List View
            </button>
          </div>
        </>
      )}

      {/* ── List mode ── */}
      {viewMode === "list" && (
        <>
          <Navigation />
          <div className="h-20" />

          <div className="sticky top-20 z-30 bg-background/95 backdrop-blur-sm border-b border-border/50">
            <div className="container mx-auto px-4 py-3">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row gap-3 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search by name or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.slice(0, 100))}
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
              <Button
                type="button"
                variant={userLocation ? "default" : "outline"}
                size="sm"
                onClick={handleSortByDistance}
                className="shrink-0 self-start h-10 gap-1.5"
                aria-label="Sort by distance"
              >
                <MapPin className="h-3.5 w-3.5" />
                {userLocation ? "Sorted by distance" : "Sort by distance"}
              </Button>
              {/* List / Map toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden shrink-0 self-start">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                    viewMode === "list"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="List view"
                >
                  <List className="h-3.5 w-3.5" /> List
                </button>
                <button
                  onClick={() => setViewMode("map")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-border bg-background text-muted-foreground hover:text-foreground"
                  aria-label="Map view"
                >
                  <Map className="h-3.5 w-3.5" /> Map
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              {!loading && hasResults && (
                <p className="text-xs text-muted-foreground">
                  Showing {opportunities.length} of {totalCount} opportunities
                  {userLocation && " · sorted by distance"}
                </p>
              )}
              {locationDenied && (
                <p className="text-xs text-muted-foreground">
                  Location access denied — showing all opportunities.
                </p>
              )}
              <div className="hidden">
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      {fetchError && opportunities.length === 0 ? (
        <div className="flex-1 container mx-auto px-4">
          <div className="max-w-6xl mx-auto pt-8">
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Failed to load opportunities</p>
                <p className="text-muted-foreground mb-4">{fetchError}</p>
                <Button variant="outline" size="sm" onClick={refetch}>
                  Try again
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : loading && opportunities.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading opportunities...</p>
          </div>
        </div>
      ) : !hasResults ? (
        <div className="flex-1 container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                {(debouncedSearch.trim() || filterType !== "all") ? (
                  <>
                    <p className="text-lg font-medium mb-2">
                      {searchTerm.trim()
                        ? `No results for "${searchTerm}"`
                        : "No results found"}
                    </p>
                    <p className="text-muted-foreground mb-4">
                      Try removing filters or broadening your search.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setSearchTerm(""); setFilterType("all"); }}
                    >
                      Clear filters
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-2">No opportunities found</p>
                    <p className="text-muted-foreground">Try adjusting your search or filters</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* ── Split Layout ──────────────────────────────────────────── */
        <div className="flex-1 container mx-auto px-4 pb-8">
          <div className="flex max-w-6xl mx-auto gap-5 lg:gap-6">
            {/* ── Left: Hospital list ─────────────────────────────── */}
            <div
              className={cn(
                "transition-all duration-300 ease-in-out w-full",
                isDetailOpen && "md:w-[45%] lg:w-[40%]",
              )}
            >
              <div
                className={cn(
                  "space-y-3 pb-4 transition-all duration-300 ease-in-out",
                  isDetailOpen ? "md:pr-3" : "max-w-3xl mx-auto",
                )}
              >
                {opportunities.map((opp) => (
                  <HospitalCard
                    key={opp.id}
                    opportunity={opp}
                    isSelected={selectedId === opp.id}
                    isSaved={savedOpportunityIds.has(opp.id)}
                    isSavedLoading={savedLoading}
                    isSaving={savingIds.has(opp.id)}
                    hasDirectApply={opp.hospital_id ? directApplyIds.has(opp.hospital_id) : false}
                    onSelect={handleSelect}
                    onAddToTracker={handleAddToTracker}
                    getTypeColor={getTypeColor}
                  />
                ))}

                {hasMore && (
                  <div className="flex justify-center py-4">
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
                          Load More
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: Detail panel (tablet + desktop) ──────────── */}
            <div
              className={cn(
                "hidden md:block transition-all duration-300 ease-in-out",
                isDetailOpen ? "md:w-[55%] lg:w-[60%] opacity-100" : "w-0 opacity-0 pointer-events-none",
              )}
              style={{ overflowX: 'clip' }}
            >
              <div
                ref={detailRef}
                className="sticky top-[11.5rem] max-h-[calc(100vh-12.5rem)] overflow-y-auto"
              >
                {detailProps && <HospitalDetail {...detailProps} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Detail Overlay (<md) ── */}
      <div
        className={cn(
          "md:hidden fixed inset-0 z-50 bg-background overflow-y-auto",
          "transition-transform duration-300 ease-in-out",
          isDetailOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
        )}
      >
        {detailProps && <HospitalDetail {...detailProps} />}
      </div>

      <Footer />
        </>
      )}

      <GuestGate
        open={guestGateOpen}
        onOpenChange={setGuestGateOpen}
        action="save opportunities to your tracker"
      />
      <VerificationGate
        open={verificationGateOpen}
        onOpenChange={setVerificationGateOpen}
        action="add opportunities to your tracker"
      />
    </div>
  );
};

export default Opportunities;
