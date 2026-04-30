import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Sparkles, GraduationCap } from "lucide-react";
import { DemoStage } from "./DemoStage";

/**
 * Animated mock of the pre-health student network match flow:
 *
 *   1. Counter ticks "1,247 students" with a soft pulse
 *   2. Position card "Pediatrics Volunteer · Memorial Health" slides in
 *   3. "Routing qualified students…" spinner pulse
 *   4. Four ranked candidate rows fade in with staggered match scores
 *   5. Hold the success state, then loop
 *
 * Total cycle ≈ 7 s. Reduced-motion users see the post-match frame.
 */

const STEPS = [
  { id: "counting", duration: 1400 },
  { id: "position", duration: 800 },
  { id: "routing", duration: 1100 },
  { id: "ranked", duration: 2400 },
  { id: "settled", duration: 1300 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const CANDIDATES = [
  { id: "c1", name: "Maya Patel", school: "UCLA '26", match: 94 },
  { id: "c2", name: "Daniel Kim", school: "NYU '25", match: 92 },
  { id: "c3", name: "Aisha Rahman", school: "BU '26", match: 89 },
  { id: "c4", name: "Jordan Lee", school: "Emory '25", match: 87 },
];

export function StudentNetworkDemo() {
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
  const reached = (id: StepId) =>
    STEPS.findIndex((s) => s.id === id) <= stepIdx;

  return (
    <DemoStage title="student network · live match · clinicalhours">
      <div className="px-5 py-5 h-full flex flex-col gap-3">
        {/* Counter header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-zinc-700" strokeWidth={1.5} />
            <div>
              <p className="text-[11px] font-semibold text-zinc-900 leading-tight">
                <Counter target={1247} active={step === "counting"} reduce={!!reduce} />
                <span className="text-zinc-500 font-normal"> pre-health students</span>
              </p>
              <p className="text-[9px] text-zinc-400 tracking-wide">
                Active · across 84 universities
              </p>
            </div>
          </div>
          <motion.span
            animate={{ opacity: step === "counting" ? [0.4, 1, 0.4] : 0.6 }}
            transition={{
              duration: 1.4,
              repeat: step === "counting" ? Infinity : 0,
            }}
            className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </motion.span>
        </div>

        {/* Position card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={
            reached("position")
              ? { opacity: 1, y: 0 }
              : { opacity: 0, y: 8 }
          }
          transition={{ duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2.5 flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] font-semibold text-zinc-800">
              Pediatrics Volunteer
            </p>
            <p className="text-[9px] text-zinc-400">
              Memorial Health · 4 hrs/wk · in-person
            </p>
          </div>
          <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-500 bg-zinc-50 border border-zinc-200 px-1.5 py-0.5 rounded">
            Just posted
          </span>
        </motion.div>

        {/* Match panel */}
        <div className="flex-1 rounded-md border border-zinc-200 bg-white p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-zinc-700 uppercase tracking-wider">
              Ranked candidates
            </p>
            {step === "routing" ? (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="inline-flex items-center gap-1 text-[9px] text-zinc-500"
              >
                <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                Routing…
              </motion.span>
            ) : reached("ranked") ? (
              <span className="text-[9px] text-emerald-700 font-medium">
                4 strong matches
              </span>
            ) : null}
          </div>

          <div className="space-y-1">
            {CANDIDATES.map((c, i) => (
              <CandidateRow
                key={c.id}
                candidate={c}
                show={reached("ranked")}
                index={i}
              />
            ))}
          </div>
        </div>
      </div>
    </DemoStage>
  );
}

function Counter({
  target,
  active,
  reduce,
}: {
  target: number;
  active: boolean;
  reduce: boolean;
}) {
  const [n, setN] = useState(reduce ? target : 0);

  useEffect(() => {
    if (reduce) {
      setN(target);
      return;
    }
    if (!active) {
      setN(target);
      return;
    }
    setN(0);
    const start = performance.now();
    const dur = 1200;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, reduce]);

  return (
    <span className="font-mono tabular-nums text-zinc-900">
      {n.toLocaleString()}
    </span>
  );
}

interface CandidateRowProps {
  candidate: (typeof CANDIDATES)[number];
  show: boolean;
  index: number;
}

function CandidateRow({ candidate, show, index }: CandidateRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      transition={{
        duration: 0.3,
        delay: show ? index * 0.12 : 0,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="flex items-center justify-between gap-3 px-1 py-1"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[8px] font-semibold text-zinc-600 ring-2 ring-white">
          {candidate.name[0]}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] text-zinc-800 font-medium leading-tight truncate">
            {candidate.name}
          </p>
          <p className="text-[8px] text-zinc-400 truncate">
            {candidate.school}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <MatchBar value={candidate.match} show={show} delay={index * 0.12} />
        <span className="font-mono tabular-nums text-[10px] text-zinc-700 w-7 text-right">
          {candidate.match}%
        </span>
      </div>
    </motion.div>
  );
}

function MatchBar({
  value,
  show,
  delay,
}: {
  value: number;
  show: boolean;
  delay: number;
}) {
  return (
    <div className="relative h-1 w-16 rounded-full bg-zinc-100 overflow-hidden">
      <motion.div
        initial={{ width: "0%" }}
        animate={{ width: show ? `${value}%` : "0%" }}
        transition={{
          duration: 0.6,
          delay: show ? delay + 0.1 : 0,
          ease: [0.21, 0.47, 0.32, 0.98],
        }}
        className="absolute inset-y-0 left-0 bg-zinc-700"
      />
    </div>
  );
}

export default StudentNetworkDemo;
