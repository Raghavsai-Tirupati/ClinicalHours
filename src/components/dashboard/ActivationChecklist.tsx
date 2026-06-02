import { Link } from "react-router-dom";
import { CheckCircle2, Circle, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ActivationChecklistProps {
  savedCount: number;
  totalHours: number;
  reflectionCount: number;
  hasCity: boolean;
  onDismiss: () => void;
}

interface Step {
  label: string;
  href: string;
  done: boolean;
}

export function ActivationChecklist({
  savedCount,
  totalHours,
  reflectionCount,
  hasCity,
  onDismiss,
}: ActivationChecklistProps) {
  const steps: Step[] = [
    {
      label: "Add your city or school",
      href: "/settings",
      done: hasCity,
    },
    {
      label: "Save your first opportunity",
      href: "/opportunities",
      done: savedCount >= 1,
    },
    {
      label: "Log your first clinical hour",
      href: "/hours",
      done: totalHours >= 1,
    },
    {
      label: "Write your first reflection",
      href: "/hours",
      done: reflectionCount >= 1,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground">
              {allDone ? "You're all set!" : "Get started"}
            </p>
            <span className="text-xs text-muted-foreground">
              {completedCount} of {steps.length} steps complete
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
          aria-label="Dismiss checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Steps */}
      {!allDone && (
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.label}>
              <Link
                to={step.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  step.done
                    ? "opacity-50 cursor-default pointer-events-none"
                    : "hover:bg-white/[0.06]"
                }`}
                tabIndex={step.done ? -1 : 0}
              >
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                )}
                <span
                  className={
                    step.done
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  }
                >
                  {step.label}
                </span>
                {!step.done && (
                  <ChevronRight className="h-4 w-4 ml-auto shrink-0 text-muted-foreground" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* All-done state */}
      {allDone && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            You've completed all the setup steps. Welcome aboard!
          </p>
          <Button size="sm" variant="secondary" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
