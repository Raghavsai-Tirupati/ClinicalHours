import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  BadgeCheck,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Lock,
  Network,
  ShieldCheck,
} from "lucide-react";
import Footer from "@/components/Footer";
import { FadeUp } from "@/components/enterprise/animations/FadeUp";
import {
  StaggerContainer,
  StaggerItem,
} from "@/components/enterprise/animations/StaggerContainer";
import { AnimatedCounter } from "@/components/enterprise/animations/AnimatedCounter";
import { WordReveal } from "@/components/enterprise/animations/WordReveal";
import { VideoSlot } from "@/components/enterprise/animations/VideoSlot";
import { ScrollProgress } from "@/components/enterprise/animations/ScrollProgress";
import { PlatformSection } from "@/components/enterprise/PlatformSection";

const DEMO_MAILTO =
  "mailto:enterprise@clinicalhours.org?subject=ClinicalHours%20Enterprise%20Demo%20Request";

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
    icon: Inbox,
    title: "Applicant tracking",
    body: "Posting positions, reviewing applications, scheduling interviews, sending decisions. Every step that used to live in email, spreadsheets, and DocuSign — in one place.",
    video: "/enterprise/applicant-tracking.mp4",
    slotName: "applicant-tracking",
  },
  {
    icon: BadgeCheck,
    title: "Credentialing automation",
    body: "Verify HIPAA training, immunizations, BLS cards, and TB clearances directly from uploaded documents. Cross-check NPI numbers against the federal NPPES registry. Cut onboarding from three weeks to under one.",
    video: "/enterprise/credentialing-automation.mp4",
    slotName: "credentialing-automation",
  },
  {
    icon: LayoutDashboard,
    title: "Compliance dashboard",
    body: "A live view of every credentialed worker's status. Audit-ready CSV exports. Automated expiration tracking. Designed against NCQA and Joint Commission standards.",
    video: "/enterprise/compliance-dashboard.mp4",
    slotName: "compliance-dashboard",
  },
  {
    icon: GraduationCap,
    title: "Pre-health student network",
    body: "Over 1,000 pre-health students from universities across the country use ClinicalHours to find clinical experience. Post a position; we route qualified students to your clinic.",
    video: "/enterprise/student-network.mp4",
    slotName: "student-network",
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
      strokeWidth={2.5}
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

const Enterprise = () => {
  const { scrollY } = useScroll();
  const navOpacity = useTransform(scrollY, [0, 400, 600], [0, 0.4, 0.95]);
  const navBorder = useTransform(scrollY, [400, 600], [0, 1]);

  const handleScrollToProblem = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document
      .getElementById("problem")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Helmet>
        <title>
          ClinicalHours for Healthcare Facilities — Workforce Operations for Safety-Net Clinics
        </title>
        <meta
          name="description"
          content="ClinicalHours is the operating system for community health clinics. Onboarding, credentialing, compliance, and supply — in one place."
        />
      </Helmet>

      <ScrollProgress />

      {/* Sticky nav: transparent over hero, solid + blur once scrolled */}
      <header className="fixed top-0 inset-x-0 z-50">
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
          style={{ opacity: navOpacity }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-white/10"
          style={{ opacity: navBorder }}
        />
        <div className="relative max-w-6xl mx-auto px-6 sm:px-8 h-14 flex items-center justify-between">
          <Link to="/enterprise" className="font-mono text-sm tracking-wide">
            <span className="text-white/70">Clinical</span>
            <span className="text-white">Hours</span>
            <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-emerald-400/80">
              Enterprise
            </span>
          </Link>
          <nav className="flex items-center gap-6">
            <Link
              to="/"
              className="hidden sm:inline text-xs uppercase tracking-[0.2em] text-white/60 hover:text-white transition-colors"
            >
              For students
            </Link>
            <a
              href={DEMO_MAILTO}
              className="inline-flex items-center text-xs uppercase tracking-[0.2em] px-4 py-2 bg-white text-black hover:bg-white/90 transition-colors duration-150"
            >
              Request demo
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-40 pb-28 sm:pt-48 sm:pb-32 px-6 sm:px-8 overflow-hidden">
        {/* Hero glow — radial emerald wash, softly blurred */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-24 h-[680px] -z-0"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 30%, rgba(52,211,153,0.10) 0%, rgba(52,211,153,0.04) 35%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div className="relative max-w-5xl mx-auto">
          <FadeUp delay={0} y={8}>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-8">
              For healthcare facilities
            </p>
          </FadeUp>

          <h1 className="font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.05] tracking-tight">
            <WordReveal text={"Workforce operations\nfor safety-net clinics."} stagger={0.05} delay={0.1} />
          </h1>

          <FadeUp delay={0.6}>
            <p className="mt-8 text-base sm:text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed">
              ClinicalHours is the operating system for the people who keep
              community health clinics running. Onboarding, credentialing,
              compliance, and supply — in one place.
            </p>
          </FadeUp>

          <FadeUp delay={0.85}>
            <div className="mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <a
                href={DEMO_MAILTO}
                className="group inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] px-8 py-4 bg-white text-black hover:bg-white/90 transition-colors duration-150"
              >
                Request a demo
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              </a>
              <a
                href="#problem"
                onClick={handleScrollToProblem}
                className="inline-flex items-center justify-center text-xs uppercase tracking-[0.25em] px-8 py-4 border border-white/30 text-white hover:border-white/60 hover:bg-white/5 transition-colors duration-150"
              >
                See how it works
              </a>
            </div>
          </FadeUp>

          <FadeUp delay={1.05}>
            <div className="mt-20">
              <VideoSlot
                src="/enterprise/hero-loop.mp4"
                slotName="hero-loop"
                caption="10-second product loop"
              />
            </div>
          </FadeUp>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Logo wall */}
      <section className="py-20 sm:py-24 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/40 text-center mb-12">
              Trusted by clinics serving underserved communities
            </p>
          </FadeUp>
          <StaggerContainer
            className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 items-center"
            stagger={0.08}
          >
            <StaggerItem className="col-span-2 md:col-span-1 flex justify-center md:justify-start">
              <span className="font-mono text-lg sm:text-xl text-white text-center md:text-left leading-tight">
                BCS Free
                <br />
                Health Clinic
              </span>
            </StaggerItem>
            <StaggerItem className="flex justify-center">
              <span className="text-xs uppercase tracking-[0.25em] text-white/25">
                Coming soon
              </span>
            </StaggerItem>
            <StaggerItem className="flex justify-center">
              <span className="text-xs uppercase tracking-[0.25em] text-white/25">
                Coming soon
              </span>
            </StaggerItem>
            <StaggerItem className="flex justify-center">
              <span className="text-xs uppercase tracking-[0.25em] text-white/25">
                Coming soon
              </span>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Problem */}
      <section id="problem" className="py-28 sm:py-36 px-6 sm:px-8 scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-14">
              Free clinics run on volunteer labor. Software was built for
              everyone else.
            </h2>
          </FadeUp>
          <div className="space-y-8 text-base sm:text-lg text-white/70 leading-relaxed">
            <FadeUp>
              <p>
                <AnimatedCounter
                  to={1400}
                  suffix="+"
                  className="text-emerald-400 font-mono"
                />{" "}
                free and charitable clinics serve over{" "}
                <AnimatedCounter
                  to={2}
                  suffix=" million"
                  className="text-emerald-400 font-mono"
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

      <hr className="border-white/10" />

      <PlatformSection features={FEATURES} />

      <hr className="border-white/10" />

      {/* Concrete outputs */}
      <section className="py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-6">
              Outputs
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-14">
              What ClinicalHours produces
            </h2>
          </FadeUp>
          <StaggerContainer
            as="ul"
            className="divide-y divide-white/10 border-y border-white/10"
            stagger={0.06}
          >
            {PRODUCES.map((item) => (
              <StaggerItem
                key={item}
                as="li"
                className="flex items-start gap-4 py-5 sm:py-6"
              >
                <DrawCheck className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
                <span className="text-base sm:text-lg text-white/80 leading-relaxed">
                  {item}
                </span>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Security & compliance */}
      <section className="py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <FadeUp>
            <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-16 max-w-2xl">
              Built for healthcare from day one
            </h2>
          </FadeUp>
          <StaggerContainer
            className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 mb-12"
            stagger={0.08}
          >
            {SECURITY.map(({ icon: Icon, label }) => (
              <StaggerItem key={label} className="bg-black p-8 sm:p-10">
                <Icon
                  className="h-5 w-5 text-emerald-400 mb-5"
                  strokeWidth={1.5}
                />
                <p className="font-mono text-base sm:text-lg leading-snug">
                  {label}
                </p>
              </StaggerItem>
            ))}
          </StaggerContainer>
          <FadeUp>
            <div className="flex items-center gap-3 text-xs sm:text-sm uppercase tracking-[0.25em] text-white/40">
              <motion.span
                aria-hidden
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              SOC 2 Type II in progress
            </div>
          </FadeUp>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Founders */}
      <section className="py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <FadeUp>
            <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-14">
              Built by people who've worked the front desk
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="text-base sm:text-lg md:text-xl text-white/70 leading-relaxed">
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

      <hr className="border-white/10" />

      {/* Final CTA */}
      <section className="py-32 sm:py-44 px-6 sm:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{
              opacity: 1,
              scale: [0.98, 1.02, 1],
            }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.9, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.05] tracking-tight mb-12"
          >
            Ready to see it?
          </motion.h2>
          <FadeUp delay={0.2}>
            <motion.a
              href={DEMO_MAILTO}
              className="relative inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] px-10 py-4 bg-white text-black overflow-hidden group"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{
                boxShadow: [
                  "0 0 0 0 rgba(52,211,153,0)",
                  "0 0 0 6px rgba(52,211,153,0.18)",
                  "0 0 0 0 rgba(52,211,153,0)",
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
              <ArrowRight className="relative z-10 h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
              {/* Hover-fill wipe */}
              <span
                aria-hidden
                className="absolute inset-0 -translate-x-full bg-emerald-400/15 transition-transform duration-300 ease-out group-hover:translate-x-0"
              />
            </motion.a>
          </FadeUp>
          <FadeUp delay={0.3}>
            <p className="mt-8 text-sm text-white/40">
              Or email us directly at{" "}
              <a
                href={DEMO_MAILTO}
                className="text-white/60 hover:text-white transition-colors duration-150"
              >
                enterprise@clinicalhours.org
              </a>
            </p>
          </FadeUp>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Enterprise;
