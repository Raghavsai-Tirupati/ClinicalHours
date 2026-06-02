import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ApplyYearCountdownProps {
  applyYear: number | null;
}

/** AMCAS primary applications typically open the first week of June. */
const AMCAS_OPEN_MONTH = 5; // 0-indexed = June
const AMCAS_OPEN_DAY = 1;

function computeCountdown(applyYear: number): { months: number; weeks: number; label: string } {
  const now = new Date();
  const target = new Date(applyYear, AMCAS_OPEN_MONTH, AMCAS_OPEN_DAY);
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { months: 0, weeks: 0, label: "Your application cycle is open!" };
  }

  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30.44);
  const weeks = Math.round(diffDays / 7);

  if (months >= 2) {
    return { months, weeks, label: `${months} months until your ${applyYear} application cycle` };
  }
  if (weeks > 1) {
    return { months, weeks, label: `${weeks} weeks until your ${applyYear} application cycle` };
  }
  return { months, weeks, label: `${diffDays} day${diffDays === 1 ? "" : "s"} until your ${applyYear} application cycle` };
}

function urgencyColor(months: number): string {
  if (months <= 0) return "text-emerald-400";
  if (months <= 3) return "text-amber-400";
  if (months <= 6) return "text-sky-400";
  return "text-muted-foreground";
}

export function ApplyYearCountdown({ applyYear }: ApplyYearCountdownProps) {
  const countdown = useMemo(() => (applyYear ? computeCountdown(applyYear) : null), [applyYear]);

  if (!applyYear || !countdown) return null;

  const colorClass = urgencyColor(countdown.months);

  return (
    <Card className="col-span-2 lg:col-span-4 border-border bg-card">
      <CardContent className="flex items-center gap-3 py-3 px-4">
        <CalendarDays className={`h-5 w-5 shrink-0 ${colorClass}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${colorClass}`}>{countdown.label}</p>
          {countdown.months >= 1 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              AMCAS primaries open ~June {applyYear} · use this time to log clinical hours
            </p>
          )}
        </div>
        {countdown.months > 0 && (
          <span className="text-2xl font-bold tabular-nums text-foreground shrink-0">
            {countdown.months > 1 ? `${countdown.months}` : `${countdown.weeks}`}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              {countdown.months > 1 ? "mo" : "wk"}
            </span>
          </span>
        )}
      </CardContent>
    </Card>
  );
}
