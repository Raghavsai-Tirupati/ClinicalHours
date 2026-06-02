// src/components/OnboardingModal.tsx
import { useState } from "react";
import { GraduationCap, Target, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const DONE_KEY = "ch_onboarding_done";
const YEAR_KEY = "ch_apply_year";
const GOAL_KEY = "ch_hours_goal";

const CURRENT_YEAR = new Date().getFullYear();
const APPLY_YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2, CURRENT_YEAR + 3, CURRENT_YEAR + 4];

export function OnboardingModal() {
  const [open, setOpen] = useState<boolean>(() => !localStorage.getItem(DONE_KEY));
  const [step, setStep] = useState<1 | 2>(1);
  const [applyYear, setApplyYear] = useState<number>(CURRENT_YEAR + 2);
  const [hoursGoal, setHoursGoal] = useState<number>(300);

  const dismiss = () => {
    localStorage.setItem(DONE_KEY, "1");
    setOpen(false);
  };

  const handleFinish = () => {
    localStorage.setItem(YEAR_KEY, String(applyYear));
    localStorage.setItem(GOAL_KEY, String(hoursGoal));
    dismiss();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent
        className="max-w-sm p-0 overflow-hidden gap-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Set up your profile</DialogTitle>
        {/* Header */}
        <div className="bg-primary/10 border-b border-border px-6 py-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Step {step} of 2
            </p>
          </div>
          <div className="flex gap-1.5 mt-2">
            <div className={`h-1 rounded-full flex-1 transition-colors ${step >= 1 ? "bg-primary" : "bg-border"}`} />
            <div className={`h-1 rounded-full flex-1 transition-colors ${step >= 2 ? "bg-primary" : "bg-border"}`} />
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="px-6 py-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <GraduationCap className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">When do you plan to apply?</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This helps us show you what to prioritize right now based on your timeline.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {APPLY_YEARS.map((yr) => (
                <button
                  key={yr}
                  onClick={() => setApplyYear(yr)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                    applyYear === yr
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/50"
                  }`}
                >
                  {yr}
                </button>
              ))}
              <button
                onClick={() => setApplyYear(0)}
                className={`col-span-2 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                  applyYear === 0
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/50"
                }`}
              >
                Just exploring
              </button>
            </div>
            <Button className="w-full" onClick={() => setStep(2)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="px-6 py-6 space-y-5">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Set your hours goal</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Competitive applicants typically have 300–500 clinical hours. You can change this anytime.
            </p>
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-3xl font-bold text-foreground">{hoursGoal}</span>
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
              <input
                type="range"
                min={50}
                max={1000}
                step={25}
                value={hoursGoal}
                onChange={(e) => setHoursGoal(parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>50 hrs</span>
                <span className="text-primary font-medium">
                  {hoursGoal >= 300 && hoursGoal <= 500
                    ? "✓ Competitive range"
                    : hoursGoal < 300
                    ? "Below typical"
                    : "Highly competitive"}
                </span>
                <span>1,000 hrs</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={handleFinish} className="flex-1">Get Started</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
