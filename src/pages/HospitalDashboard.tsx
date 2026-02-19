import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalMember } from "@/hooks/useHospitalMember";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Users,
  FileQuestion,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Loader2,
  Search,
  ExternalLink,
  FileText,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string;
  question_text: string;
  type: "short_text" | "long_text" | "mcq" | "checkbox";
  required: boolean;
  options: string[] | null;
  order_index: number;
}

interface Applicant {
  id: string;
  student_id: string;
  status: "submitted" | "in_review" | "accepted" | "rejected";
  notes: string | null;
  submitted_at: string;
  student_profile: {
    full_name: string;
    university: string | null;
    resume_url: string | null;
  } | null;
  answers: {
    question_id: string;
    answer_text: string | null;
    answer_options: string[] | null;
    question_text?: string;
    question_type?: string;
  }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<Applicant["status"], string> = {
  submitted: "Submitted",
  in_review: "In Review",
  accepted: "Accepted",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<Applicant["status"], string> = {
  submitted: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  in_review: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  accepted: "bg-green-500/15 text-green-400 border-green-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_DOT: Record<Applicant["status"], string> = {
  submitted: "bg-blue-400",
  in_review: "bg-yellow-400",
  accepted: "bg-green-400",
  rejected: "bg-red-400",
};

const QUESTION_TYPE_LABELS: Record<Question["type"], string> = {
  short_text: "Short Text",
  long_text: "Long Text",
  mcq: "Multiple Choice",
  checkbox: "Checkbox",
};

// ─── Root Page ────────────────────────────────────────────────────────────────

export default function HospitalDashboard() {
  const { user, isReady, isGuest } = useAuth();
  const navigate = useNavigate();
  const { member, loading: memberLoading, error: memberError, refresh } = useHospitalMember();
  const [activeTab, setActiveTab] = useState<"questions" | "applicants">(
    "questions"
  );
  const [timedOut, setTimedOut] = useState(false);

  const location = useLocation();
  const justOnboarded = (location.state as any)?.justOnboarded === true;

  // Auth guards
  useEffect(() => {
    if (!isReady) return;
    if (!user || isGuest) {
      navigate("/hospital/auth");
    }
  }, [isReady, user, isGuest, navigate]);

  // Only redirect to onboarding if member check is done AND no member found
  useEffect(() => {
    if (justOnboarded) return;
    if (memberLoading || !isReady) return;
    if (!member && !memberError) {
      navigate("/hospital/onboarding", { replace: true });
    }
  }, [memberLoading, member, memberError, navigate, isReady, justOnboarded]);

  // When arriving from onboarding, poll for member data until it's available
  useEffect(() => {
    if (!justOnboarded || member) return;
    const interval = setInterval(() => refresh(), 1500);
    const timeout = setTimeout(() => setTimedOut(true), 10000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [justOnboarded, member, refresh]);

  // Show error state
  if (memberError || timedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="bg-card border border-border rounded-2xl p-10 max-w-md w-full text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Unable to load hospital data</h2>
          <p className="text-muted-foreground text-sm mb-4">
            {memberError || "Request timed out. Please try again."}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => { setTimedOut(false); refresh(); }}>
              <RefreshCw className="h-4 w-4 mr-2" /> Retry
            </Button>
            <Button variant="outline" onClick={() => navigate("/hospital/onboarding")}>
              Back to Onboarding
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isReady || memberLoading || (justOnboarded && !member)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) return null;

  const canEdit = member.role !== "viewer";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <main className="flex-1 container mx-auto px-4 pt-28 pb-16">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
            <Building2 className="h-4 w-4" />
            <span>Hospital Admin</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">
                {member.hospitalName}
              </h1>
              <p className="text-muted-foreground text-sm capitalize">
                Role:{" "}
                <span className="text-foreground font-medium">{member.role}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 mb-6 w-fit">
          {(["questions", "applicants"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "questions" ? (
                <FileQuestion className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {tab === "questions" ? "Application Questions" : "Applicants"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "questions" ? (
          <QuestionsTab accountId={member.accountId} canEdit={canEdit} />
        ) : (
          <ApplicantsTab accountId={member.accountId} />
        )}
      </main>
      <Footer />
    </div>
  );
}

// ─── Questions Tab ────────────────────────────────────────────────────────────

function QuestionsTab({
  accountId,
  canEdit,
}: {
  accountId: string;
  canEdit: boolean;
}) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchQuestions() {
    const { data } = await supabase
      .from("hospital_application_questions")
      .select("id, question_text, type, required, options, order_index")
      .eq("account_id", accountId)
      .order("order_index", { ascending: true });
    setQuestions((data as Question[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchQuestions();
  }, [accountId]);

  async function handleDelete(id: string) {
    setDeleting(id);
    await supabase
      .from("hospital_application_questions")
      .delete()
      .eq("id", id);
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setDeleting(null);
  }

  async function handleMove(id: string, dir: "up" | "down") {
    const idx = questions.findIndex((q) => q.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === questions.length - 1) return;

    const newQs = [...questions];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    [newQs[idx], newQs[swap]] = [newQs[swap], newQs[idx]];
    const updated = newQs.map((q, i) => ({ ...q, order_index: i }));
    setQuestions(updated);

    await Promise.all(
      updated.map((q) =>
        supabase
          .from("hospital_application_questions")
          .update({ order_index: q.order_index })
          .eq("id", q.id)
      )
    );
  }

  async function onSave(q: Partial<Question>) {
    if (editing) {
      const { data } = await supabase
        .from("hospital_application_questions")
        .update({
          question_text: q.question_text,
          type: q.type,
          required: q.required,
          options: q.options,
        })
        .eq("id", editing.id)
        .select("id, question_text, type, required, options, order_index")
        .single();
      if (data) {
        setQuestions((prev) =>
          prev.map((x) => (x.id === editing.id ? (data as Question) : x))
        );
      }
    } else {
      const { data } = await supabase
        .from("hospital_application_questions")
        .insert({
          account_id: accountId,
          question_text: q.question_text!,
          type: q.type!,
          required: q.required!,
          options: q.options || null,
          order_index: questions.length,
        })
        .select("id, question_text, type, required, options, order_index")
        .single();
      if (data) {
        setQuestions((prev) => [...prev, data as Question]);
      }
    }
    setShowModal(false);
    setEditing(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {showModal && (
        <QuestionModal
          initial={editing}
          onSave={onSave}
          onClose={() => {
            setShowModal(false);
            setEditing(null);
          }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </p>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setShowModal(true);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
          <FileQuestion className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">No questions yet</p>
          <p className="text-muted-foreground text-sm mb-4">
            Add questions for students to answer when applying to your hospital.
          </p>
          {canEdit && (
            <Button
              size="sm"
              onClick={() => setShowModal(true)}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" /> Add First Question
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
            >
              {/* Ordering controls */}
              {canEdit && (
                <div className="flex flex-col gap-1 pt-0.5 flex-shrink-0">
                  <button
                    onClick={() => handleMove(q.id, "up")}
                    disabled={i === 0}
                    className="p-1 rounded hover:bg-muted/40 disabled:opacity-30 transition-colors"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleMove(q.id, "down")}
                    disabled={i === questions.length - 1}
                    className="p-1 rounded hover:bg-muted/40 disabled:opacity-30 transition-colors"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Q{i + 1}
                  </span>
                  <span className="text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded-full">
                    {QUESTION_TYPE_LABELS[q.type]}
                  </span>
                  {q.required && (
                    <span className="text-xs text-destructive font-medium">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground">{q.question_text}</p>
                {q.options && q.options.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.options.map((opt, oi) => (
                      <span
                        key={oi}
                        className="text-xs bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full"
                      >
                        {opt}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Edit / Delete actions */}
              {canEdit && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      setEditing(q);
                      setShowModal(true);
                    }}
                    className="p-1.5 rounded-md hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Edit question"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deleting === q.id}
                    className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Delete question"
                  >
                    {deleting === q.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Question Modal ───────────────────────────────────────────────────────────

function QuestionModal({
  initial,
  onSave,
  onClose,
}: {
  initial: Question | null;
  onSave: (q: Partial<Question>) => Promise<void>;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial?.question_text || "");
  const [type, setType] = useState<Question["type"]>(
    initial?.type || "short_text"
  );
  const [required, setRequired] = useState(initial?.required ?? true);
  const [optionsRaw, setOptionsRaw] = useState(
    initial?.options?.join("\n") || ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = type === "mcq" || type === "checkbox";

  async function handleSave() {
    if (!text.trim()) {
      setError("Question text is required.");
      return;
    }
    if (needsOptions && !optionsRaw.trim()) {
      setError("Please add at least one option.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        question_text: text.trim(),
        type,
        required,
        options: needsOptions
          ? optionsRaw
              .split("\n")
              .map((o) => o.trim())
              .filter(Boolean)
          : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Modal header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <h2 className="font-semibold text-foreground">
            {initial ? "Edit Question" : "Add Question"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Question text */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Question Text <span className="text-destructive">*</span>
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="e.g. Why do you want to volunteer here?"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              autoFocus
            />
          </div>

          {/* Answer type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Answer Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Question["type"])}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="short_text">Short Text</option>
              <option value="long_text">Long Text (paragraph)</option>
              <option value="mcq">Multiple Choice (single answer)</option>
              <option value="checkbox">Checkbox (multi-select)</option>
            </select>
          </div>

          {/* Options for MCQ / Checkbox */}
          {needsOptions && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Options{" "}
                <span className="text-muted-foreground text-xs font-normal">
                  (one per line)
                </span>
              </label>
              <textarea
                value={optionsRaw}
                onChange={(e) => setOptionsRaw(e.target.value)}
                rows={4}
                placeholder={"Option A\nOption B\nOption C"}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono text-xs"
              />
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={required}
              onClick={() => setRequired((r) => !r)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                required ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                  required ? "translate-x-4" : "translate-x-1"
                }`}
              />
            </button>
            <label
              className="text-sm font-medium text-foreground cursor-pointer select-none"
              onClick={() => setRequired((r) => !r)}
            >
              Required
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
              <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save Question"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Applicants Tab ───────────────────────────────────────────────────────────

function ApplicantsTab({ accountId }: { accountId: string }) {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    Applicant["status"] | "all"
  >("all");
  const [selected, setSelected] = useState<Applicant | null>(null);

  async function fetchApplicants(showRefresh = false) {
    if (showRefresh) setRefreshing(true);

    const { data: apps } = await supabase
      .from("hospital_applications")
      .select("id, student_id, status, notes, submitted_at")
      .eq("account_id", accountId)
      .order("submitted_at", { ascending: false });

    if (!apps) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const studentIds = apps.map((a) => a.student_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, university, resume_url")
      .in("id", studentIds);

    const appIds = apps.map((a) => a.id);
    const { data: rawAnswers } = await supabase
      .from("hospital_application_answers")
      .select(
        "application_id, question_id, answer_text, answer_options, hospital_application_questions(question_text, type)"
      )
      .in("application_id", appIds);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
    const answerMap: Record<string, Applicant["answers"]> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (rawAnswers || []).forEach((a: any) => {
      if (!answerMap[a.application_id]) answerMap[a.application_id] = [];
      answerMap[a.application_id].push({
        question_id: a.question_id,
        answer_text: a.answer_text,
        answer_options: a.answer_options,
        question_text: a.hospital_application_questions?.question_text,
        question_type: a.hospital_application_questions?.type,
      });
    });

    const enriched: Applicant[] = apps.map((app) => ({
      id: app.id,
      student_id: app.student_id,
      status: app.status as Applicant["status"],
      notes: app.notes,
      submitted_at: app.submitted_at,
      student_profile: profileMap[app.student_id]
        ? {
            full_name: profileMap[app.student_id].full_name,
            university: profileMap[app.student_id].university,
            resume_url: profileMap[app.student_id].resume_url,
          }
        : null,
      answers: answerMap[app.id] || [],
    }));

    setApplicants(enriched);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    fetchApplicants();
  }, [accountId]);

  const filtered = useMemo(() => {
    let list = applicants;
    if (statusFilter !== "all")
      list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) =>
        a.student_profile?.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [applicants, statusFilter, search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {/* Slide-in detail panel */}
      {selected && (
        <ApplicantDetail
          applicant={selected}
          onClose={() => setSelected(null)}
          onUpdate={(id, status, notes) => {
            setApplicants((prev) =>
              prev.map((a) => (a.id === id ? { ...a, status, notes } : a))
            );
            setSelected((prev) =>
              prev ? { ...prev, status, notes } : prev
            );
          }}
        />
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(
          ["all", "submitted", "in_review", "accepted", "rejected"] as const
        ).map((s) => {
          const count =
            s === "all"
              ? applicants.length
              : applicants.filter((a) => a.status === s).length;
          const label =
            s === "all" ? "Total" : STATUS_LABELS[s as Applicant["status"]];
          return (
            <div
              key={s}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-1">
                {s !== "all" && (
                  <span
                    className={`h-2 w-2 rounded-full ${STATUS_DOT[s as Applicant["status"]]}`}
                  />
                )}
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search applicants…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 flex-wrap">
            {(
              [
                "all",
                "submitted",
                "in_review",
                "accepted",
                "rejected",
              ] as const
            ).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === s
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s === "all" ? "All" : STATUS_LABELS[s as Applicant["status"]]}
              </button>
            ))}
          </div>
          <button
            onClick={() => fetchApplicants(true)}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted border border-border"
            aria-label="Refresh"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">{filtered.length}</span>{" "}
          of{" "}
          <span className="font-medium text-foreground">
            {applicants.length}
          </span>{" "}
          applicants
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium mb-1">
            No applicants found
          </p>
          <p className="text-muted-foreground text-sm">
            {applicants.length === 0
              ? "No one has applied yet."
              : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Student
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                    University
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                    Applied
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, i) => (
                  <tr
                    key={app.id}
                    className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${
                      i % 2 === 0 ? "" : "bg-muted/5"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {app.student_profile?.full_name ?? "Unknown Student"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {app.student_profile?.university ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {format(new Date(app.submitted_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[app.status]}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[app.status]}`}
                        />
                        {STATUS_LABELS[app.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelected(app)}
                        className="text-xs h-7"
                      >
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Applicant Detail Panel ───────────────────────────────────────────────────

function ApplicantDetail({
  applicant,
  onClose,
  onUpdate,
}: {
  applicant: Applicant;
  onClose: () => void;
  onUpdate: (
    id: string,
    status: Applicant["status"],
    notes: string | null
  ) => void;
}) {
  const [newStatus, setNewStatus] = useState<Applicant["status"]>(
    applicant.status
  );
  const [notes, setNotes] = useState(applicant.notes || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("hospital_applications")
      .update({ status: newStatus, notes: notes.trim() || null })
      .eq("id", applicant.id);
    if (!error) {
      onUpdate(applicant.id, newStatus, notes.trim() || null);
      setSaved(true);
    }
    setSaving(false);
  }

  const isDirty =
    newStatus !== applicant.status ||
    notes.trim() !== (applicant.notes || "").trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="h-full w-full max-w-xl bg-card border-l border-border overflow-y-auto shadow-2xl flex flex-col">
        {/* Panel header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-semibold text-foreground">Application Details</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          {/* Student info */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Applicant
            </h3>
            <div className="bg-muted/30 rounded-xl p-4 space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Full Name</span>
                <p className="text-sm font-medium text-foreground">
                  {applicant.student_profile?.full_name ?? "Unknown"}
                </p>
              </div>
              {applicant.student_profile?.university && (
                <div>
                  <span className="text-xs text-muted-foreground">
                    University
                  </span>
                  <p className="text-sm text-foreground">
                    {applicant.student_profile.university}
                  </p>
                </div>
              )}
              <div>
                <span className="text-xs text-muted-foreground">Applied</span>
                <p className="text-sm text-foreground">
                  {format(
                    new Date(applicant.submitted_at),
                    "MMMM d, yyyy 'at' h:mm a"
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Resume */}
          {applicant.student_profile?.resume_url && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Resume
              </h3>
              <a
                href={applicant.student_profile.resume_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors rounded-xl p-4"
              >
                <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    View / Download Resume
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {applicant.student_profile.resume_url}
                  </p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </a>
            </section>
          )}

          {/* Answers */}
          {applicant.answers.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Answers
              </h3>
              <div className="space-y-3">
                {applicant.answers.map((ans) => (
                  <div
                    key={ans.question_id}
                    className="bg-muted/30 rounded-xl p-4"
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      {ans.question_text ?? "Question"}
                    </p>
                    {ans.answer_options && ans.answer_options.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {ans.answer_options.map((opt, idx) => (
                          <span
                            key={idx}
                            className="text-xs bg-muted/50 text-foreground px-2 py-0.5 rounded-full"
                          >
                            {opt}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {ans.answer_text || (
                          <span className="text-muted-foreground italic">
                            No answer provided
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Status update */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Update Status
            </h3>
            <div className="bg-muted/30 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Current:</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[applicant.status]}`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[applicant.status]}`}
                  />
                  {STATUS_LABELS[applicant.status]}
                </span>
              </div>

              <select
                value={newStatus}
                onChange={(e) => {
                  setNewStatus(e.target.value as Applicant["status"]);
                  setSaved(false);
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="submitted">Submitted</option>
                <option value="in_review">In Review</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
              </select>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Internal Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setSaved(false);
                  }}
                  rows={3}
                  placeholder="Add private notes about this applicant…"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="w-full"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving…
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              {saved && (
                <p className="text-xs text-green-400 text-center">
                  Saved successfully!
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
