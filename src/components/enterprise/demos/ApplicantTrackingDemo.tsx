import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Check, Filter } from "lucide-react";
import { DemoStage } from "./DemoStage";
import { DemoCursor } from "./DemoCursor";

/**
 * Animated mock of the applicant-tracking flow:
 *
 *   1. Idle list of three applicants, all "Reviewed"
 *   2. Filter chip "Pre-med · Available" lights up, list condenses
 *   3. Top row gets a hover ring, then clicked
 *   4. Status flips Reviewed -> Accepted with a green pill
 *   5. Row peels up and slides into the Team panel below
 *   6. Team panel updates count (3 -> 4), then loops
 *
 * Total cycle ≈ 7.4 s. Reduced-motion users see the post-accept frame.
 */

const STEPS = [
  { id: "idle", duration: 700 },
  { id: "filter", duration: 900 },
  { id: "hover", duration: 700 },
  { id: "accept", duration: 1100 },
  { id: "promote", duration: 1100 },
  { id: "settled", duration: 1700 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const CURSOR: Record<StepId, { x: string; y: string; click?: boolean }> = {
  idle: { x: "20%", y: "88%" },
  filter: { x: "88%", y: "8%", click: true },
  hover: { x: "32%", y: "38%" },
  accept: { x: "85%", y: "38%", click: true },
  promote: { x: "60%", y: "78%" },
  settled: { x: "62%", y: "82%" },
};

interface Applicant {
  id: string;
  name: string;
  role: string;
  match: number;
}

const APPLICANTS: Applicant[] = [
  { id: "a1", name: "Maya Patel", role: "Pre-med · UCLA '26", match: 96 },
  { id: "a2", name: "Daniel Kim", role: "Pre-med · NYU '25", match: 91 },
  { id: "a3", name: "Aisha Rahman", role: "Pre-nursing · BU '26", match: 88 },
];

export function ApplicantTrackingDemo() {
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

  // Whether the top row has been promoted to the team
  const promoted = step === "promote" || step === "settled";

  return (
    <DemoStage title="applications · pediatrics volunteer · memorial health">
      <div className="relative px-5 py-5 h-full flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-zinc-900">
              Pediatrics Volunteer
            </p>
            <p className="text-[9px] text-zinc-400 tracking-wide">
              {promoted ? "2" : "3"} active · 1 just accepted
            </p>
          </div>
          <FilterChip active={reached("filter")} />
        </div>

        {/* Applicants table */}
        <div className="rounded-md border border-zinc-200 bg-white overflow-hidden">
          <div className="px-3 py-1.5 border-b border-zinc-100 bg-zinc-50/60 grid grid-cols-12 gap-2 text-[8px] uppercase tracking-wider text-zinc-400 font-semibold">
            <span className="col-span-6">Applicant</span>
            <span className="col-span-3">Match</span>
            <span className="col-span-3 text-right">Status</span>
          </div>
          <div className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {APPLICANTS.map((a, i) => {
                const isTop = i === 0;
                if (isTop && promoted) return null;
                return (
                  <ApplicantRow
                    key={a.id}
                    applicant={a}
                    highlight={isTop && (step === "hover" || step === "accept")}
                    accepted={isTop && step === "accept"}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Team panel */}
        <div className="rounded-md border border-zinc-200 bg-white p-3 mt-auto">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-zinc-700 uppercase tracking-wider">
              Your team
            </p>
            <span className="text-[9px] font-mono text-zinc-400 tabular-nums">
              {promoted ? "4" : "3"} credentialed
            </span>
          </div>
          <div className="mt-2 flex -space-x-1.5 items-center">
            <Avatar tone="zinc" letter="J" />
            <Avatar tone="zinc" letter="R" />
            <Avatar tone="zinc" letter="L" />
            {/* Newly added avatar slides in */}
            <motion.div
              initial={false}
              animate={{
                opacity: promoted ? 1 : 0,
                scale: promoted ? 1 : 0.6,
                x: promoted ? 0 : -12,
              }}
              transition={{ duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
            >
              <Avatar tone="emerald" letter="M" />
            </motion.div>
            {promoted && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, duration: 0.3 }}
                className="ml-3 text-[9px] text-emerald-700 font-medium"
              >
                Maya joined the team
              </motion.span>
            )}
          </div>
        </div>
        {!reduce && <DemoCursor {...CURSOR[step]} />}
      </div>
    </DemoStage>
  );
}

function FilterChip({ active }: { active: boolean }) {
  return (
    <motion.span
      animate={{
        backgroundColor: active ? "rgb(244 244 245)" : "rgb(255 255 255)",
        borderColor: active ? "rgb(212 212 216)" : "rgb(228 228 231)",
        color: active ? "rgb(24 24 27)" : "rgb(161 161 170)",
      }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-1 text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border"
    >
      <Filter className="h-2.5 w-2.5" strokeWidth={2} />
      Pre-med · Available
    </motion.span>
  );
}

interface ApplicantRowProps {
  applicant: Applicant;
  highlight: boolean;
  accepted: boolean;
}

function ApplicantRow({ applicant, highlight, accepted }: ApplicantRowProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, y: -16, transition: { duration: 0.4 } }}
      animate={{
        backgroundColor: highlight ? "rgb(250 250 250)" : "rgb(255 255 255)",
      }}
      transition={{ duration: 0.25 }}
      className="px-3 py-2 grid grid-cols-12 gap-2 items-center text-[10px] relative"
    >
      <div className="col-span-6 flex items-center gap-2">
        <Avatar tone="zinc" letter={applicant.name[0]} />
        <div>
          <p className="text-zinc-800 font-medium leading-tight">
            {applicant.name}
          </p>
          <p className="text-[8px] text-zinc-400">{applicant.role}</p>
        </div>
      </div>
      <div className="col-span-3 font-mono tabular-nums text-zinc-700">
        {applicant.match}%
      </div>
      <div className="col-span-3 flex justify-end">
        <StatusPill accepted={accepted} />
      </div>
      {/* Hover ring */}
      <motion.div
        initial={false}
        animate={{ opacity: highlight ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        className="absolute inset-0 ring-1 ring-zinc-300 rounded pointer-events-none"
      />
    </motion.div>
  );
}

function StatusPill({ accepted }: { accepted: boolean }) {
  return (
    <motion.span
      animate={{
        backgroundColor: accepted ? "rgb(236 253 245)" : "rgb(250 250 250)",
        color: accepted ? "rgb(4 120 87)" : "rgb(82 82 91)",
        borderColor: accepted ? "rgb(167 243 208)" : "rgb(228 228 231)",
      }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
    >
      {accepted ? <Check className="h-2 w-2" strokeWidth={3} /> : null}
      {accepted ? "Accepted" : "Reviewed"}
    </motion.span>
  );
}

function Avatar({ tone, letter }: { tone: "zinc" | "emerald"; letter: string }) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
      : "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold ring-2 ring-white ${cls}`}
    >
      {letter}
    </span>
  );
}

export default ApplicantTrackingDemo;
