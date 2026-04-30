import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Lock,
  Network,
  ShieldCheck,
} from "lucide-react";
import Footer from "@/components/Footer";

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
  },
  {
    icon: BadgeCheck,
    title: "Credentialing automation",
    body: "Verify HIPAA training, immunizations, BLS cards, and TB clearances directly from uploaded documents. Cross-check NPI numbers against the federal NPPES registry. Cut onboarding from three weeks to under one.",
  },
  {
    icon: LayoutDashboard,
    title: "Compliance dashboard",
    body: "A live view of every credentialed worker's status. Audit-ready CSV exports. Automated expiration tracking. Designed against NCQA and Joint Commission standards.",
  },
  {
    icon: GraduationCap,
    title: "Pre-health student network",
    body: "Over 1,000 pre-health students from universities across the country use ClinicalHours to find clinical experience. Post a position; we route qualified students to your clinic.",
  },
];

const SECURITY = [
  { icon: ShieldCheck, label: "HIPAA-aligned architecture" },
  { icon: Network, label: "Primary-source verification (NPPES)" },
  { icon: Lock, label: "Audit logs on every action" },
];

const Enterprise = () => {
  const handleScrollToProblem = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    document
      .getElementById("problem")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-black text-white antialiased">
      <Helmet>
        <title>ClinicalHours for Healthcare Facilities — Workforce Operations for Safety-Net Clinics</title>
        <meta
          name="description"
          content="ClinicalHours is the operating system for community health clinics. Onboarding, credentialing, compliance, and supply — in one place."
        />
      </Helmet>

      {/* Minimal nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 h-14 flex items-center justify-between">
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
              className="inline-flex items-center text-xs uppercase tracking-[0.2em] px-4 py-2 bg-white text-black hover:bg-white/90 transition-colors"
            >
              Request demo
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-40 pb-28 sm:pt-48 sm:pb-36 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-8">
            For healthcare facilities
          </p>
          <h1 className="font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.05] tracking-tight">
            Workforce operations
            <br />
            for safety-net clinics.
          </h1>
          <p className="mt-8 text-base sm:text-lg md:text-xl text-white/60 max-w-2xl leading-relaxed">
            ClinicalHours is the operating system for the people who keep
            community health clinics running. Onboarding, credentialing,
            compliance, and supply — in one place.
          </p>
          <div className="mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <a
              href={DEMO_MAILTO}
              className="inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] px-8 py-4 bg-white text-black hover:bg-white/90 transition-colors"
            >
              Request a demo
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <a
              href="#problem"
              onClick={handleScrollToProblem}
              className="inline-flex items-center justify-center text-xs uppercase tracking-[0.25em] px-8 py-4 border border-white/30 text-white hover:border-white/60 transition-colors"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Logo wall */}
      <section className="py-20 sm:py-24 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-white/40 text-center mb-12">
            Trusted by clinics serving underserved communities
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 sm:gap-12 items-center">
            <div className="col-span-2 md:col-span-1 flex justify-center md:justify-start">
              <span className="font-mono text-lg sm:text-xl text-white text-center md:text-left leading-tight">
                BCS Free
                <br />
                Health Clinic
              </span>
            </div>
            <div className="flex justify-center">
              <span className="text-xs uppercase tracking-[0.25em] text-white/25">
                Coming soon
              </span>
            </div>
            <div className="flex justify-center">
              <span className="text-xs uppercase tracking-[0.25em] text-white/25">
                Coming soon
              </span>
            </div>
            <div className="flex justify-center">
              <span className="text-xs uppercase tracking-[0.25em] text-white/25">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Problem */}
      <section id="problem" className="py-28 sm:py-36 px-6 sm:px-8 scroll-mt-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-14">
            Free clinics run on volunteer labor. Software was built for
            everyone else.
          </h2>
          <div className="space-y-8 text-base sm:text-lg text-white/70 leading-relaxed">
            <p>
              The clinics serving the country's uninsured don't run on
              full-time staff. They run on rotating part-time clinicians,
              physician volunteers, and pre-health student labor. The
              workforce turns over constantly and arrives without uniform
              credentials, training, or onboarding.
            </p>
            <p>
              Every one of those workers needs HIPAA training, current
              immunizations, BLS certification, background checks, and
              license verification before they touch a patient. Today the
              clinic coordinator manages all of it — manually — across
              spreadsheets, paper folders, and forwarded emails. One person,
              hundreds of expiration dates, no audit trail.
            </p>
            <p>
              And before any of that matters, most clinics simply can't find
              enough workers to credential in the first place. The supply
              problem is upstream of the compliance problem, and nothing in
              the existing healthcare software stack solves either.
            </p>
          </div>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Platform */}
      <section className="py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl mb-16 sm:mb-20">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-6">
              The platform
            </p>
            <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight">
              One platform.
              <br />
              Every workforce operation.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="bg-black p-8 sm:p-10 md:p-12 group"
              >
                <Icon
                  className="h-6 w-6 text-emerald-400 mb-6"
                  strokeWidth={1.5}
                />
                <h3 className="font-mono text-xl sm:text-2xl mb-4 tracking-tight">
                  {title}
                </h3>
                <p className="text-sm sm:text-base text-white/60 leading-relaxed mb-8">
                  {body}
                </p>
                <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-white/50 group-hover:text-white transition-colors">
                  Learn more
                  <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Concrete outputs */}
      <section className="py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-400/80 mb-6">
            Outputs
          </p>
          <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-14">
            What ClinicalHours produces
          </h2>
          <ul className="divide-y divide-white/10 border-y border-white/10">
            {PRODUCES.map((item) => (
              <li
                key={item}
                className="flex items-start gap-4 py-5 sm:py-6"
              >
                <Check
                  className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0"
                  strokeWidth={2}
                />
                <span className="text-base sm:text-lg text-white/80 leading-relaxed">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Security & compliance */}
      <section className="py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-16 max-w-2xl">
            Built for healthcare from day one
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 mb-12">
            {SECURITY.map(({ icon: Icon, label }) => (
              <div key={label} className="bg-black p-8 sm:p-10">
                <Icon
                  className="h-5 w-5 text-emerald-400 mb-5"
                  strokeWidth={1.5}
                />
                <p className="font-mono text-base sm:text-lg leading-snug">
                  {label}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs sm:text-sm uppercase tracking-[0.25em] text-white/40">
            SOC 2 Type II in progress
          </p>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Founders */}
      <section className="py-28 sm:py-36 px-6 sm:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-3xl sm:text-4xl md:text-5xl font-medium leading-[1.1] tracking-tight mb-14">
            Built by people who've worked the front desk
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-white/70 leading-relaxed">
            ClinicalHours was built by a team of pre-health and computer
            science students from Texas A&amp;M who spent enough time inside
            free clinics to see, firsthand, how badly software fails the
            organizations that serve the uninsured. The product reflects
            that perspective: every screen exists because we watched a
            coordinator do something on paper that should have taken
            seconds.
          </p>
        </div>
      </section>

      <hr className="border-white/10" />

      {/* Final CTA */}
      <section className="py-32 sm:py-44 px-6 sm:px-8 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="font-mono text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium leading-[1.05] tracking-tight mb-12">
            Ready to see it?
          </h2>
          <a
            href={DEMO_MAILTO}
            className="inline-flex items-center justify-center gap-2 text-xs uppercase tracking-[0.25em] px-10 py-4 bg-white text-black hover:bg-white/90 transition-colors"
          >
            Request a demo
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <p className="mt-8 text-sm text-white/40">
            Or email us directly at{" "}
            <a
              href={DEMO_MAILTO}
              className="text-white/60 hover:text-white transition-colors"
            >
              enterprise@clinicalhours.org
            </a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Enterprise;
