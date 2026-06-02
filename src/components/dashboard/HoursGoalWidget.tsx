// src/components/dashboard/HoursGoalWidget.tsx
import { useState, useRef, useEffect } from "react";
import { Target, Pencil, Check } from "lucide-react";

const STORAGE_KEY = "ch_hours_goal";
const DEFAULT_GOAL = 300;

interface HoursGoalWidgetProps {
  totalHours: number;
}

export function HoursGoalWidget({ totalHours }: HoursGoalWidgetProps) {
  const [goal, setGoal] = useState<number>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : DEFAULT_GOAL;
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(goal));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const saveGoal = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setGoal(parsed);
      localStorage.setItem(STORAGE_KEY, String(parsed));
    } else {
      setDraft(String(goal));
    }
    setEditing(false);
  };

  const pct = Math.min((totalHours / goal) * 100, 100);
  const remaining = Math.max(goal - totalHours, 0);

  const R = 36;
  const C = 2 * Math.PI * R;
  const dash = (pct / 100) * C;

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center gap-3">
      <div className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
        <Target className="h-3.5 w-3.5" />
        Hours Goal
      </div>

      <div className="relative flex items-center justify-center">
        <svg width="100" height="100" className="-rotate-90">
          <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle
            cx="50" cy="50" r={R}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${C}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-2xl font-bold text-foreground leading-none">{totalHours}</span>
          <span className="text-xs text-muted-foreground">hrs</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>Goal:</span>
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              type="number"
              min={1}
              max={9999}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveGoal();
                if (e.key === "Escape") { setDraft(String(goal)); setEditing(false); }
              }}
              className="w-16 rounded border border-border bg-background px-1.5 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <button onClick={saveGoal} className="text-emerald-400 hover:text-emerald-300">
              <Check className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => { setDraft(String(goal)); setEditing(true); }}
            className="flex items-center gap-1 text-foreground hover:text-primary transition-colors font-medium"
          >
            {goal} hrs
            <Pencil className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="w-full">
        <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-center text-muted-foreground">
          {pct >= 100 ? "Goal reached! 🎉" : `${remaining} hours to go`}
        </p>
      </div>
    </div>
  );
}
