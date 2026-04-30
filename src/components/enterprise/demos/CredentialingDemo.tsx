import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FileText, Loader2, Check, ShieldCheck } from "lucide-react";
import { DemoStage } from "./DemoStage";
import { DemoCursor } from "./DemoCursor";

/**
 * Animated mock of the credentialing automation flow:
 *
 *   1. Empty HIPAA card with an "Upload & extract" affordance
 *   2. PDF tile drops in, Claude spinner
 *   3. Three extracted fields stagger in (issued / expires / provider)
 *   4. NPI input materialises, number types itself
 *   5. NPPES spinner, then green primary-source-verified badge
 *   6. Hold the success state, then loop
 *
 * Timed against a 7.5 s master loop. Reduced-motion users see the final
 * frame statically.
 */

const STEPS = [
  { id: "idle", duration: 600 },
  { id: "pdf-drop", duration: 700 },
  { id: "extracting", duration: 1100 },
  { id: "fields", duration: 900 },
  { id: "npi-typing", duration: 900 },
  { id: "verifying", duration: 1000 },
  { id: "verified", duration: 1700 },
] as const;

type StepId = (typeof STEPS)[number]["id"];

const CURSOR: Record<StepId, { x: string; y: string; click?: boolean }> = {
  idle: { x: "10%", y: "85%" },
  "pdf-drop": { x: "22%", y: "55%", click: true },
  extracting: { x: "26%", y: "60%" },
  fields: { x: "70%", y: "40%" },
  "npi-typing": { x: "80%", y: "70%" },
  verifying: { x: "30%", y: "92%" },
  verified: { x: "32%", y: "92%" },
};

export function CredentialingDemo() {
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
    <DemoStage title="credentialing case · sarah chen, md">
      <div className="relative px-5 py-5 h-full flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold text-zinc-900">
              Sarah Chen, MD
            </p>
            <p className="text-[9px] text-zinc-400 tracking-wide">
              4 of 5 credentials verified
            </p>
          </div>
          <span className="text-[9px] font-mono text-zinc-400">
            CASE 0042
          </span>
        </div>

        {/* HIPAA card — main animated surface */}
        <div className="flex-1 relative rounded-md border border-zinc-200 bg-white p-4">
          {/* Card title row */}
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-zinc-800">
              HIPAA Training
            </p>
            <StatusPill verified={step === "verified"} />
          </div>

          {/* Body changes between empty -> PDF -> fields -> success */}
          <div className="mt-3 grid grid-cols-12 gap-3 items-start">
            {/* Left side: PDF drop zone */}
            <div className="col-span-4 relative">
              <div className="aspect-[3/4] rounded-md border border-dashed border-zinc-200 bg-zinc-50 flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0, y: -12, scale: 0.9 }}
                  animate={
                    reached("pdf-drop")
                      ? { opacity: 1, y: 0, scale: 1 }
                      : { opacity: 0, y: -12, scale: 0.9 }
                  }
                  transition={{ duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="flex flex-col items-center gap-1 text-zinc-500"
                >
                  <FileText className="h-6 w-6" strokeWidth={1.5} />
                  <span className="text-[8px] font-mono">hipaa-2024.pdf</span>
                </motion.div>
              </div>
              {/* Loading overlay during extraction */}
              <AnimatedOverlay show={step === "extracting"}>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-700" />
                <span className="text-[9px] text-zinc-700">
                  Claude extracting…
                </span>
              </AnimatedOverlay>
            </div>

            {/* Right side: extracted fields */}
            <div className="col-span-8 space-y-1.5">
              <FieldRow
                label="Issued"
                value="Aug 15, 2024"
                show={reached("fields")}
                index={0}
              />
              <FieldRow
                label="Expires"
                value="Aug 15, 2025"
                show={reached("fields")}
                index={1}
              />
              <FieldRow
                label="Provider"
                value="Memorial Health"
                show={reached("fields")}
                index={2}
              />
              <FieldRow
                label="NPI"
                value={
                  <NpiTypewriter
                    target="1234567890"
                    active={
                      step === "npi-typing" ||
                      step === "verifying" ||
                      step === "verified"
                    }
                  />
                }
                show={reached("npi-typing")}
                index={3}
              />
            </div>
          </div>

          {/* Bottom badge slot — verifying spinner -> PSV badge */}
          <div className="mt-3 h-7 flex items-center">
            {step === "verifying" && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-1.5 text-[9px] text-zinc-600"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Querying federal NPPES registry…
              </motion.div>
            )}
            {step === "verified" && (
              <motion.div
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
                className="inline-flex items-center gap-1.5 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
              >
                <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                Primary-source verified · just now
              </motion.div>
            )}
          </div>
        </div>
        {!reduce && <DemoCursor {...CURSOR[step]} />}
      </div>
    </DemoStage>
  );
}

function StatusPill({ verified }: { verified: boolean }) {
  return (
    <motion.span
      animate={{
        backgroundColor: verified ? "rgb(236 253 245)" : "rgb(250 250 250)",
        color: verified ? "rgb(4 120 87)" : "rgb(113 113 122)",
        borderColor: verified ? "rgb(167 243 208)" : "rgb(228 228 231)",
      }}
      transition={{ duration: 0.3 }}
      className="inline-flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border"
    >
      {verified ? (
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      ) : null}
      {verified ? "Verified" : "Pending"}
    </motion.span>
  );
}

function FieldRow({
  label,
  value,
  show,
  index,
}: {
  label: string;
  value: React.ReactNode;
  show: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={show ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      transition={{
        duration: 0.3,
        delay: show ? index * 0.08 : 0,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className="flex items-center justify-between text-[10px]"
    >
      <span className="text-zinc-400 uppercase tracking-wider text-[8px]">
        {label}
      </span>
      <span className="font-mono text-zinc-800 tabular-nums">{value}</span>
    </motion.div>
  );
}

function NpiTypewriter({
  target,
  active,
}: {
  target: string;
  active: boolean;
}) {
  const [count, setCount] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!active) {
      setCount(0);
      return;
    }
    if (reduce) {
      setCount(target.length);
      return;
    }
    let i = 0;
    const interval = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= target.length) window.clearInterval(interval);
    }, 60);
    return () => window.clearInterval(interval);
  }, [active, target, reduce]);

  return <>{target.slice(0, count)}</>;
}

function AnimatedOverlay({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: show ? 1 : 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/85 backdrop-blur-[1px] rounded-md pointer-events-none"
    >
      {children}
    </motion.div>
  );
}

export default CredentialingDemo;
