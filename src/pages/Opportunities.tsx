import { useState, useEffect, useMemo, useTransition } from "react";
import { useNavigate, Link } from "react-router-dom";
import CinematicLayout from "@/components/layout/CinematicLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ExternalLink,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useOpportunities } from "@/hooks/useOpportunities";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { GuestGate } from "@/components/GuestGate";
import type { Opportunity } from "@/types";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SETTINGS = ["all", "hospital", "clinic", "hospice", "emt"] as const;

const PRE_HEALTH_TRACKS = [
  "Pre-Med",
  "Pre-PA",
  "Pre-Nursing",
  "Pre-Dental",
  "Pre-Pharm",
  "Other",
] as const;

const OPPORTUNITY_TYPES = [
  "Shadowing",
  "Volunteering",
  "Research",
  "Clinical Employment",
] as const;

const SPECIALTIES = [
  "Surgery",
  "Emergency Medicine",
  "Pediatrics",
  "Internal Medicine",
  "Family Medicine",
  "Psychiatry",
  "Neurology",
  "Cardiology",
  "Oncology",
  "Orthopedics",
  "OB/GYN",
  "Radiology",
] as const;

const PATIENT_INTERACTION_LEVELS = ["Low", "Medium", "High"] as const;

const TRACK_KEYWORDS: Record<string, string[]> = {
  "Pre-Med": ["medical", "medicine", "physician", "doctor"],
  "Pre-PA": ["physician assistant", "pa"],
  "Pre-Nursing": ["nurse", "nursing", "rn", "lpn"],
  "Pre-Dental": ["dental", "dentist"],
  "Pre-Pharm": ["pharmacy", "pharmacist"],
};

const TYPE_KEYWORDS: Record<string, string[]> = {
  Shadowing: ["shadow", "observership", "observation"],
  Volunteering: ["volunteer"],
  Research: ["research", "lab", "laboratory"],
  "Clinical Employment": [
    "employment",
    "hiring",
    "assistant",
    "technician",
    "scribe",
  ],
};

const INTERACTION_KEYWORDS: Record<string, string[]> = {
  Low: ["remote", "administrative", "clerical"],
  High: ["direct patient", "hands-on", "bedside"],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function textBlob(opp: Opportunity): string {
  const parts: string[] = [opp.name, opp.description ?? ""];
  if (opp.requirements) parts.push(opp.requirements.join(" "));
  return parts.join(" ").toLowerCase();
}

function countKeywordHits(blob: string, keywords: string[]): number {
  return keywords.reduce(
    (acc, kw) => acc + (blob.includes(kw.toLowerCase()) ? 1 : 0),
    0,
  );
}

function deriveAcceptanceLikelihood(opp: Opportunity): "High" | "Medium" | "Low" {
  const blob = textBlob(opp);
  if (/competitive|selective|limited spots|highly sought/i.test(blob)) return "Low";
  if (/open|walk-in|accepting|immediate|no prerequisites/i.test(blob)) return "High";
  return "Medium";
}

const acceptanceColors: Record<string, string> = {
  High: "bg-green-500/20 text-green-300 border-green-500/30",
  Medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Low: "bg-red-500/20 text-red-300 border-red-500/30",
};

function getTypeColor(type: string) {
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
}

function formatTypeName(type: string) {
  return type === "emt" ? "EMT" : type.charAt(0).toUpperCase() + type.slice(1);
}

function splitRequirements(reqs: string[]): string[] {
  const chips: string[] = [];
  for (const r of reqs) {
    for (const part of r.split(/[;,]/)) {
      const trimmed = part.trim();
      if (trimmed) chips.push(trimmed);
    }
  }
  return chips.slice(0, 6);
}

/* ------------------------------------------------------------------ */
/*  Pill toggle component                                              */
/* ------------------------------------------------------------------ */

function PillButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted/70"
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const Opportunities = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [savedOpportunityIds, setSavedOpportunityIds] = useState<Set<string>>(new Set());
  const [savedLoading, setSavedLoading] = useState(true);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [hospitalAccountMap, setHospitalAccountMap] = useState<Map<string, string>>(new Map());
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const { user, loading: authLoading, isReady, isGuest } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Quiz-style filter state
  const [selectedTrack, setSelectedTrack] = useState<string | null>(null);
  const [majorKeyword, setMajorKeyword] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedSpecialties, setSelectedSpecialties] = useState<Set<string>>(new Set());
  const [selectedInteraction, setSelectedInteraction] = useState<string | null>(null);

  const [, startTransition] = useTransition();

  // Debounced search
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

  // Batch-fetch hospital accounts
  useEffect(() => {
    const hospitalIds = opportunities
      .map((o) => o.hospital_id)
      .filter((id): id is string => !!id);
    if (hospitalIds.length === 0) {
      setHospitalAccountMap(new Map());
      return;
    }
    supabase
      .from("hospital_accounts")
      .select("id, hospital_id")
      .in("hospital_id", hospitalIds)
      .then(({ data }) => {
        const map = new Map<string, string>();
        (data || []).forEach((acc) => {
          if (acc.hospital_id) map.set(acc.hospital_id, acc.id);
        });
        setHospitalAccountMap(map);
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
        },
      );
    }
  }, [toast]);

  /* ---- Scoring-based filter logic ---- */

  const hasQuizFilters =
    selectedTrack !== null ||
    majorKeyword.trim() !== "" ||
    selectedTypes.size > 0 ||
    selectedSpecialties.size > 0 ||
    selectedInteraction !== null;

  const hasAnyFilter = filterType !== "all" || hasQuizFilters;

  const filteredOpportunities = useMemo(() => {
    if (!hasQuizFilters) return opportunities;

    type Scored = Opportunity & { _score: number };

    const scored: Scored[] = opportunities.map((opp) => {
      const blob = textBlob(opp);
      let score = 0;

      if (selectedTrack && TRACK_KEYWORDS[selectedTrack]) {
        score += countKeywordHits(blob, TRACK_KEYWORDS[selectedTrack]) * 3;
      }

      if (majorKeyword.trim()) {
        if (blob.includes(majorKeyword.trim().toLowerCase())) score += 2;
      }

      if (selectedTypes.size > 0) {
        for (const t of selectedTypes) {
          if (TYPE_KEYWORDS[t]) {
            score += countKeywordHits(blob, TYPE_KEYWORDS[t]) * 2;
          }
        }
      }

      if (selectedSpecialties.size > 0) {
        for (const s of selectedSpecialties) {
          if (blob.includes(s.toLowerCase())) score += 2;
        }
      }

      if (selectedInteraction && INTERACTION_KEYWORDS[selectedInteraction]) {
        score += countKeywordHits(blob, INTERACTION_KEYWORDS[selectedInteraction]) * 2;
      }

      return { ...opp, _score: score };
    });

    return scored.sort((a, b) => b._score - a._score);
  }, [
    opportunities,
    selectedTrack,
    majorKeyword,
    selectedTypes,
    selectedSpecialties,
    selectedInteraction,
    hasQuizFilters,
  ]);

  /* ---- Handlers ---- */

  const handleAddToTracker = async (opportunityId: string) => {
    if (isGuest) {
      setGuestGateOpen(true);
      return;
    }
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

  const toggleSetValue = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string,
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const handleClearAll = () => {
    startTransition(() => {
      setFilterType("all");
      setSearchTerm("");
      setSelectedTrack(null);
      setMajorKeyword("");
      setSelectedTypes(new Set());
      setSelectedSpecialties(new Set());
      setSelectedInteraction(null);
    });
  };

  /* ---- Auth loading gate ---- */

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

  /* ---- Active filter badge list ---- */

  const activeBadges: { label: string; color: string }[] = [];
  if (filterType !== "all") {
    activeBadges.push({
      label: `Setting: ${formatTypeName(filterType)}`,
      color: "bg-primary/20 text-primary border-primary/30",
    });
  }
  if (selectedTrack) {
    activeBadges.push({
      label: `Track: ${selectedTrack}`,
      color: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    });
  }
  if (majorKeyword.trim()) {
    activeBadges.push({
      label: `Major: ${majorKeyword.trim()}`,
      color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    });
  }
  if (selectedTypes.size > 0) {
    activeBadges.push({
      label: `Types: ${[...selectedTypes].join(", ")}`,
      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    });
  }
  if (selectedSpecialties.size > 0) {
    activeBadges.push({
      label: `Specialties: ${[...selectedSpecialties].join(", ")}`,
      color: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    });
  }
  if (selectedInteraction) {
    activeBadges.push({
      label: `Interaction: ${selectedInteraction}`,
      color: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    });
  }

  /* ---- Render ---- */

  return (
    <CinematicLayout
      title="Clinical Opportunities"
      subtitle="Discover and filter opportunities matched to your interests"
    >
      {/* Contact notice */}
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="h-4 w-4 flex-shrink-0" />
        <span>
          Found a broken link or outdated info?{" "}
          <Link to="/contact" className="text-primary hover:underline">
            Let us know
          </Link>{" "}
          and we&apos;ll fix it.
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ============ LEFT FILTER SIDEBAR ============ */}
        <aside className="w-full lg:w-[280px] flex-shrink-0 space-y-5">
          {/* Clear All */}
          {hasAnyFilter && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="w-full justify-center text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear All Filters
            </Button>
          )}

          {/* Search */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Name or location…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.slice(0, 100))}
                className="pl-10"
                maxLength={100}
                aria-label="Search opportunities by name or location"
              />
            </div>
          </div>

          {/* Setting */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Setting
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SETTINGS.map((s) => (
                <PillButton
                  key={s}
                  label={s === "all" ? "All" : formatTypeName(s)}
                  active={filterType === s}
                  onClick={() => setFilterType(s)}
                />
              ))}
            </div>
          </div>

          {/* Pre-health Track */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Pre-health Track
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRE_HEALTH_TRACKS.map((t) => (
                <PillButton
                  key={t}
                  label={t}
                  active={selectedTrack === t}
                  onClick={() => setSelectedTrack((prev) => (prev === t ? null : t))}
                />
              ))}
            </div>
          </div>

          {/* Major */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Major
            </label>
            <Input
              placeholder="e.g. Biology, Chemistry…"
              value={majorKeyword}
              onChange={(e) => setMajorKeyword(e.target.value.slice(0, 60))}
              maxLength={60}
              aria-label="Filter by major keyword"
            />
          </div>

          {/* Opportunity Type */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Opportunity Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OPPORTUNITY_TYPES.map((t) => (
                <PillButton
                  key={t}
                  label={t}
                  active={selectedTypes.has(t)}
                  onClick={() => toggleSetValue(setSelectedTypes, t)}
                />
              ))}
            </div>
          </div>

          {/* Specialty Interests */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Specialty Interests
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SPECIALTIES.map((s) => (
                <PillButton
                  key={s}
                  label={s}
                  active={selectedSpecialties.has(s)}
                  onClick={() => toggleSetValue(setSelectedSpecialties, s)}
                />
              ))}
            </div>
          </div>

          {/* Patient Interaction */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Patient Interaction
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PATIENT_INTERACTION_LEVELS.map((l) => (
                <PillButton
                  key={l}
                  label={l}
                  active={selectedInteraction === l}
                  onClick={() =>
                    setSelectedInteraction((prev) => (prev === l ? null : l))
                  }
                />
              ))}
            </div>
          </div>
        </aside>

        {/* ============ MAIN RESULTS ============ */}
        <section className="flex-1 min-w-0">
          {/* Active filter badges */}
          {activeBadges.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {activeBadges.map((b) => (
                <Badge key={b.label} className={`${b.color} text-xs`}>
                  {b.label}
                </Badge>
              ))}
            </div>
          )}

          {loading && opportunities.length === 0 ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-muted-foreground">Loading opportunities...</p>
            </div>
          ) : filteredOpportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">No opportunities found</p>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Showing {filteredOpportunities.length} of {totalCount} opportunities
                {userLocation && " sorted by distance"}
                {hasQuizFilters && " · ranked by relevance"}
              </p>

              {filteredOpportunities.map((opportunity) => {
                const acceptance = deriveAcceptanceLikelihood(opportunity);
                const reqChips =
                  opportunity.requirements && opportunity.requirements.length > 0
                    ? splitRequirements(opportunity.requirements)
                    : [];

                return (
                  <Card
                    key={opportunity.id}
                    className="bg-card/50 border-border hover:border-border/80 transition-colors"
                  >
                    <CardContent className="p-5">
                      {/* Top row: name + badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold text-foreground">
                          {opportunity.name}
                        </h3>
                        <Badge className={getTypeColor(opportunity.type)}>
                          {formatTypeName(opportunity.type)}
                        </Badge>
                        <Badge className={acceptanceColors[acceptance]}>
                          {acceptance} Acceptance
                        </Badge>
                      </div>

                      {/* Location + distance */}
                      <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                        <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span className="break-words">
                          {opportunity.location}
                          {opportunity.distance != null && (
                            <span className="text-primary ml-1">
                              ({opportunity.distance.toFixed(1)} mi)
                            </span>
                          )}
                        </span>
                      </div>

                      {/* Description (full) */}
                      {opportunity.description && (
                        <p className="text-sm text-muted-foreground mb-3">
                          {opportunity.description}
                        </p>
                      )}

                      {/* Requirement chips */}
                      {reqChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {reqChips.map((chip, i) => (
                            <span
                              key={i}
                              className="inline-block rounded-md bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground border border-border/50"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Rating */}
                      {opportunity.review_count != null &&
                        opportunity.review_count > 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Star className="h-4 w-4 text-primary fill-primary flex-shrink-0" />
                            <span>
                              {opportunity.avg_rating?.toFixed(1) ?? "0.0"} (
                              {opportunity.review_count} review
                              {opportunity.review_count !== 1 ? "s" : ""})
                            </span>
                          </div>
                        )}

                      {/* Hours required */}
                      {opportunity.hours_required && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                          <Clock className="h-4 w-4 flex-shrink-0" />
                          <span>{opportunity.hours_required}</span>
                        </div>
                      )}

                      {/* Contact row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
                        {opportunity.phone && (
                          <a
                            href={`tel:${opportunity.phone}`}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {opportunity.phone}
                          </a>
                        )}
                        {opportunity.email && (
                          <a
                            href={`mailto:${opportunity.email}`}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline truncate max-w-[220px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                            {opportunity.email}
                          </a>
                        )}
                        {opportunity.website && (
                          <a
                            href={opportunity.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Globe className="h-3.5 w-3.5" />
                            Website
                          </a>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div
                        className="flex flex-wrap gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {savedLoading ? (
                          <Skeleton className="h-9 w-32 rounded-md" />
                        ) : savedOpportunityIds.has(opportunity.id) ? (
                          <Button variant="secondary" size="sm" disabled>
                            <Check className="h-4 w-4 mr-2" />
                            In Tracker
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleAddToTracker(opportunity.id)}
                            size="sm"
                            disabled={savingIds.has(opportunity.id)}
                          >
                            {savingIds.has(opportunity.id) ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4 mr-2" />
                            )}
                            Add to Tracker
                          </Button>
                        )}

                        {opportunity.hospital_id &&
                          hospitalAccountMap.has(opportunity.hospital_id) && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/hospital/apply/${hospitalAccountMap.get(opportunity.hospital_id!)}`,
                                )
                              }
                              className="gap-1.5"
                            >
                              <ExternalLink className="h-4 w-4" />
                              Direct Apply
                            </Button>
                          )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Load More */}
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
        </section>
      </div>

      {/* Guest Gate Dialog */}
      <GuestGate
        open={guestGateOpen}
        onOpenChange={setGuestGateOpen}
        action="save opportunities to your tracker"
      />
    </CinematicLayout>
  );
};

export default Opportunities;
