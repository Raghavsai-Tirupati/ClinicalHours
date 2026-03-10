import { useState } from "react";
import { Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { Button } from "@/components/ui/button";
import {
  Check,
  Sparkles,
  Clock,
  Brain,
  FileText,
  Users,
  Calendar,
  PenTool,
  DollarSign,
  GraduationCap,
  Search,
  MapPin,
  Star,
  ArrowRight,
  Zap,
} from "lucide-react";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Everything you need to start exploring clinical opportunities.",
    cta: "Current Plan",
    ctaDisabled: true,
    features: [
      { text: "Browse 6,000+ opportunities", included: true },
      { text: "Interactive map view", included: true },
      { text: "Hospital / clinic website links", included: true },
      { text: "Search within 25-mile radius", included: true },
      { text: "Up to 10 search results", included: true },
      { text: "Application cost calculator", included: true },
      { text: "Basic profile", included: true },
      { text: "AI Opportunity Matcher", included: false },
      { text: "Hour Tracker & Reflections", included: false },
      { text: "AMCAS Description Generator", included: false },
      { text: "Competency Mapper", included: false },
      { text: "LOR Tracker", included: false },
      { text: "Timeline Planner", included: false },
      { text: "Secondary Essay Engine", included: false },
      { text: "School List Builder", included: false },
    ],
  },
  {
    name: "Premium",
    price: "$9.99",
    period: "/ month",
    description: "The complete pre-med toolkit. AI-powered tools to maximize your application.",
    cta: "Upgrade to Premium",
    ctaDisabled: false,
    popular: true,
    features: [
      { text: "Everything in Free", included: true },
      { text: "Unlimited search radius & results", included: true },
      { text: "AI Opportunity Matcher (quiz)", included: true },
      { text: "Hour Tracker & Reflection Journal", included: true },
      { text: "AMCAS Activity Description Generator", included: true },
      { text: "Most Meaningful Experience Drafter", included: true },
      { text: "Competency Mapper (17 AAMC competencies)", included: true },
      { text: "LOR Tracker & Relationship CRM", included: true },
      { text: "Timeline & Deadline Planner", included: true },
      { text: "Secondary Essay Reuse Engine", included: true },
      { text: "AI School List Builder", included: true },
      { text: "PDF export for all data", included: true },
      { text: "Priority support", included: true },
    ],
  },
  {
    name: "Premium Annual",
    price: "$79.99",
    period: "/ year",
    description: "Save 33% with an annual plan. Best value for your application cycle.",
    cta: "Upgrade to Annual",
    ctaDisabled: false,
    features: [
      { text: "Everything in Premium", included: true },
      { text: "Save $39.89 vs. monthly", included: true },
      { text: "Full application cycle coverage", included: true },
      { text: "Early access to new features", included: true },
    ],
  },
];

const FEATURE_HIGHLIGHTS = [
  {
    icon: Brain,
    title: "AI Opportunity Matcher",
    description: "Take a quick quiz and get personalized matches from 6,000+ opportunities ranked by fit.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Clock,
    title: "Hour Tracker & Reflections",
    description: "Log clinical hours, write structured reflections, and track progress across all activities.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: FileText,
    title: "AMCAS Description Generator",
    description: "AI converts your logged hours and reflections into polished 700-character activity descriptions.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Star,
    title: "Competency Mapper",
    description: "Auto-tags reflections against all 17 AAMC premed competencies with gap analysis.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Users,
    title: "LOR Tracker",
    description: "CRM-style tracker for recommendation letters with status pipeline and deadline alerts.",
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    icon: Calendar,
    title: "Timeline Planner",
    description: "Personalized application timeline with month-by-month milestones for your target cycle.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
  {
    icon: PenTool,
    title: "Secondary Essay Engine",
    description: "Classify prompts into archetypes and surface relevant story fragments from your reflections.",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    icon: GraduationCap,
    title: "School List Builder",
    description: "AI-powered reach/target/safety school list based on your GPA, MCAT, and preferences.",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
];

const Premium = () => {
  const { user } = useAuth();
  const { isPremium, activatePremium, deactivatePremium } = usePremiumStatus();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-20">
        {/* Active Premium Banner */}
        {isPremium && (
          <div className="container mx-auto px-6 pt-4">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">Premium is active — all features are unlocked.</span>
              </div>
              <button
                onClick={() => deactivatePremium()}
                className="text-xs text-emerald-400/70 hover:text-emerald-400 transition-colors underline"
              >
                Deactivate (for testing)
              </button>
            </div>
          </div>
        )}

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
          <div className="container mx-auto px-6 pt-16 pb-12 relative">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400 mb-6">
                <Sparkles className="h-4 w-4" />
                ClinicalHours Premium
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground font-heading mb-4">
                Your complete pre-med
                <br />
                application toolkit
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                AI-powered tools to find opportunities, track hours, write AMCAS descriptions,
                map competencies, manage LORs, and plan your entire application timeline.
              </p>
            </div>
          </div>
        </section>

        {/* Billing Toggle */}
        <section className="container mx-auto px-6 pb-4">
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                billingCycle === "monthly"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("annual")}
              className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                billingCycle === "annual"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs text-emerald-400">Save 33%</span>
            </button>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="container mx-auto px-6 pb-20">
          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
            {PLANS.map((plan) => {
              const isCurrentPlan = (isPremium && plan.name !== "Free") || (!isPremium && plan.name === "Free");
              const showPlan =
                plan.name === "Free" ||
                (plan.name === "Premium" && billingCycle === "monthly") ||
                (plan.name === "Premium Annual" && billingCycle === "annual");

              if (!showPlan && plan.name !== "Free") return null;

              return (
                <div
                  key={plan.name}
                  className={`relative rounded-lg border p-6 ${
                    plan.popular
                      ? "border-amber-500/40 bg-amber-500/5"
                      : "border-border bg-card"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-black">
                        <Zap className="h-3 w-3" /> Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.period}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  {plan.name === "Free" && isPremium ? (
                    <Button
                      className="w-full mb-6"
                      variant="outline"
                      onClick={() => deactivatePremium()}
                    >
                      Switch to Free
                    </Button>
                  ) : isCurrentPlan ? (
                    <Button className="w-full mb-6" variant="outline" disabled>
                      Current Plan
                    </Button>
                  ) : !user ? (
                    <Button className="w-full mb-6" variant={plan.popular ? "default" : "outline"} asChild>
                      <Link to="/auth">Sign Up First</Link>
                    </Button>
                  ) : (
                    <Button
                      className="w-full mb-6"
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => activatePremium()}
                    >
                      {plan.cta}
                    </Button>
                  )}

                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-start gap-2.5">
                        {feature.included ? (
                          <Check className="h-4 w-4 mt-0.5 text-emerald-400 shrink-0" />
                        ) : (
                          <div className="h-4 w-4 mt-0.5 rounded-full border border-border shrink-0" />
                        )}
                        <span
                          className={`text-sm ${
                            feature.included ? "text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature Highlights */}
        <section className="border-t border-border bg-card/50">
          <div className="container mx-auto px-6 py-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground font-heading mb-3">
                Everything you need for a competitive application
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                From finding opportunities to submitting your AMCAS, ClinicalHours Premium
                covers every step of the pre-med journey.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
              {FEATURE_HIGHLIGHTS.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-lg border border-border bg-card p-5 hover:border-border/80 transition-colors"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${feature.bg} mb-4`}>
                    <feature.icon className={`h-5 w-5 ${feature.color}`} />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground mb-1.5">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Free Tools Section */}
        <section className="border-t border-border">
          <div className="container mx-auto px-6 py-16">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-foreground font-heading mb-2">
                Always Free
              </h2>
              <p className="text-muted-foreground">
                These core tools will always be free for all students.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
              {[
                { icon: MapPin, text: "Interactive map of 6,000+ locations" },
                { icon: Search, text: "Search hospitals & clinics" },
                { icon: DollarSign, text: "Application cost calculator" },
                { icon: Star, text: "Reviews & community Q&A" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
                  <item.icon className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm text-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border bg-gradient-to-b from-amber-500/5 to-transparent">
          <div className="container mx-auto px-6 py-16 text-center">
            <h2 className="text-2xl font-bold text-foreground font-heading mb-3">
              Ready to level up your application?
            </h2>
            <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
              Join thousands of pre-med students using ClinicalHours Premium to
              build stronger applications.
            </p>
            {isPremium ? (
              <p className="text-sm text-emerald-400 font-medium">You're already a Premium member. Enjoy all features!</p>
            ) : user ? (
              <Button size="lg" className="gap-2" onClick={() => activatePremium()}>
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="lg" className="gap-2" asChild>
                <Link to="/auth">
                  Get Started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Premium;
