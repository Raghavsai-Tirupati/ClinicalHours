import {
  X,
  MapPin,
  Globe,
  Mail,
  Phone,
  Clock,
  Star,
  ExternalLink,
  Check,
  Plus,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Opportunity } from "@/types";
import { FindApplicationButton } from "@/components/FindApplicationButton";

interface HospitalDetailProps {
  opportunity: Opportunity;
  hospitalAccountId?: string;
  isPremium: boolean;
  isSaved: boolean;
  isSavedLoading: boolean;
  isSaving: boolean;
  onClose: () => void;
  onAddToTracker: (id: string) => void;
  getTypeColor: (type: string) => string;
}

export function HospitalDetail({
  opportunity,
  hospitalAccountId,
  isPremium,
  isSaved,
  isSavedLoading,
  isSaving,
  onClose,
  onAddToTracker,
  getTypeColor,
}: HospitalDetailProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col bg-card border-l border-border h-full overflow-y-auto">
      {/* Sticky header */}
      <div className="flex items-start justify-between p-5 pb-4 border-b border-border sticky top-0 bg-card z-10">
        <div className="flex-1 min-w-0 pr-4">
          <h2 className="text-lg font-bold text-foreground leading-snug">
            {opportunity.name}
          </h2>
          <div className="mt-1.5">
            <Badge className={getTypeColor(opportunity.type)}>
              {opportunity.type === "emt"
                ? "EMT"
                : opportunity.type.charAt(0).toUpperCase() + opportunity.type.slice(1)}
            </Badge>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-muted transition-colors shrink-0"
          aria-label="Close detail panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="p-5 space-y-5 flex-1">
        {/* Address / location */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <span>{opportunity.location}</span>
            {opportunity.distance != null && (
              <span className="text-primary ml-1">
                · {opportunity.distance.toFixed(1)} mi away
              </span>
            )}
          </div>
        </div>

        {/* Primary CTAs */}
        <div className="flex flex-col gap-2">
          <FindApplicationButton
            opportunityId={opportunity.id}
            opportunityName={opportunity.name}
            websiteHint={opportunity.website}
            isPremium={isPremium}
            label="Volunteer Link"
          />
          {hospitalAccountId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/hospital/apply/${hospitalAccountId}`)}
              className="gap-1.5 self-start"
            >
              <ExternalLink className="h-4 w-4" />
              Direct Apply
            </Button>
          )}
        </div>

        {/* Contact Information */}
        {(opportunity.website || opportunity.email || opportunity.phone) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Contact Information
            </p>
            <div className="space-y-2">
              {opportunity.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={opportunity.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {opportunity.website}
                  </a>
                </div>
              )}
              {opportunity.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${opportunity.email}`}
                    className="text-primary hover:underline truncate"
                  >
                    {opportunity.email}
                  </a>
                </div>
              )}
              {opportunity.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={`tel:${opportunity.phone}`}
                    className="text-primary hover:underline"
                  >
                    {opportunity.phone}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Details */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
            Details
          </p>
          <div className="space-y-2">
            {opportunity.hours_required && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{opportunity.hours_required}</span>
              </div>
            )}
            {opportunity.review_count != null && opportunity.review_count > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Star className="h-4 w-4 text-primary fill-primary shrink-0" />
                <span>
                  {opportunity.avg_rating?.toFixed(1)} avg rating (
                  {opportunity.review_count} review
                  {opportunity.review_count !== 1 ? "s" : ""})
                </span>
              </div>
            )}
            {opportunity.acceptance_likelihood && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Acceptance:</span>
                <span
                  className={
                    opportunity.acceptance_likelihood === "high"
                      ? "text-emerald-400"
                      : opportunity.acceptance_likelihood === "medium"
                      ? "text-amber-400"
                      : "text-muted-foreground"
                  }
                >
                  {opportunity.acceptance_likelihood.charAt(0).toUpperCase() +
                    opportunity.acceptance_likelihood.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {opportunity.description && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              About
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {opportunity.description}
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
          {isSavedLoading ? (
            <Skeleton className="h-9 w-28" />
          ) : isSaved ? (
            <Button variant="secondary" size="sm" disabled>
              <Check className="h-4 w-4 mr-2" />
              In Tracker
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAddToTracker(opportunity.id)}
              disabled={isSaving}
            >
              {isSaving ? (
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
            onClick={() =>
              navigate(`/opportunities/${opportunity.slug ?? opportunity.id}`)
            }
          >
            View Full Details
          </Button>
        </div>
      </div>
    </div>
  );
}
