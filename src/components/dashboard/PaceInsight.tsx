// src/components/dashboard/PaceInsight.tsx
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PaceInsightProps {
  totalHours: number;
  /** ISO date string of when the user first opened the app (from localStorage or profile created_at) */
  startedAt?: string | null;
}

function getApplyYear(): number {
  const v = localStorage.getItem("ch_apply_year");
  return v ? parseInt(v, 10) : 0;
}

function getGoal(): number {
  const v = localStorage.getItem("ch_hours_goal");
  return v ? parseInt(v, 10) : 300;
}

function weeksUntilJune(targetYear: number): number {
  const now = new Date();
  // AMCAS opens early June — target June 1 of apply year
  const deadline = new Date(targetYear, 5, 1); // June 1
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / msPerWeek));
}

export function PaceInsight({ totalHours, startedAt }: PaceInsightProps) {
  const applyYear = getApplyYear();
  const goal = getGoal();

  if (!applyYear || applyYear === 0) return null;

  const weeksLeft = weeksUntilJune(applyYear);
  if (weeksLeft <= 0) return null;

  const hoursNeeded = Math.max(0, goal - totalHours);
  const requiredPace = hoursNeeded / weeksLeft;

  // Compute actual current pace if we know when they started
  let actualPace: number | null = null;
  if (startedAt) {
    const start = new Date(startedAt);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksElapsed = Math.max(1, (Date.now() - start.getTime()) / msPerWeek);
    actualPace = totalHours / weeksElapsed;
  }

  const isPaceKnown = actualPace !== null;
  const isOnTrack = isPaceKnown && actualPace! >= requiredPace;
  const isAhead = isPaceKnown && actualPace! >= requiredPace * 1.2;

  const paceColor = !isPaceKnown
    ? "text-muted-foreground"
    : isAhead
    ? "text-emerald-400"
    : isOnTrack
    ? "text-sky-400"
    : "text-amber-400";

  const PaceIcon = !isPaceKnown
    ? Minus
    : isOnTrack
    ? TrendingUp
    : TrendingDown;

  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4 space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pace to Goal</p>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-foreground">
            {requiredPace < 1
              ? `${(requiredPace * 60).toFixed(0)} min`
              : `${requiredPace.toFixed(1)} hrs`}
            <span className="text-sm font-normal text-muted-foreground ml-1">/ week needed</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {weeksLeft} weeks until June {applyYear} · {hoursNeeded} hrs remaining
          </p>
        </div>
        {isPaceKnown && (
          <div className={`flex items-center gap-1 text-sm font-medium ${paceColor}`}>
            <PaceIcon className="h-4 w-4" />
            {isAhead ? "Ahead" : isOnTrack ? "On track" : "Behind"}
          </div>
        )}
      </div>
      {!isPaceKnown && (
        <p className="text-xs text-muted-foreground">
          Log your first hours to see if you're on pace.
        </p>
      )}
    </div>
  );
}
