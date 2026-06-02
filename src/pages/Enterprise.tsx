import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { ArrowRight, Lock, Network, ShieldCheck } from "lucide-react";
import { FadeUp } from "@/components/enterprise/animations/FadeUp";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/enterprise/animations/StaggerContainer";
import { AnimatedCounter } from "@/components/enterprise/animations/AnimatedCounter";
import { WordReveal } from "@/components/enterprise/animations/WordReveal";
import { ScrollProgress } from "@/components/enterprise/animations/ScrollProgress";
import { PlatformSection } from "@/components/enterprise/PlatformSection";
import { DemoRequestDialog } from "@/components/enterprise/DemoRequestDialog";

const PRODUCES = [
  "Credentialed, ready-to-work volunteers in under 7 days",
  "HIPAA-ready audit trails for every credential check",
  "NPPES-verified clinician records with timestamped primary-source verification",
  "CSV exports for state and federal compliance reporting",
  "A live pipeline of applicants sourced from our pre-health student network",
  "Automated expiration alerts so no credential lapses unnoticed",
];

const FEATURES = [
  {
    eyebrow: "Applicant tracking",
    title: "Email and DocuSign, replaced.",
    body: "Posting positions, reviewing applications, scheduling interviews, sending decisions. Every step that used to live in email, spreadsheets, and DocuSign — in one place.",
    video: "/enterprise/applicant-tracking.mp4",
    slotName: "applicant-tracking",
    demoCaption: "Filter applications, accept a candidate, watch them auto-promote into your team",
  },
  {
    eyebrow: "Credentialing automation",
    title: "Three-week onboarding, in under one.",
    body: "Verify HIPAA training, immunizations, BLS cards, and TB clearances directly from uploaded documents. Cross-check NPI numbers against the federal NPPES registry. Cut onboarding from three weeks to under one.",
    video: "/enterprise/credentialing-automation.mp4",
    slotName: "credentialing-automation",
    demoCaption: "Upload a HIPAA PDF, Claude extracts the fields, NPI verifies live against NPPES",
  },
  {
    eyebrow: "Compliance dashboard",
    title: "Audit-ready, every day.",
    body: "A live view of every credentialed worker's status. Audit-ready CSV exports. Automated expiration tracking. Designed against NCQA and Joint Commission standards.",
    video: "/enterprise/compliance-dashboard.mp4",
    slotName: "compliance-dashboard",
    demoCaption: "Live status across every worker, daily checks, one-click CSV export for audits",
  },
  {
    eyebrow: "Pre-health student network",
    title: "A built-in supply of qualified workers.",
    body: "Over 1,000 pre-health students from universities across the country use ClinicalHours to find clinical experience. Post a position; we route qualified students to your clinic.",
    video: "/enterprise/student-network.mp4",
    slotName: "student-network",
    demoCaption: "1,247 students surfaced as ranked applicants the moment a position opens",
  },
];

const SECURITY = [
  { icon: ShieldCheck, label: "HIPAA-aligned architecture" },
  { icon: Network, label: "Primary-source verification (NPPES)" },
  { icon: Lock, label: "Audit logs on every action" },
];

/** Animated SVG checkmark whose path draws itself when in view. */
function DrawCheck({ className }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <motion.path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        initial={{ pathLength: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
        whileInView={{ pathLength: 1, opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{
          duration: reduce ? 0 : 0.6,
          ease: [0.21, 0.47, 0.32, 0.98],
        }}
      />
    </svg>
  );
}

/** Linear interpolation between two values based on a clamped progress. */
function lerp(input: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  const t = Math.max(0, Math.min(1, (input - inMin) / (inMax - inMin)));
  return outMin + t * (outMax - outMin);
}

const Enterprise = () => {
  // Replicate useScroll/useTransform with a plain scroll listener to avoid
  // the motion/react null-dispatcher crash on first mount.
  const navLightBgRef = useRef<HTMLDivElement>(null);
  const navOverHeroRef = useRef<HTMLDivElement>(null);
  const navOverLightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => {
      const y = window.scrollY;
      const lightBg = lerp(y, 0, 600, 0, 1) * (y > 400 ? 1 : lerp(y, 0, 400, 0, 0.4) / 0.4 * 0.4);
      const overHero = lerp(y, 0, 600, 1, 0);
      const overLight = lerp(y, 0, 600, 0, 1);
      if (navLightBgRef.current) navLightBgRef.current.style.opacity = String(lerp(y, 0, 600, 0, 1));
      if (navOverHeroRef.current) navOverHeroRef.current.style.opacity = String(overHero);
      if (navOverLightRef.current) navOverLightRef.current.style.opacity = String(overLight);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const handleScrollToProblem = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document
      .getElementById("problem")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 antialiased">
      <Helmet>
        <title>ClinicalHours for Healthcare Facilities</title>
        <meta
          name="description"
          content="ClinicalHours is the operating system for community health clinics. Onboarding, credentialing, compliance, and supply — in one place."
        />
        <link rel="canonical" href="https://clinicalhours.lovable.app/enterprise" />
        <meta property="og:title" content="ClinicalHours for Healthcare Facilities" />
        <meta property="og:description" content="The operating system for community health clinics. Onboarding, credentialing, compliance, and supply — in one place." />
        <meta property="og:url" content="https://clinicalhours.lovable.app/enterprise" />
        <meta property="og:type" content="website" />
      </Helmet>

      <ScrollProgress />

      {/* Sticky nav: transparent over the dark hero, white once scrolled into the light content */}
      <header className="fixed top-0 inset-x-0 z-50">
        <div
          ref={navLightBgRef}
          aria-hidden
          className="absolute inset-0 bg-white/90 backdrop-blur-md"
          style={{ opacity: 0 }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-zinc-200"
        />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 h-14 flex items-center justify-between">
          {/* Left: brand wordmark — two stacked copies, one for hero one for light bg */}
          <Link to="/enterprise" className="relative font-mono text-sm tracking-wide">
            <span
              ref={navOverHeroRef}
              className="block"
              style={{ opacity: 1 }}
            >
              <span className="text-white/70">Clinical</span>
              <span className="text-white">Hours</span>
            </span>
            <span
              ref={navOverLightRef}
              className="absolute inset-0"
              style={{ opacity: 0 }}
            >
              <span className="text-zinc-500">Clinical</span>
              <span className="text-zinc-900">Hours</span>
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className="relative hidden sm:inline-block text-[11px] uppercase tracking-[0.2em]"
            >
              <span className="block text-white/60 hover:text-white transition-colors">
                For students
              </span>
            </Link>
            {/* CTA button */}
            <DemoRequestDialog>
            <button
              type="button"
              className="relative inline-flex items-center text-[11px] uppercase tracking-[0.2em] px-4 py-2 transition-colors duration-150 bg-white text-black hover:bg-white/90"
            >
              Request demo
            </button>
            </DemoRequestDialog>
          </nav>
        </div>
      </header>

      {/* HERO — full-viewport dark photograph with text anchored on the left */}
      <section className="relative bg-black text-white overflow-hidden min-h-screen flex flex-col">
        {/* Photograph fills the hero; gradient mask anchors text on the left */}
        <div aria-hidden className="absolute inset-0">
          <img
            src="/enterprise/hero-image.jpg"
            alt=""
            loading="eager"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Heavy left gradient -> clean photo on the right; vertical fade on top/bottom */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.75) 30%, rgba(0,0,0,0.30) 65%, rgba(0,0,0,0.10) 100%), linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.55) 100%)",
            }}
          />
        </div>

        <div className="relative flex-1 flex items-center max-w-7xl w-full mx-auto px-6 lg:px-10 pt-28 pb-20 lg:pt-32 lg:pb-28">
          <div className="max-w-xl lg:max-w-2xl">
            <FadeUp delay={0} y={6}>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.28em] text-white/50 mb-7">
                For healthcare facilities
              </p>
            </FadeUp>

            <h1 className="font-display font-normal text-[40px] sm:text-5xl lg:text-[60px] xl:text-[68px] leading-[1.05] tracking-[-0.015em] text-white">
              <WordReveal
                text={"Workforce operations\nfor safety-net clinics."}
                stagger={0.05}
                delay={0.1}
              />
            </h1>

            <FadeUp delay={0.6}>
              <p className="mt-6 text-sm sm:text-[15px] lg:text-base text-white/65 max-w-md leading-relaxed">
                ClinicalHours is the operating system for the people who keep
                community health clinics running. Onboarding, credentialing,
                compliance, and supply — in one place.
              </p>
            </FadeUp>

            <FadeUp delay={0.85}>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <DemoRequestDialog>
                  <button
                    type="button"
                    className="group inline-flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] px-6 py-3 bg-white text-black hover:bg-white/90 transition-colors duration-150"
                  >
                    Request a demo
                    <ArrowRight className="h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </button>
                </DemoRequestDialog>
                <a
                  href="#problem"
                  onClick={handleScrollToProblem}
                  className="inline-flex items-center justify-center text-[11px] uppercase tracking-[0.22em] px-6 py-3 border border-white/25 text-white/85 hover:border-white/55 hover:bg-white/5 transition-colors duration-150"
                >
                  See how it works
                </a>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* PROBLEM — light */}
      <section id="problem" className="bg-white py-28 sm:py-36 px-6 sm:px-8 scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <h2 className="font-sans text-3xl sm:text-4xl md:text-[40px] font-semibold leading-[1.15] tracking-tight mb-14">
              <span className="text-zinc-400">
                Free clinics run on volunteer labor.
              </span>{" "}
              <span className="text-zinc-900">
                Software was built for everyone else.
              </span>
            </h2>
          </FadeUp>
          <div className="space-y-7 text-base sm:text-lg text-zinc-600 leading-relaxed">
            <FadeUp>
              <p>
                <AnimatedCounter
                  to={1400}
                  suffix="+"
                  className="text-zinc-900 font-semibold"
                />{" "}
                free and charitable clinics serve over{" "}
                <AnimatedCounter
                  to={2}
                  suffix=" million"
                  className="text-zinc-900 font-semibold"
                />{" "}
                patients a year. They don't run on full-time staff. They run
                on rotating part-time clinicians, physician volunteers, and
                pre-health student labor — a workforce that turns over
                constantly and arrives without uniform credentials, training,
                or onboarding.
              </p>
            </FadeUp>
            <FadeUp>
              <p>
                Every one of those workers needs HIPAA training, current
                immunizations, BLS certification, background checks, and
                license verification before they touch a patient. Today the
                clinic coordinator manages all of it — manually — across
                spreadsheets, paper folders, and forwarded emails. One person,
                hundreds of expiration dates, no audit trail.
              </p>
            </FadeUp>
            <FadeUp>
              <p>
                And before any of that matters, most clinics simply can't find
                enough workers to credential in the first place. The supply
                problem is upstream of the compliance problem, and nothing in
                the existing healthcare software stack solves either.
              </p>
            </FadeUp>
          </div>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* PLATFORM — light, OpenLine-style alternating blocks */}
      <PlatformSection features={FEATURES} />

      <hr className="border-zinc-200" />

      {/* OUTPUTS — light */}
      <section className="bg-white py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.28em] text-zinc-500 mb-6">
              Outputs
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-sans text-3xl sm:text-4xl md:text-[40px] font-semibold leading-[1.15] tracking-tight mb-14 text-zinc-900">
              What ClinicalHours produces
            </h2>
          </FadeUp>
          <StaggerContainer
            as="ul"
            className="divide-y divide-zinc-200 border-y border-zinc-200"
            stagger={0.06}
          >
            {PRODUCES.map((item) => (
              <StaggerItem
                key={item}
                as="li"
                className="flex items-start gap-4 py-5 sm:py-6"
              >
                <DrawCheck className="h-5 w-5 text-zinc-900 mt-0.5 shrink-0" />
                <span className="text-base sm:text-lg text-zinc-700 leading-relaxed">
                  {item}
                </span>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* SECURITY & COMPLIANCE — light */}
      <section className="bg-white py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <h2 className="font-sans text-3xl sm:text-4xl md:text-[40px] font-semibold leading-[1.15] tracking-tight mb-16 max-w-2xl text-zinc-900">
              Built for healthcare from day one
            </h2>
          </FadeUp>
          <StaggerContainer
            className="grid grid-cols-1 md:grid-cols-3 gap-px bg-zinc-200 mb-12 border border-zinc-200"
            stagger={0.08}
          >
            {SECURITY.map(({ icon: Icon, label }) => (
              <StaggerItem key={label} className="bg-white p-8 sm:p-10">
                <Icon
                  className="h-5 w-5 text-zinc-900 mb-5"
                  strokeWidth={1.5}
                />
                <p className="font-sans text-base sm:text-lg font-semibold leading-snug text-zinc-900">
                  {label}
                </p>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <FadeUp>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.25em] text-zinc-500">
              <motion.span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-zinc-700"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              SOC 2 Type II in progress
            </div>
          </FadeUp>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* FOUNDERS — light */}
      <section className="bg-white py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <h2 className="font-sans text-3xl sm:text-4xl md:text-[40px] font-semibold leading-[1.15] tracking-tight mb-12 text-zinc-900">
              Built by people who've worked the front desk
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-base sm:text-lg md:text-xl text-zinc-600 leading-relaxed">
              ClinicalHours was built by a team of pre-health and computer
              science students from Texas A&amp;M who spent enough time inside
              free clinics to see, firsthand, how badly software fails the
              organizations that serve the uninsured. The product reflects
              that perspective: every screen exists because we watched a
              coordinator do something on paper that should have taken
              seconds.
            </p>
          </FadeUp>
        </div>
      </section>

      <hr className="border-zinc-200" />

      {/* FINAL CTA — light */}
      <section className="bg-white py-32 sm:py-44 px-6 sm:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: [0.98, 1.02, 1] }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="font-sans text-4xl sm:text-5xl md:text-6xl font-semibold leading-tight tracking-tight mb-12 text-zinc-900"
          >
            Ready to see it?
          </motion.h2>
          <FadeUp delay={0.2}>
            <DemoRequestDialog>
              <motion.button
                type="button"
                className="relative inline-flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.22em] px-9 py-4 bg-zinc-900 text-white overflow-hidden group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={{
                  boxShadow: [
                    "0 0 0 0 rgba(24,24,27,0)",
                    "0 0 0 6px rgba(24,24,27,0.08)",
                    "0 0 0 0 rgba(24,24,27,0)",
                  ],
                }}
                transition={{
                  boxShadow: {
                    duration: 2.4,
                    repeat: Infinity,
                    ease: "easeInOut",
                  },
                }}
              >
                <span className="relative z-10">Request a demo</span>
                <ArrowRight className="relative z-10 h-3 w-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                <span
                  aria-hidden
                  className="absolute inset-0 -translate-x-full bg-white/10 transition-transform duration-300 ease-out group-hover:translate-x-0"
                />
              </motion.button>
            </DemoRequestDialog>
          </FadeUp>
          <FadeUp delay={0.3}>
            <p className="mt-8 text-sm text-zinc-500">
              Or email us directly at{" "}
              <a
                href="mailto:enterprise@clinicalhours.org"
                className="text-zinc-900 hover:text-zinc-700 transition-colors duration-150 underline-offset-4 hover:underline"
              >
                enterprise@clinicalhours.org
              </a>
            </p>
          </FadeUp>
        </div>
      </section>

      {/* FOOTER — minimal light variant for the enterprise page */}
      <footer className="bg-white border-t border-zinc-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12 sm:py-16">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-8">
            <div>
              <Link to="/enterprise" className="font-mono text-sm tracking-wide">
                <span className="text-zinc-500">Clinical</span>
                <span className="text-zinc-900">Hours</span>
              </Link>
              <p className="mt-4 text-sm text-zinc-500 max-w-sm leading-relaxed">
                The operating system for safety-net clinics. Built in
                College Station, Texas.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 sm:gap-10 text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              <Link to="/" className="hover:text-zinc-900 transition-colors">
                For students
              </Link>
              <DemoRequestDialog>
                <button
                  type="button"
                  className="hover:text-zinc-900 transition-colors text-left"
                >
                  Request demo
                </button>
              </DemoRequestDialog>
              <a
                href="mailto:enterprise@clinicalhours.org"
                className="hover:text-zinc-900 transition-colors"
              >
                enterprise@clinicalhours.org
              </a>
            </div>
          </div>
          <div className="mt-12 pt-6 border-t border-zinc-100 text-[10px] uppercase tracking-[0.25em] text-zinc-400">
            © {new Date().getFullYear()} ClinicalHours. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Enterprise;
