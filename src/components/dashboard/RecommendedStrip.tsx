// src/components/dashboard/RecommendedStrip.tsx
import { Link } from "react-router-dom";
import { Star, Plus, Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HospitalLogo from "@/components/HospitalLogo";
import { useOpportunities } from "@/hooks/useOpportunities";

interface RecommendedStripProps {
  savedOpportunityIds: Set<string>;
  onSave: (id: string) => void;
}

export function RecommendedStrip({ savedOpportunityIds, onSave }: RecommendedStripProps) {
  const { opportunities, loading } = useOpportunities({
    userLocation: null,
    filterType: "all",
    searchTerm: "",
    pageSize: 20,
  });

  const rated = opportunities
    .filter((o) => !savedOpportunityIds.has(o.id) && (o.avg_rating ?? 0) > 0)
    .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
    .slice(0, 3);

  const display = rated.length >= 2
    ? rated
    : opportunities.filter((o) => !savedOpportunityIds.has(o.id)).slice(0, 3);

  if (loading || display.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Recommended For You
        </p>
        <Link
          to="/opportunities"
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {display.map((opp) => {
          const isSaved = savedOpportunityIds.has(opp.id);
          return (
            <div
              key={opp.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/30 transition-colors"
            >
              <HospitalLogo
                logoUrl={opp.logo_url ?? null}
                hospitalName={opp.name}
                size="sm"
                className="shrink-0 mt-0.5"
              />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground line-clamp-1">{opp.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{opp.location}</p>
                {opp.avg_rating != null && opp.avg_rating > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="h-3 w-3 text-primary fill-primary" />
                    {opp.avg_rating.toFixed(1)}
                  </div>
                )}
                <Button
                  size="sm"
                  variant={isSaved ? "secondary" : "outline"}
                  className="h-7 text-xs mt-1 w-full"
                  disabled={isSaved}
                  onClick={() => !isSaved && onSave(opp.id)}
                >
                  {isSaved ? (
                    <><Check className="h-3 w-3 mr-1" />Saved</>
                  ) : (
                    <><Plus className="h-3 w-3 mr-1" />Save</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
