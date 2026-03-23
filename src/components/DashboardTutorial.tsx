import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DashboardTutorialProps {
  mode: "guest" | "account";
  tutorialKey: string;
  hasTrackedOpportunities: boolean;
  onComplete?: () => Promise<void> | void;
}

export function DashboardTutorial({
  mode,
  tutorialKey,
  hasTrackedOpportunities,
  onComplete,
}: DashboardTutorialProps) {
  const navigate = useNavigate();
  const storageKey = `ch_dashboard_tutorial_seen_${tutorialKey}`;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (mode !== "guest") return false;
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (mode !== "guest") return;
    try {
      if (localStorage.getItem(storageKey) !== "true") {
        localStorage.setItem(storageKey, "true");
      }
    } catch {
      // ignore
    }
  }, [mode, storageKey]);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (mode === "guest") {
      try {
        localStorage.setItem(storageKey, "true");
      } catch {
        // ignore
      }
    }
    void onComplete?.();
  };

  const goToOpportunities = () => navigate("/opportunities");
  const goToHourTracker = () => navigate("/hours");

  // "New here" only when they have not saved any opportunities to the tracker yet.
  if (!hasTrackedOpportunities) {
    return (
      <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            New here? Start by finding a place to get experience.
          </p>
          <p className="text-xs text-muted-foreground">
            Browse nearby hospitals and clinics, then use the direct application links to apply in a few clicks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDismiss}>
            Skip
          </Button>
          <Button size="sm" onClick={goToOpportunities}>
            Find a place to apply
          </Button>
        </div>
      </div>
    );
  }

  // If the user already has experience logged, help them connect the pieces.
  return (
    <div className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            Quick tour: keep your clinical journey organized.
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs text-muted-foreground">
            {!hasTrackedOpportunities && (
              <li>
                <span className="font-medium text-foreground">Add hospitals to your tracker</span> – save places you
                care about from the map or opportunities list.
              </li>
            )}
            <li>
              <span className="font-medium text-foreground">Log your shifts and hours</span> – use the Hour Tracker to
              record when and where you volunteered.
            </li>
            <li>
              <span className="font-medium text-foreground">Write quick reflections</span> – add short notes so future
              applications are easier to write.
            </li>
          </ol>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-muted-foreground hover:text-foreground ml-2 shrink-0"
        >
          Dismiss
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {!hasTrackedOpportunities && (
          <Button size="sm" variant="outline" onClick={goToOpportunities}>
            Explore hospitals
          </Button>
        )}
        <Button size="sm" onClick={goToHourTracker}>
          Open Hour Tracker
        </Button>
      </div>
    </div>
  );
}

