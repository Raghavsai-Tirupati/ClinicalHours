import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  CalendarPlus,
  CheckCircle2,
  AlertCircle,
  Building2,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { APPLICATION_STATUS_LABELS, POSITION_TYPE_LABELS } from "@/types/positions";
import type { PositionType, ApplicationStatus, QuestionType } from "@/types/positions";

interface ApplicationWithOpp {
  id: string;
  opportunity_id: string;
  student_name: string;
  student_email: string;
  status: string;
  created_at: string;
  // interview_requested_at / interview_confirmed_at added by migration
  // 20260311030000_interview_scheduling.sql — not yet applied to DB.
  // Re-enable these once that migration runs.
  interview_requested_at: string | null;
  interview_confirmed_at: string | null;
  opportunity_name: string;
  opportunity_slug: string | null;
}

interface InterviewSlot {
  id: string;
  slot_start: string;
  slot_end: string;
  preference_rank: number;
}

interface SubmittedAnswer {
  id: string;
  question_id: string;
  answer_text: string | null;
  answer_options: string[] | null;
  answer_file_url: string | null;
  question: {
    question_text: string;
    question_type: QuestionType;
    display_order: number;
  } | null;
}

interface PositionApplication {
  id: string;
  position_id: string;
  status: ApplicationStatus;
  submitted_at: string;
  notes: string | null;
  position_title: string;
  position_type: PositionType;
  hospital_name: string;
  answers: SubmittedAnswer[];
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  under_review: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  rejected: "bg-red-500/10 text-red-400 border-red-500/30",
  waitlisted: "bg-purple-500/10 text-purple-400 border-purple-500/30",
};

export default function MyApplications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithOpp[]>([]);
  const [positionApps, setPositionApps] = useState<PositionApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithOpp | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [slots, setSlots] = useState<InterviewSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New slot form state
  const [newSlotDate, setNewSlotDate] = useState("");
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("10:00");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchPositionApplications();
    }
  }, [user]);

  useEffect(() => {
    if (selectedApp) fetchSlots(selectedApp.id);
  }, [selectedApp?.id]);

  async function fetchApplications() {
    if (!user) return;
    const legacyStatusMap: Record<string, string> = {
      submitted: 'new',
      in_review: 'under_review',
      accepted: 'accepted',
      rejected: 'rejected',
    };
    try {
      const [{ data, error: err }, hospitalAppsResult] = await Promise.all([
        supabase
          .from("applications")
          .select(`
            id, opportunity_id, student_name, student_email, status, created_at,
            opportunities (name, slug)
          `)
          .eq("student_id", user.id)
          .order("created_at", { ascending: false }),
        user.email
          ? supabase
              .from("hospital_applications")
              .select(`id, applicant_name, applicant_email, status, submitted_at, interview_confirmed_at,
                account:hospital_accounts(hospital:hospitals(name))`)
              .or(`student_id.eq.${user.id},applicant_email.eq.${user.email}`)
              .order("submitted_at", { ascending: false })
          : Promise.resolve({ data: [] as unknown[] }),
      ]);

      if (err) throw err;

      const fromApplications = (data || []).map((a: Record<string, unknown>) => ({
        ...a,
        interview_requested_at: null,
        interview_confirmed_at: null,
        opportunity_name: (a.opportunities as Record<string, unknown>)?.["name"] ?? "Unknown",
        opportunity_slug: (a.opportunities as Record<string, unknown>)?.["slug"] ?? null,
      })) as ApplicationWithOpp[];

      const fromHospitalApps = ((hospitalAppsResult.data as any[]) ?? []).map((row) => {
        const account = Array.isArray(row.account) ? row.account[0] : row.account;
        const hospital = Array.isArray(account?.hospital) ? account.hospital[0] : account?.hospital;
        return {
          id: row.id,
          opportunity_id: '',
          student_name: row.applicant_name ?? '',
          student_email: row.applicant_email ?? '',
          status: legacyStatusMap[row.status] ?? row.status,
          created_at: row.submitted_at,
          interview_requested_at: null,
          interview_confirmed_at: row.interview_confirmed_at ?? null,
          opportunity_name: hospital?.name ?? 'Unknown Hospital',
          opportunity_slug: null,
        } as ApplicationWithOpp;
      });

      setApplications([...fromApplications, ...fromHospitalApps]);
    } catch (e) {
      console.error(e);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPositionApplications() {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from("student_applications")
        .select(`
          id, position_id, status, submitted_at, notes,
          hospital_positions (
            title, position_type, hospital_page_id,
            hospital_pages:hospital_page_id (
              hospital_id,
              opportunities:hospital_id (name)
            )
          ),
          application_answers (
            id, question_id, answer_text, answer_options, answer_file_url,
            question:position_questions (
              question_text, question_type, display_order
            )
          )
        `)
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });

      if (err) throw err;

      const mapped: PositionApplication[] = (data || []).map((row: Record<string, unknown>) => {
        const pos = row.hospital_positions as Record<string, unknown> | null;
        const page = pos?.hospital_pages as Record<string, unknown> | null;
        const opp = page?.opportunities as Record<string, unknown> | null;
        const rawAnswers = (row.application_answers as Record<string, unknown>[] | null) ?? [];
        const answers: SubmittedAnswer[] = rawAnswers
          .map((a) => {
            const q = Array.isArray(a.question) ? a.question[0] : a.question;
            return {
              id: a.id as string,
              question_id: a.question_id as string,
              answer_text: (a.answer_text as string | null) ?? null,
              answer_options: (a.answer_options as string[] | null) ?? null,
              answer_file_url: (a.answer_file_url as string | null) ?? null,
              question: q
                ? {
                    question_text: q.question_text as string,
                    question_type: q.question_type as QuestionType,
                    display_order: (q.display_order as number) ?? 0,
                  }
                : null,
            };
          })
          .sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0));

        return {
          id: row.id as string,
          position_id: row.position_id as string,
          status: (row.status || "new") as ApplicationStatus,
          submitted_at: (row.submitted_at || row.id) as string,
          notes: row.notes as string | null,
          position_title: (pos?.title || "Unknown Position") as string,
          position_type: (pos?.position_type || "volunteer") as PositionType,
          hospital_name: (opp?.name || "Unknown Hospital") as string,
          answers,
        };
      });
      setPositionApps(mapped);
    } catch (e) {
      console.error("Error fetching position applications:", e);
      setPositionApps([]);
    }
  }

  async function fetchSlots(applicationId: string) {
    // application_interview_slots table not yet created — no-op for now
    setSlots([]);
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderAnswerValue(ans: SubmittedAnswer) {
    if (ans.answer_file_url) {
      return (
        <a
          href={ans.answer_file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
        >
          {ans.answer_text?.trim() || "View uploaded file"}
          <ExternalLink className="h-3 w-3" />
        </a>
      );
    }
    if (ans.answer_options && ans.answer_options.length > 0) {
      return (
        <div className="space-y-1 mt-1">
          {ans.answer_options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>{opt}</span>
            </div>
          ))}
        </div>
      );
    }
    if (ans.question?.question_type === "yes_no") {
      const val = ans.answer_text?.toLowerCase();
      return (
        <div className="flex items-center gap-2 mt-1">
          {val === "yes" ? (
            <CheckSquare className="h-4 w-4 text-green-400" />
          ) : (
            <Square className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm capitalize">{ans.answer_text || "—"}</span>
        </div>
      );
    }
    return (
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed mt-1">
        {ans.answer_text?.trim() || <span className="text-muted-foreground italic">No answer provided</span>}
      </p>
    );
  }

  function openSchedule(app: ApplicationWithOpp) {
    setSelectedApp(app);
    setSlots([]);
    setSuccess(false);
    setError(null);
    const tomorrow = addDays(new Date(), 1);
    setNewSlotDate(format(tomorrow, "yyyy-MM-dd"));
    setNewSlotStart("09:00");
    setNewSlotEnd("10:00");
  }

  function addSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedApp || !newSlotDate || !newSlotStart || !newSlotEnd) return;
    const start = new Date(`${newSlotDate}T${newSlotStart}`);
    const end = new Date(`${newSlotDate}T${newSlotEnd}`);
    if (end <= start) {
      setError("End time must be after start time");
      return;
    }
    setSubmitting(true);
    setError("Interview scheduling is not yet available.");
    setSubmitting(false);
  }

  function removeSlot(_slotId: string) {
    // no-op — table not yet created
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>My Applications | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navigation />

      <main className="min-h-screen bg-background pt-24 pb-24 md:pb-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground mb-2">My Applications</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Track your applications and submit interview times when requested.
          </p>

          {/* Position-based applications (new system) */}
          {positionApps.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-3">Position Applications</h2>
              <div className="space-y-3">
                {positionApps.map((app) => {
                  const isExpanded = expandedIds.has(app.id);
                  return (
                    <div
                      key={app.id}
                      className="bg-card border border-border rounded-xl overflow-hidden"
                    >
                      {/* Card header */}
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="break-words text-sm text-muted-foreground">
                                {app.hospital_name}
                              </span>
                            </div>
                            <p className="font-semibold text-foreground">{app.position_title}</p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {POSITION_TYPE_LABELS[app.position_type]}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${STATUS_COLORS[app.status] || ""}`}
                              >
                                {APPLICATION_STATUS_LABELS[app.status] || app.status}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Applied {format(new Date(app.submitted_at), "MMM d, yyyy")}
                              </span>
                            </div>
                            {app.notes && (
                              <p className="text-sm text-muted-foreground mt-2 italic border-l-2 border-border pl-3">
                                {app.notes}
                              </p>
                            )}
                          </div>
                          {/* Expand toggle */}
                          {app.answers.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
                              onClick={() => toggleExpand(app.id)}
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4" />
                                  <span className="text-xs">Hide</span>
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  <span className="text-xs">View responses ({app.answers.length})</span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Q&A section */}
                      {isExpanded && app.answers.length > 0 && (
                        <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-5">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Your submitted responses
                          </p>
                          {app.answers.map((ans, idx) => (
                            <div key={ans.id} className="space-y-0.5">
                              <div className="flex items-start gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground/60 mt-0.5 shrink-0 w-5">
                                  {idx + 1}.
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground leading-snug">
                                    {ans.question?.question_text || "Question"}
                                  </p>
                                  <div className="mt-1.5 pl-0">
                                    {renderAnswerValue(ans)}
                                  </div>
                                </div>
                              </div>
                              {idx < app.answers.length - 1 && (
                                <div className="border-b border-border/40 mt-4 ml-7" />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* No responses state (has no questions) */}
                      {isExpanded && app.answers.length === 0 && (
                        <div className="border-t border-border bg-muted/20 px-4 py-3">
                          <p className="text-sm text-muted-foreground italic">
                            This position had no application questions.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Legacy opportunity-based applications */}
          {applications.length === 0 && positionApps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-foreground font-medium mb-1">No applications yet</p>
              <p className="text-muted-foreground text-sm mb-4">
                Apply to opportunities to see them here.
              </p>
              <Button asChild variant="outline">
                <Link to="/opportunities">Browse Opportunities</Link>
              </Button>
            </div>
          ) : applications.length > 0 ? (
            <div className="space-y-4">
              {applications.length > 0 && positionApps.length > 0 && (
                <h2 className="text-lg font-semibold text-foreground mb-1">Other Applications</h2>
              )}
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div>
                    <p className="font-medium text-foreground">{app.opportunity_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Applied {format(new Date(app.created_at), "MMM d, yyyy")} ·{" "}
                      <span className="capitalize">{STATUS_LABELS[app.status] ?? app.status}</span>
                    </p>
                    {app.interview_requested_at && !app.interview_confirmed_at && (
                      <p className="text-sm text-amber-500 mt-1 flex items-center gap-1">
                        <CalendarPlus className="h-4 w-4" />
                        Interview requested — submit your available times
                      </p>
                    )}
                    {app.interview_confirmed_at && (
                      <p className="text-sm text-green-500 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Interview scheduled: {format(new Date(app.interview_confirmed_at), "PPp")}
                      </p>
                    )}
                  </div>
                  {app.interview_requested_at && !app.interview_confirmed_at && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-amber-400 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Interview time submission coming soon — the clinic will email you directly.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* Interview scheduling modal placeholder — not yet implemented */}
        </div>
      </main>
      <Footer />
    </>
  );
}
