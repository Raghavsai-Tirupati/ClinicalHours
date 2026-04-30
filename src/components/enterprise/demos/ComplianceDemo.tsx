import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, AlertCircle, Clock, Download, RefreshCw } from "lucide-react";
import { DemoStage } from "./DemoStage";

/**
 * Animated mock of the compliance dashboard:
 *
 *   1. Three metric cards count up (47 / 3 / 1)
 *   2. "Run daily checks" button pulses, then spinner cycles
 *   3. "Last checked" timestamp ticks to "just now"
 *   4. Cursor moves over to "Export CSV" — it depresses, download chip flies down
 *   5. Hold the success state, then loop
 *
 * Total cycle ≈ 8 s. Reduced-motion users see the post-export frame.
 */

const STEPS = [
  { id: "counting", duration: 1600 },
  { id: "idle", duration: 700 },
  { id: "running", duration: 1400 },
  { id: "checked", duration: 800 },
  { id: "exporting", duration: 1100 },
  { id: "exported", duration: 1800 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

export function ComplianceDemo() {
  const reduce = useReducedMotion();
  const [stepIdx, setStepIdx] = useState(reduce ? STEPS.length - 1 : 0);

  useEffect(() => {
    if (reduce) return;
    const t = window.setTimeout(
      () => setStepIdx((i) => (i + 1) % STEPS.length),
      STEPS[stepIdx].duration,
    );
    return () => window.clearTimeout(t);
  }, [stepIdx, reduce]);

  const step: StepId = STEPS[stepIdx].id;

  const counting = step === "counting";
  const running = step === "running";
  const justChecked = step === "checked" || step === "exporting" || step === "exported";
  const exporting = step === "exporting";
  const exported = step === "exported";

  return (
    <DemoStage title="compliance · memorial health · all credentials">
      <div className="px-5 py-5 h-full flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-zinc-900">
              Credentialing Status
            </p>
            <p className="text-[9px] text-zinc-400 tracking-wide">
              51 credentialed workers · NCQA & Joint Commission aligned
            </p>
          </div>
          <span className="text-[9px] font-mono text-zinc-400">
            {justChecked ? "checked just now" : "checked 4h ago"}
          </span>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            tone="emerald"
            icon={CheckCircle2}
            target={47}
            counting={counting}
            label="Compliant"
          />
          <MetricCard
            tone="amber"
            icon={Clock}
            target={3}
            counting={counting}
            label="Expiring < 30d"
          />
          <MetricCard
            tone="rose"
            icon={AlertCircle}
            target={1}
            counting={counting}
            label="Overdue"
          />
        </div>

        {/* Compliance bar */}
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-semibold text-zinc-700 uppercase tracking-wider">
              92% compliant
            </p>
            <p className="text-[9px] text-zinc-400 tabular-nums">47 / 51</p>
          </div>
          <div className="relative h-1.5 rounded-full bg-zinc-100 overflow-hidden">
            <motion.div
              initial={{ width: "0%" }}
              animate={{ width: counting ? "0%" : "92%" }}
              transition={{ duration: 1.2, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="absolute inset-y-0 left-0 bg-emerald-500"
            />
          </div>
        </div>

        {/* Action row */}
        <div className="mt-auto flex items-center justify-between gap-2">
          <ActionButton
            primary
            active={running}
            icon={RefreshCw}
            label={running ? "Running checks…" : "Run daily checks"}
            spinIcon={running}
          />
          <div className="relative">
            <ActionButton
              active={exporting}
              icon={Download}
              label={exported ? "Exported" : "Export CSV"}
            />
            {/* Tiny CSV chip flies down on export */}
            {exporting && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: [0, 1, 1, 0], y: [-6, 4, 18, 28] }}
                transition={{ duration: 1, ease: "easeIn" }}
                className="absolute right-2 top-full mt-1 inline-flex items-center gap-1 text-[8px] font-mono text-zinc-700 bg-white border border-zinc-200 rounded px-1 py-0.5 shadow-sm"
              >
                compliance.csv
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </DemoStage>
  );
}

interface MetricCardProps {
  tone: "emerald" | "amber" | "rose";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  target: number;
  counting: boolean;
  label: string;
}

function MetricCard({ tone, icon: Icon, target, counting, label }: MetricCardProps) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setN(target);
      return;
    }
    if (!counting) {
      setN(target);
      return;
    }
    setN(0);
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      // ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [counting, target, reduce]);

  const palette = {
    emerald: {
      ring: "border-emerald-100",
      bg: "bg-emerald-50/40",
      icon: "text-emerald-600",
      num: "text-emerald-700",
    },
    amber: {
      ring: "border-amber-100",
      bg: "bg-amber-50/40",
      icon: "text-amber-600",
      num: "text-amber-700",
    },
    rose: {
      ring: "border-rose-100",
      bg: "bg-rose-50/40",
      icon: "text-rose-600",
      num: "text-rose-700",
    },
  }[tone];

  return (
    <div
      className={`rounded-md border ${palette.ring} ${palette.bg} px-3 py-2.5 flex flex-col gap-0.5`}
    >
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3 w-3 ${palette.icon}`} strokeWidth={2} />
        <span className="text-[8px] uppercase tracking-wider text-zinc-500 font-semibold">
          {label}
        </span>
      </div>
      <span
        className={`font-mono tabular-nums text-2xl font-semibold leading-none ${palette.num}`}
      >
        {n}
      </span>
    </div>
  );
}

interface ActionButtonProps {
  primary?: boolean;
  active?: boolean;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  spinIcon?: boolean;
}

function ActionButton({ primary, active, icon: Icon, label, spinIcon }: ActionButtonProps) {
  return (
    <motion.button
      type="button"
      animate={{
        scale: active ? 0.97 : 1,
        boxShadow: active
          ? "0 0 0 3px rgb(228 228 231)"
          : "0 0 0 0px rgba(0,0,0,0)",
      }}
      transition={{ duration: 0.2 }}
      className={`inline-flex items-center gap-1.5 text-[10px] font-medium px-2.5 py-1.5 rounded border ${
        primary
          ? "bg-zinc-900 text-white border-zinc-900"
          : "bg-white text-zinc-700 border-zinc-200"
      }`}
    >
      <Icon
        className={`h-3 w-3 ${spinIcon ? "animate-spin" : ""}`}
        strokeWidth={2}
      />
      {label}
    </motion.button>
  );
}

export default ComplianceDemo;
