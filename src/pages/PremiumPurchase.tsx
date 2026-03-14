import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { usePremiumStatus } from "@/hooks/usePremiumStatus";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Check,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Brain,
  Clock,
  FileText,
  Star,
  GraduationCap,
  HeadphonesIcon,
} from "lucide-react";

const FEATURES = [
  { icon: Brain, text: "AI-Powered Opportunity Matching" },
  { icon: Clock, text: "Hour Tracking & Analytics" },
  { icon: FileText, text: "AMCAS Activity Description Generator" },
  { icon: Star, text: "AAMC Competency Mapper" },
  { icon: GraduationCap, text: "School List Builder" },
  { icon: HeadphonesIcon, text: "Priority Support" },
];

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PremiumPurchase() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const success = searchParams.get("success") === "true";
  const canceled = searchParams.get("canceled") === "true";

  const { isPremium, isLoading, premiumExpiresAt, stripeSubscriptionId, refetch } =
    usePremiumStatus();

  // Checkout loading state
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Cancel flow state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [canceledExpiresAt, setCanceledExpiresAt] = useState<string | null>(null);

  // Post-purchase polling — wait for webhook to flip is_premium
  const [activating, setActivating] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (!success) return;

    // If premium is already active (fast webhook), no polling needed
    if (isPremium && !isLoading) return;

    // Start polling: check every 2s up to 10 attempts (20s)
    setActivating(true);
    pollCountRef.current = 0;

    pollRef.current = setInterval(async () => {
      pollCountRef.current += 1;
      await refetch();

      if (pollCountRef.current >= 10) {
        clearInterval(pollRef.current!);
        setActivating(false);
      }
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  // Stop polling once isPremium flips true
  useEffect(() => {
    if (isPremium && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setActivating(false);
    }
  }, [isPremium]);

  // Redirect unauthenticated users to sign in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [isLoading, user, navigate]);

  async function handleSubscribe() {
    setCheckoutLoading(true);
    setCheckoutError(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {},
      });
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
      setCheckoutLoading(false);
    }
  }

  async function handleCancelConfirm() {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-subscription", {
        body: {},
      });
      if (error) throw error;
      if (!data?.expiresAt) throw new Error("Unexpected response from server");
      setCanceledExpiresAt(data.expiresAt);
      setShowCancelConfirm(false);
      await refetch();
    } catch (err) {
      console.error("Cancel error:", err);
      setCancelError(
        err instanceof Error ? err.message : "Something went wrong. Please try again."
      );
    } finally {
      setCancelLoading(false);
    }
  }

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  // ─── State B: Purchase success ───────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-20 pb-16 px-6">
          <div className="max-w-md w-full text-center">
            {activating && !isPremium ? (
              <>
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground font-heading mb-2">
                  Activating your subscription…
                </h1>
                <p className="text-sm text-muted-foreground">
                  Payment received. Hang tight while we activate your premium access.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-foreground font-heading mb-2">
                  Welcome to Premium!
                </h1>
                <p className="text-sm text-muted-foreground mb-8">
                  Your subscription is active. All premium tools are now unlocked.
                </p>
                <Button className="w-full" asChild>
                  <Link to="/dashboard">Go to Dashboard</Link>
                </Button>
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── State C: Checkout canceled ──────────────────────────────────────────────
  if (canceled) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-20 pb-16 px-6">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <XCircle className="h-8 w-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground font-heading mb-2">
              Purchase canceled
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              No charges were made. You can subscribe anytime.
            </p>
            <div className="flex flex-col gap-3">
              <Button className="w-full" onClick={handleSubscribe} disabled={checkoutLoading}>
                {checkoutLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Loading…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Try Again — $4.99/month
                  </>
                )}
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
            {checkoutError && (
              <p className="mt-4 text-sm text-destructive">{checkoutError}</p>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── State E: Premium active, cancellation pending ───────────────────────────
  if (isPremium && premiumExpiresAt) {
    const expiryInFuture = new Date(premiumExpiresAt) > new Date();
    if (expiryInFuture) {
      return (
        <div className="min-h-screen flex flex-col bg-background">
          <Navigation />
          <main className="flex-1 flex items-center justify-center pt-20 pb-16 px-6">
            <div className="max-w-md w-full">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-8 text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/10">
                  <Sparkles className="h-8 w-8 text-amber-400" />
                </div>
                <h1 className="text-xl font-bold text-foreground font-heading mb-2">
                  Your premium membership is active
                </h1>
                <p className="text-sm text-foreground font-medium mb-1">
                  Access until {formatDate(premiumExpiresAt)}
                </p>
                <p className="text-xs text-muted-foreground mb-8">
                  Your subscription will not renew. All premium features remain available until
                  the end of your billing period.
                </p>
                <Button className="w-full" asChild>
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      );
    }
  }

  // ─── State D: Premium active, no pending cancellation ────────────────────────
  if (isPremium) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center pt-20 pb-16 px-6">
          <div className="max-w-md w-full">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
                  <Sparkles className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground font-heading">
                    You're a Premium Member
                  </h1>
                  <p className="text-xs text-amber-400 font-medium">All features unlocked</p>
                </div>
              </div>

              <ul className="space-y-2 mb-8">
                {FEATURES.map((f) => (
                  <li key={f.text} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-sm text-foreground">{f.text}</span>
                  </li>
                ))}
              </ul>

              {/* Show post-cancel confirmation */}
              {canceledExpiresAt ? (
                <div className="rounded-lg border border-border bg-card p-4 mb-4 text-center">
                  <p className="text-sm text-foreground font-medium mb-1">Membership canceled</p>
                  <p className="text-xs text-muted-foreground">
                    You'll have premium access until {formatDate(canceledExpiresAt)}.
                  </p>
                </div>
              ) : showCancelConfirm ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 mb-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      Your premium access will continue until the end of your current billing
                      period. You will not be charged again.
                    </p>
                  </div>
                  {cancelError && (
                    <p className="text-xs text-destructive mb-3">{cancelError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={handleCancelConfirm}
                      disabled={cancelLoading}
                    >
                      {cancelLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        "Yes, Cancel"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowCancelConfirm(false);
                        setCancelError(null);
                      }}
                      disabled={cancelLoading}
                    >
                      Never Mind
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-3">
                <Button className="w-full" asChild>
                  <Link to="/dashboard">Back to Dashboard</Link>
                </Button>
                {!canceledExpiresAt && !showCancelConfirm && stripeSubscriptionId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-muted-foreground hover:text-destructive"
                    onClick={() => setShowCancelConfirm(true)}
                  >
                    Cancel Membership
                  </Button>
                )}
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── State A: Not premium — show upgrade offer ────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 pt-20 pb-16">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 via-transparent to-transparent" />
          <div className="container mx-auto px-6 pt-12 pb-10 relative text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400 mb-5">
              <Sparkles className="h-4 w-4" />
              ClinicalHours Premium
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground font-heading mb-3">
              Upgrade to Premium
            </h1>
            <p className="text-2xl font-semibold text-amber-400 mb-3">$4.99/month</p>
            <p className="text-muted-foreground max-w-lg mx-auto">
              The complete pre-med toolkit. AI-powered tools to find opportunities, track hours,
              write AMCAS descriptions, and plan your entire application.
            </p>
          </div>
        </section>

        {/* Feature list + CTA */}
        <section className="container mx-auto px-6 max-w-lg">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-8">
            <ul className="space-y-3 mb-8">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                    <f.icon className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="text-sm text-foreground">{f.text}</span>
                </li>
              ))}
            </ul>

            {checkoutError && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
                <p className="text-xs text-destructive">{checkoutError}</p>
              </div>
            )}

            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSubscribe}
              disabled={checkoutLoading || !user}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Redirecting to checkout…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Subscribe — $4.99/month
                </>
              )}
            </Button>

            {!user && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                <Link to="/auth" className="text-primary underline underline-offset-2">
                  Sign in
                </Link>{" "}
                to subscribe.
              </p>
            )}

            <p className="mt-4 text-center text-xs text-muted-foreground">
              Secure payment via Stripe. Cancel anytime.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
