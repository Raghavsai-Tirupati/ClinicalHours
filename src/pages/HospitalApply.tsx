import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserPlus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  question_text: string;
  type: "short_text" | "long_text" | "mcq" | "checkbox";
  required: boolean;
  options: string[] | null;
  order_index: number;
}

interface HospitalInfo {
  name: string;
  city: string | null;
  state: string | null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HospitalApply() {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const { user, isReady, isGuest } = useAuth();
  const isAuthenticated = isReady && !!user && !isGuest;

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  // Answers map: question_id → string | string[]
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Guest-only fields
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestEmail2, setGuestEmail2] = useState(""); // for confirm email
  const [guestFieldErrors, setGuestFieldErrors] = useState<{ name?: string; email?: string; email2?: string }>({});

  // Fetch hospital info + questions + (for auth'd users) existing application
  useEffect(() => {
    if (!accountId || !isReady) return;

    async function fetchData() {
      const { data: acc } = await supabase
        .from("hospital_accounts")
        .select("id, hospital_id, hospitals(name, city, state)")
        .eq("id", accountId)
        .maybeSingle();

      if (!acc) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hosp = (acc as any).hospitals as HospitalInfo | null;
      setHospitalInfo(hosp);

      const { data: qs } = await supabase
        .from("hospital_application_questions")
        .select("id, question_text, type, required, options, order_index")
        .eq("account_id", accountId)
        .order("order_index", { ascending: true });
      setQuestions((qs as Question[]) || []);

      // For authenticated users, check if they already applied
      if (user && !isGuest) {
        const { data: existing } = await supabase
          .from("hospital_applications")
          .select("id")
          .eq("account_id", accountId!)
          .eq("student_id", user.id)
          .maybeSingle();
        if (existing) setAlreadyApplied(true);
      }

      setLoading(false);
    }

    fetchData();
  }, [accountId, isReady, user, isGuest]);

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateGuestFields(): boolean {
    const errs: typeof guestFieldErrors = {};
    if (!guestEmail.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (guestEmail.trim() && guestEmail2.trim() !== guestEmail.trim()) {
      errs.email2 = "Emails do not match.";
    }
    setGuestFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function validateQuestions(): Record<string, string> {
    const errors: Record<string, string> = {};
    questions.forEach((q) => {
      if (!q.required) return;
      const val = answers[q.id];
      const empty =
        !val ||
        (Array.isArray(val) && val.length === 0) ||
        (typeof val === "string" && !val.trim());
      if (empty) errors[q.id] = "This field is required.";
    });
    return errors;
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate guest fields if not authenticated
    if (!isAuthenticated) {
      if (!validateGuestFields()) return;
    }

    // Validate question answers
    const qErrors = validateQuestions();
    setFieldErrors(qErrors);
    if (Object.keys(qErrors).length > 0) return;

    setSubmitting(true);

    try {
      if (isAuthenticated && user) {
        // ── Authenticated flow ──────────────────────────────────────────────
        const { data: app, error: appErr } = await supabase
          .from("hospital_applications")
          .insert({
            account_id: accountId,
            student_id: user.id,
            status: "submitted",
          })
          .select("id")
          .single();

        if (appErr || !app) {
          if (appErr?.code === "23505") {
            setAlreadyApplied(true);
            setSubmitting(false);
            return;
          }
          throw new Error(appErr?.message || "Failed to submit application.");
        }

        const answerRows = buildAnswerRows(app.id);
        if (answerRows.length > 0) {
          const { error: ansErr } = await supabase
            .from("hospital_application_answers")
            .insert(answerRows);
          if (ansErr) throw new Error(ansErr.message);
        }
      } else {
        // ── Guest flow via SECURITY DEFINER RPC ─────────────────────────────
        const answersPayload = questions.map((q) => {
          const val = answers[q.id];
          const isMulti = q.type === "checkbox";
          return {
            question_id: q.id,
            answer_text:
              !isMulti && typeof val === "string" ? val.trim() || null : null,
            answer_options:
              isMulti && Array.isArray(val) ? val : null,
          };
        });

        const { error: rpcErr } = await supabase.rpc(
          "submit_guest_hospital_application",
          {
            p_account_id: accountId,
            p_name: guestName.trim(),
            p_email: guestEmail.trim().toLowerCase(),
            p_answers: answersPayload,
          }
        );

        if (rpcErr) {
          if (rpcErr.message?.includes("already_applied")) {
            setAlreadyApplied(true);
            setSubmitting(false);
            return;
          }
          throw new Error(rpcErr.message || "Failed to submit application.");
        }
      }

      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function buildAnswerRows(applicationId: string) {
    return questions.map((q) => {
      const val = answers[q.id];
      const isMulti = q.type === "checkbox";
      return {
        application_id: applicationId,
        question_id: q.id,
        answer_text:
          !isMulti && typeof val === "string" ? val.trim() || null : null,
        answer_options: isMulti && Array.isArray(val) ? val : null,
      };
    });
  }

  function setAnswer(qId: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    if (fieldErrors[qId]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[qId];
        return next;
      });
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (!isReady || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-center px-4">
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Hospital Not Found
        </h1>
        <p className="text-muted-foreground max-w-md">
          The hospital you're looking for doesn't exist or the link may be
          incorrect.
        </p>
      </div>
    );
  }

  const hospitalName = hospitalInfo?.name ?? "Hospital";
  const location = [hospitalInfo?.city, hospitalInfo?.state]
    .filter(Boolean)
    .join(", ");

  if (alreadyApplied && !submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center px-4 pt-28 pb-16">
          <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Already Applied
            </h2>
            <p className="text-muted-foreground">
              You've already submitted an application to{" "}
              <span className="font-semibold text-foreground">
                {hospitalName}
              </span>
              .
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <main className="flex-1 flex items-center justify-center px-4 pt-28 pb-16">
          <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Application Submitted!
            </h2>
            <p className="text-muted-foreground mb-6">
              Your application to{" "}
              <span className="font-semibold text-foreground">{hospitalName}</span>{" "}
              has been received.{" "}
              {!isAuthenticated && guestEmail
                ? `We'll send updates to ${guestEmail}.`
                : "You'll hear back from the team soon."}
            </p>

            {/* Prompt guests to create an account */}
            {!isAuthenticated && (
              <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-left">
                <div className="flex items-start gap-3">
                  <UserPlus className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      Track your application
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Create a free ClinicalHours account to track this application, log clinical hours, and discover more opportunities.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/auth")}
                      className="w-full"
                    >
                      Create Free Account
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16">
        <div className="max-w-2xl mx-auto">
          {/* Page header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
              <Building2 className="h-4 w-4" />
              <span>Volunteer Application</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-3">
              Apply to {hospitalName}
            </h1>
            {location && (
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{location}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ── Guest contact info (shown only when not logged in) ── */}
            {!isAuthenticated && (
              <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-muted/30 border-b border-border px-6 py-4">
                  <h2 className="font-semibold text-foreground">
                    Your Contact Information
                  </h2>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    We'll use this to send you updates on your application.{" "}
                    <Link
                      to="/auth"
                      className="text-primary hover:underline"
                    >
                      Sign in
                    </Link>{" "}
                    to autofill from your profile.
                  </p>
                </div>
                <div className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Full Name
                    </label>
                    <Input
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Jane Smith"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Email Address <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => {
                        setGuestEmail(e.target.value);
                        if (guestFieldErrors.email)
                          setGuestFieldErrors((p) => ({ ...p, email: undefined }));
                      }}
                      placeholder="you@example.com"
                      className={guestFieldErrors.email ? "border-destructive" : ""}
                    />
                    {guestFieldErrors.email && (
                      <p className="text-destructive text-xs mt-1">
                        {guestFieldErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Confirm email */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Confirm Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="email"
                      value={guestEmail2}
                      onChange={(e) => {
                        setGuestEmail2(e.target.value);
                        if (guestFieldErrors.email2)
                          setGuestFieldErrors((p) => ({ ...p, email2: undefined }));
                      }}
                      placeholder="you@example.com"
                      className={guestFieldErrors.email2 ? "border-destructive" : ""}
                    />
                    {guestFieldErrors.email2 && (
                      <p className="text-destructive text-xs mt-1">
                        {guestFieldErrors.email2}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Application questions ── */}
            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-muted/30 border-b border-border px-6 py-4">
                <h2 className="font-semibold text-foreground">
                  Application Form
                </h2>
                <p className="text-muted-foreground text-sm mt-0.5">
                  {questions.some((q) => q.required)
                    ? "Fields marked with * are required"
                    : "Complete the form below to apply"}
                </p>
              </div>

              <div className="p-6 space-y-6">
                {questions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    No specific questions required. Click submit to apply.
                  </p>
                ) : (
                  questions.map((q, i) => (
                    <QuestionField
                      key={q.id}
                      question={q}
                      index={i}
                      value={answers[q.id]}
                      onChange={(val) => setAnswer(q.id, val)}
                      error={fieldErrors[q.id]}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* CTA: optional account creation nudge for guests */}
            {!isAuthenticated && (
              <div className="flex items-center gap-3 bg-muted/30 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
                <UserPlus className="h-4 w-4 flex-shrink-0 text-primary" />
                <span>
                  Want to track this application?{" "}
                  <Link
                    to="/auth"
                    className="text-primary hover:underline font-medium"
                  >
                    Create a free account
                  </Link>{" "}
                  before submitting.
                </span>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 text-base font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting…
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6 pb-8">
            Your application will be reviewed by the {hospitalName} team.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}

// ─── Question Field Renderer ──────────────────────────────────────────────────

function QuestionField({
  question,
  index,
  value,
  onChange,
  error,
}: {
  question: Question;
  index: number;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  error?: string;
}) {
  const label = (
    <label className="block text-sm font-medium text-foreground mb-1.5">
      <span className="text-xs text-muted-foreground mr-1.5">Q{index + 1}.</span>
      {question.question_text}
      {question.required && <span className="text-destructive ml-1">*</span>}
    </label>
  );
  const errorEl = error && (
    <p className="text-destructive text-xs mt-1">{error}</p>
  );

  if (question.type === "short_text") {
    return (
      <div>
        {label}
        <Input
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-destructive" : ""}
        />
        {errorEl}
      </div>
    );
  }

  if (question.type === "long_text") {
    return (
      <div>
        {label}
        <textarea
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          className={`w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y min-h-[100px] ${
            error ? "border-destructive" : "border-input"
          }`}
        />
        {errorEl}
      </div>
    );
  }

  if (question.type === "mcq") {
    return (
      <div>
        {label}
        <div className="space-y-2">
          {(question.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name={`q_${question.id}`}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-4 w-4 border-input bg-background"
              />
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
        {errorEl}
      </div>
    );
  }

  if (question.type === "checkbox") {
    const selected = (value as string[]) || [];
    function toggle(opt: string) {
      if (selected.includes(opt)) {
        onChange(selected.filter((v) => v !== opt));
      } else {
        onChange([...selected, opt]);
      }
    }
    return (
      <div>
        {label}
        <div className="space-y-2">
          {(question.options || []).map((opt) => (
            <label key={opt} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="h-4 w-4 rounded border-input bg-background"
              />
              <span className="text-sm text-foreground">{opt}</span>
            </label>
          ))}
        </div>
        {errorEl}
      </div>
    );
  }

  return null;
}
