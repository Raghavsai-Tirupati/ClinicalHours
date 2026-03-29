import { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Globe,
  Mail,
  Phone,
  Clock,
  Star,
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
import HospitalLogo from "@/components/HospitalLogo";
import { supabase } from "@/integrations/supabase/client";
import { isPositionDeadlinePassed } from '@/lib/positionAvailability';
import { POSITION_TYPE_LABELS } from "@/types/positions";
import type { PositionType } from "@/types/positions";

interface ActivePosition {
  id: string;
  title: string;
  position_type: PositionType;
  hours_per_week: number | null;
  application_deadline: string | null;
  spots_available: number | null;
}

interface HospitalDetailProps {
  opportunity: Opportunity;
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
  isPremium,
  isSaved,
  isSavedLoading,
  isSaving,
  onClose,
  onAddToTracker,
  getTypeColor,
}: HospitalDetailProps) {
  const navigate = useNavigate();
  const [activePositions, setActivePositions] = useState<ActivePosition[]>([]);

  useEffect(() => {
    if (!opportunity.id) {
      setActivePositions([]);
      return;
    }

    const fetchPositions = async () => {
      // hospital_pages.hospital_id references the public opportunity record id
      const { data: pages } = await supabase
        .from("hospital_pages")
        .select("id")
        .eq("hospital_id", opportunity.id)
        .limit(1);

      if (!pages || pages.length === 0) {
        setActivePositions([]);
        return;
      }

      const { data: positions } = await supabase
        .from("hospital_positions")
        .select("id, title, position_type, hours_per_week, application_deadline, spots_available")
        .eq("hospital_page_id", pages[0].id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      const openPositions = ((positions as ActivePosition[]) || []).filter(
        (pos) => !isPositionDeadlinePassed(pos.application_deadline),
      );

      setActivePositions(openPositions);
    };

    fetchPositions();
  }, [opportunity.id]);

  return (
    <div className="flex flex-col bg-card border border-border rounded-xl shadow-sm overflow-hidden h-auto">
      <div className="flex items-start justify-between p-5 pb-4 border-b border-border">
        <div className="flex items-start gap-3 flex-1 min-w-0 pr-4">
          <HospitalLogo
            logoUrl={opportunity.logo_url ?? null}
            hospitalName={opportunity.name}
            size="lg"
            className="mt-0.5"
          />
          <div className="flex-1 min-w-0">
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
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
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

        {/* Active Positions — Apply on ClinicalHours (replaces Serper link) */}
        {activePositions.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Open Positions — Apply on ClinicalHours
            </p>
            <div className="space-y-2">
              {activePositions.map((pos) => (
                <div
                  key={pos.id}
                  className="flex items-center justify-between gap-2 p-3 border border-border rounded-md bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{pos.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>{POSITION_TYPE_LABELS[pos.position_type]}</span>
                      {pos.hours_per_week != null && (
                        <span>· {pos.hours_per_week} hrs/wk</span>
                      )}
                      {pos.application_deadline && (
                        <span>· Due {new Date(pos.application_deadline).toLocaleDateString()}</span>
                      )}
                      {pos.spots_available != null && (
                        <span>· {pos.spots_available} spot{pos.spots_available !== 1 ? 's' : ''} left</span>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/apply/${pos.id}`)}
                    className="shrink-0 h-8"
                  >
                    Apply Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Serper link — only shown when no active positions on our platform */
          <div className="flex flex-col gap-2">
            <FindApplicationButton
              key={opportunity.id}
              opportunityId={opportunity.id}
              opportunityName={opportunity.name}
              websiteHint={opportunity.website}
              isPremium={isPremium}
              label="Volunteer Link"
            />
          </div>
        )}

        {/* Contact Information */}
        {(opportunity.website || opportunity.email || opportunity.phone) && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
              Contact Information
            </p>
            <div className="space-y-2">
              {opportunity.website && (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={opportunity.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-w-0 break-all text-primary hover:underline"
                  >
                    {opportunity.website}
                  </a>
                </div>
              )}
              {opportunity.email && (
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a
                    href={`mailto:${opportunity.email}`}
                    className="min-w-0 break-all text-primary hover:underline"
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
