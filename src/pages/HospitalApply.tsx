import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
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

  const [hospitalInfo, setHospitalInfo] = useState<HospitalInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  // answers map: question_id -> text or string[]
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Auth guard
  useEffect(() => {
    if (!isReady) return;
    if (!user || isGuest) {
      navigate("/auth");
    }
  }, [isReady, user, isGuest, navigate]);

  // Fetch hospital info, questions, existing application
  useEffect(() => {
    if (!accountId || !isReady || !user) return;

    async function fetchData() {
      // Fetch account + hospital info
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

      // Fetch questions
      const { data: qs } = await supabase
        .from("hospital_application_questions")
        .select("id, question_text, type, required, options, order_index")
        .eq("account_id", accountId)
        .order("order_index", { ascending: true });
      setQuestions((qs as Question[]) || []);

      // Check if student already applied
      const { data: existing } = await supabase
        .from("hospital_applications")
        .select("id")
        .eq("account_id", accountId)
        .eq("student_id", user!.id)
        .maybeSingle();

      if (existing) setAlreadyApplied(true);
      setLoading(false);
    }

    fetchData();
  }, [accountId, isReady, user]);

  function validate(): Record<string, string> {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!user || !accountId) return;

    setSubmitting(true);
    try {
      // Create the application row
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
        throw new Error(appErr?.message || "Failed to submit application.");
      }

      // Insert answer rows for every question
      const answerRows = questions.map((q) => {
        const val = answers[q.id];
        const isMulti = q.type === "checkbox";
        return {
          application_id: app.id,
          question_id: q.id,
          answer_text:
            !isMulti && typeof val === "string" ? val.trim() || null : null,
          answer_options:
            isMulti && Array.isArray(val) ? val : null,
        };
      });

      if (answerRows.length > 0) {
        const { error: ansErr } = await supabase
          .from("hospital_application_answers")
          .insert(answerRows);
        if (ansErr) throw new Error(ansErr.message);
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
            <p className="text-muted-foreground">
              Your application to{" "}
              <span className="font-semibold text-foreground">
                {hospitalName}
              </span>{" "}
              has been received. You'll hear back from the team soon.
            </p>
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

          {/* Form card */}
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

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

              {/* Error banner */}
              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive">{error}</p>
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
          </div>

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
            <label
              key={opt}
              className="flex items-center gap-3 cursor-pointer"
            >
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
            <label
              key={opt}
              className="flex items-center gap-3 cursor-pointer"
            >
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
