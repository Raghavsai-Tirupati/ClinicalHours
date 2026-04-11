import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfileComplete } from "@/hooks/useProfileComplete";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle2, AlertCircle, MapPin, Building2, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Opportunity {
  id: string;
  name: string;
  location: string;
  description: string | null;
  hospital_id: string | null;
}

interface HospitalAccount {
  id: string;
}

interface AppQuestion {
  id: string;
  question_text: string;
  type: string;
  required: boolean;
  order_index: number;
}

export default function HospitalApplyPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isComplete: isProfileComplete, isLoading: profileLoading, missingFields, profile } = useProfileComplete();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!name.trim() && profile?.full_name) {
      setName(profile.full_name);
    }
  }, [profile?.full_name, name]);

  useEffect(() => {
    if (!email.trim() && user?.email) {
      setEmail(user.email);
    }
  }, [user?.email, email]);

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    async function fetchData() {
      const { data: oppData, error: oppError } = await supabase
        .from("opportunities")
        .select("id, name, location, description, hospital_id")
        .eq("slug", slug)
        .maybeSingle();

      if (oppError || !oppData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setOpportunity(oppData as Opportunity);

      if (!oppData.hospital_id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const { data: accountData } = await supabase
        .from("hospital_accounts")
        .select("id")
        .eq("hospital_id", oppData.hospital_id)
        .maybeSingle();

      if (!accountData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setAccountId((accountData as HospitalAccount).id);

      const { data: qData } = await supabase
        .from("hospital_application_questions")
        .select("id, question_text, type, required, order_index")
        .eq("account_id", (accountData as HospitalAccount).id)
        .order("order_index");

      setQuestions((qData as AppQuestion[]) || []);
      setLoading(false);
    }

    fetchData();
  }, [slug]);

  function validate(): Record<string, string> {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = "Name is required.";
    if (!email.trim()) err.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err.email = "Enter a valid email address.";

    questions.forEach((q) => {
      if (q.required && !(answers[q.id] ?? "").trim()) {
        err[`q_${q.id}`] = "This question is required.";
      }
    });

    return err;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (profileLoading) {
      setError("Checking your profile requirements. Please wait a moment and try again.");
      return;
    }

    if (!isProfileComplete) {
      setError("Please complete the required profile fields before submitting this application.");
      return;
    }

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!opportunity || !accountId) return;

    setSubmitting(true);
    try {
      const pAnswers = questions.map((q) => ({
        question_id: q.id,
        answer_text: (answers[q.id] ?? "").trim() || null,
        answer_options: null,
      }));

      const { error: rpcError } = await supabase.rpc("submit_guest_hospital_application", {
        p_account_id: accountId,
        p_name: name.trim(),
        p_email: email.trim(),
        p_answers: pAnswers,
        p_opportunity_id: opportunity.id,
        p_student_id: user?.id ?? null,
      });

      if (rpcError) {
        if (rpcError.message === "already_applied") {
          throw new Error("You have already applied to this opportunity.");
        }
        throw new Error(rpcError.message);
      }

      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-6">You need an account to apply to this opportunity.</p>
          <Button onClick={() => navigate(`/auth?redirect=/apply/${slug}`)}>Sign in or create account</Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-12 text-center">
          <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Apply Not Available</h1>
          <p className="text-muted-foreground mb-4">
            This opportunity is not configured for applications, or the link may be incorrect.
          </p>
          <Button variant="outline" onClick={() => navigate("/opportunities")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Opportunities
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  if (submitted && opportunity) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-12 flex flex-col items-center text-center">
          <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full shadow-lg">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
            <p className="text-muted-foreground mb-6">
              Your application to <span className="font-semibold">{opportunity.name}</span> has been received.
            </p>
            <Button onClick={() => navigate(`/opportunities/${slug}`)} variant="outline" className="w-full">
              Back to Opportunity
            </Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Button
          variant="ghost"
          onClick={() => navigate(`/opportunities/${slug}`)}
          className="mb-6 -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Opportunity
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
              <Building2 className="h-4 w-4" />
              <span>Apply</span>
            </div>
            <CardTitle className="text-2xl">Apply to {opportunity?.name}</CardTitle>
            <CardDescription className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              {opportunity?.location}
            </CardDescription>
            {opportunity?.description && (
              <p className="text-muted-foreground text-sm mt-2">{opportunity.description}</p>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {!profileLoading && !isProfileComplete && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-amber-300">
                    Complete your profile before applying
                  </p>
                  <p className="text-xs text-amber-200/90 mt-1">
                    Required fields: {missingFields.join(", ")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3"
                    onClick={() => navigate("/settings")}
                  >
                    Go to Settings
                  </Button>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Full Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    className={fieldErrors.name ? "border-destructive" : ""}
                  />
                  {fieldErrors.name && (
                    <p className="text-destructive text-xs mt-1">{fieldErrors.name}</p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className={fieldErrors.email ? "border-destructive" : ""}
                    />
                    {fieldErrors.email && (
                      <p className="text-destructive text-xs mt-1">{fieldErrors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Phone <span className="text-muted-foreground text-xs font-normal">(optional)</span>
                    </label>
                    <Input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {questions.length > 0 && (
                <div className="space-y-4 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Application Questions
                  </h3>
                  {questions.map((q) => (
                    <div key={q.id}>
                      <label className="block text-sm font-medium mb-1.5">
                        {q.question_text} {q.required && <span className="text-destructive">*</span>}
                      </label>
                      <div className="relative">
                        <textarea
                          value={answers[q.id] ?? ""}
                          onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                          rows={4}
                          placeholder="Your answer..."
                          className={`w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px] pb-6 ${
                            fieldErrors[`q_${q.id}`] ? "border-destructive" : "border-input"
                          }`}
                        />
                        <span className="absolute bottom-2 right-3 text-xs text-muted-foreground pointer-events-none">
                          {(answers[q.id] ?? "").length} characters
                        </span>
                      </div>
                      {fieldErrors[`q_${q.id}`] && (
                        <p className="text-destructive text-xs mt-1">{fieldErrors[`q_${q.id}`]}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting || profileLoading || !isProfileComplete}
                className="w-full"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  "Submit Application"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
