import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useOpportunities } from "@/hooks/useOpportunities";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { GuestGate } from "@/components/GuestGate";
import { VerificationGate } from "@/components/VerificationGate";
import { useEmailVerified } from "@/hooks/useEmailVerified";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { HospitalCard } from "@/components/HospitalCard";
import { HospitalDetail } from "@/components/HospitalDetail";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/types";

const Opportunities = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
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

  const { opportunities, loading, hasMore, loadMore, totalCount } = useOpportunities({
    userLocation,
    filterType,
    searchTerm: debouncedSearch,
    pageSize: 20,
  });

  // Keep last-selected opportunity so the detail panel content stays visible
  // during the CSS exit transition (after selectedId goes null).
  const lastSelectedRef = useRef<Opportunity | null>(null);
  const selectedOpportunity = opportunities.find((o) => o.id === selectedId) ?? null;
  if (selectedOpportunity) lastSelectedRef.current = selectedOpportunity;
  const displayedOpportunity = selectedOpportunity ?? lastSelectedRef.current;

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
    toast({ title: "Added to tracker!", description: "View it in your Dashboard to track your progress." });
  };

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
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
      <Navigation />

      {/* ── Header + Search / Filter ─────────────────────────────────── */}
      <div className="container mx-auto px-4 pt-28 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-4xl font-bold mb-4 scroll-mt-28">
              Find Clinical Opportunities Near You
            </h1>
            <p className="text-lg text-muted-foreground">
              Discover clinical opportunities sorted by distance from your location.
            </p>
          </div>

          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span>
              Found a broken link or outdated info?{" "}
              <Link to="/contact" className="text-primary hover:underline">
                Let us know
              </Link>{" "}
              and we&rsquo;ll fix it.
            </span>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-4">
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
          </div>

          {!loading && hasResults && (
            <p className="text-sm text-muted-foreground">
              Showing {opportunities.length} of {totalCount} opportunities
              {userLocation && " sorted by distance"}
            </p>
          )}
        </div>
      </div>

      {/* ── Main Content Area ────────────────────────────────────────── */}
      {loading && opportunities.length === 0 ? (
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
                <p className="text-lg font-medium mb-2">No opportunities found</p>
                <p className="text-muted-foreground">Try adjusting your search or filters</p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* ── Split Layout ──────────────────────────────────────────── */
        <div className="flex-1 container mx-auto px-4 pb-8">
          <div className="flex max-w-6xl mx-auto items-start gap-5 lg:gap-6">
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
                "hidden md:block transition-all duration-300 ease-in-out overflow-x-hidden",
                isDetailOpen ? "md:w-[55%] lg:w-[60%] opacity-100" : "w-0 opacity-0 pointer-events-none",
              )}
            >
              {detailProps && <HospitalDetail {...detailProps} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Detail Overlay (<md) ──────────────────────────────── */}
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
