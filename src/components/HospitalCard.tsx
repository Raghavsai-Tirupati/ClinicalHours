import { MapPin, Star, Clock, Check, Plus, Loader2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity } from "@/types";
import HospitalLogo from "@/components/HospitalLogo";
import { TrustChips } from "@/components/TrustChips";

interface HospitalCardProps {
  opportunity: Opportunity;
  isSelected: boolean;
  isSaved: boolean;
  isSavedLoading: boolean;
  isSaving: boolean;
  hasDirectApply?: boolean;
  onSelect: (id: string) => void;
  onAddToTracker: (id: string) => void;
  getTypeColor: (type: string) => string;
}

export function HospitalCard({
  opportunity,
  isSelected,
  isSaved,
  isSavedLoading,
  isSaving,
  hasDirectApply,
  onSelect,
  onAddToTracker,
  getTypeColor,
}: HospitalCardProps) {
  return (
    <div
      className={[
        "relative rounded-xl bg-card border cursor-pointer transition-all duration-200 shadow-sm",
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
          : "border-border hover:border-primary/50 hover:shadow-md hover:bg-card/80",
      ].join(" ")}
      onClick={() => onSelect(opportunity.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(opportunity.id);
        }
      }}
      aria-selected={isSelected}
      aria-label={`View details for ${opportunity.name}`}
    >
      <div className="p-4 md:p-5">
        <div className="flex gap-3">
          <HospitalLogo
            logoUrl={opportunity.logo_url ?? null}
            hospitalName={opportunity.name}
            size="md"
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Name + type badge */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground leading-snug">
                {opportunity.name}
              </h3>
              <Badge className={`${getTypeColor(opportunity.type)} shrink-0`}>
                {opportunity.type === "emt"
                  ? "EMT"
                  : opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
              </Badge>
            </div>

            {/* Location + distance */}
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {opportunity.location}
                {opportunity.distance != null && (
                  <span className="text-primary ml-1">
                    ({opportunity.distance.toFixed(1)} mi)
                  </span>
                )}
              </span>
            </div>

            {/* Meta row: rating, hours, accepting badge */}
            <div className="flex items-center gap-3 flex-wrap">
              {opportunity.review_count != null && opportunity.review_count > 0 && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                  <span>
                    {opportunity.avg_rating?.toFixed(1)}{" "}
                    <span className="text-xs">({opportunity.review_count})</span>
                  </span>
                </div>
              )}
              {opportunity.hours_required && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{opportunity.hours_required}</span>
                </div>
              )}
              {opportunity.acceptance_likelihood === "high" && (
                <Badge
                  variant="outline"
                  className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10 text-xs"
                >
                  Accepting Volunteers
                </Badge>
              )}
              {hasDirectApply && (
                <Badge
                  variant="outline"
                  className="text-blue-400 border-blue-500/30 bg-blue-500/10 text-xs"
                >
                  Apply on ClinicalHours
                </Badge>
              )}
            </div>

            {/* Description / notes */}
            {opportunity.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {opportunity.description}
              </p>
            )}

            {/* Trust chips */}
            <TrustChips opportunity={opportunity} />

            {/* Actions row */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {isSavedLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : isSaved ? (
                <Button variant="secondary" size="sm" disabled className="h-8">
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  In Tracker
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => onAddToTracker(opportunity.id)}
                  disabled={isSaving}
                  className="h-8"
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Add to Tracker
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground hover:text-foreground gap-1"
                onClick={() => onSelect(opportunity.id)}
              >
                More Info
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
