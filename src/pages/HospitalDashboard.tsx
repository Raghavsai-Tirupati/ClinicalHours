import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalMember } from "@/hooks/useHospitalMember";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Building2,
  MapPin,
  Users,
  Loader2,
  ExternalLink,
  Calendar,
  RefreshCw,
  Briefcase,
  Search,
  ChevronDown,
  ChevronUp,
  Settings,
  ListChecks,
  ArrowDownToLine,
  Layers,
  Plus,
  Pencil,
  Trash2,
  Rocket,
  CalendarCheck,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface OpportunityWithApps {
  id: string;
  name: string;
  location: string;
  type: string;
  slug: string | null;
  created_at: string;
  application_count: number;
  new_application_count: number;
}

interface Application {
  id: string;
  opportunity_id: string;
  student_name: string;
  student_email: string;
  student_phone: string | null;
  student_id: string | null;
  resume_url: string;
  essay_responses: { question1: string; question2: string } | null;
  status: "new" | "under_review" | "accepted" | "rejected";
  created_at: string;
}

interface ApplicationWithGpa extends Application {
  gpa: number | null;
  _source?: "legacy" | "hospital";
  interview_requested_at?: string | null;
  interview_confirmed_at?: string | null;
}

interface AppQuestion {
  id: string;
  question_text: string;
  type: string;
  required: boolean;
  order_index: number;
}

type StatusFilter = "all" | Application["status"];
type SortKey = "student_name" | "created_at" | "status" | "gpa";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<Application["status"], string> = {
  new: "New",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Rejected",
};

const STATUS_COLORS: Record<Application["status"], string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  under_review: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  accepted: "bg-green-500/15 text-green-400 border-green-500/30",
  rejected: "bg-red-500/15 text-red-400 border-red-500/30",
};

const SORT_LABELS: Record<SortKey, string> = {
  student_name: "Name",
  created_at: "Date Applied",
  status: "Status",
  gpa: "GPA",
};

type Tab = "overview" | "requirements" | "applications";

export default function HospitalDashboard() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { member, loading: memberLoading } = useHospitalMember();

  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [opportunities, setOpportunities] = useState<OpportunityWithApps[]>([]);
  const [applications, setApplications] = useState<ApplicationWithGpa[]>([]);
  const [questions, setQuestions] = useState<AppQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedHaApp, setSelectedHaApp] = useState<ApplicationWithGpa | null>(null);
  const [haAnswers, setHaAnswers] = useState<{ question_text: string; answer_text: string | null }[]>([]);
  const [haAnswersLoading, setHaAnswersLoading] = useState(false);
  const [haStatusUpdating, setHaStatusUpdating] = useState(false);
  const [deployLoading, setDeployLoading] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AppQuestion | null>(null);
  const [editingQuestionText, setEditingQuestionText] = useState("");
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newQuestionType, setNewQuestionType] = useState<string>("short_text");
  const [newQuestionRequired, setNewQuestionRequired] = useState(true);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [haInterviewLoading, setHaInterviewLoading] = useState(false);
  const [haConfirmSlot, setHaConfirmSlot] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!memberLoading && !member) {
      navigate("/dashboard");
      return;
    }
  }, [authLoading, user, memberLoading, member, navigate]);

  useEffect(() => {
    if (user && member) {
      fetchData();
    }
  }, [user, member]);

  useEffect(() => {
    if (!selectedHaApp || selectedHaApp._source !== "hospital") {
      setHaAnswers([]);
      return;
    }
    setHaAnswersLoading(true);
    supabase
      .from("hospital_application_answers")
      .select(`
        answer_text,
        hospital_application_questions(question_text)
      `)
      .eq("application_id", selectedHaApp.id)
      .then(({ data, error }) => {
        setHaAnswersLoading(false);
        if (error || !data) {
          setHaAnswers([]);
          return;
        }
        const list = (data as any[]).map(
          (r) => ({
            question_text: (Array.isArray(r.hospital_application_questions) ? r.hospital_application_questions[0]?.question_text : r.hospital_application_questions?.question_text) ?? "Question",
            answer_text: r.answer_text,
          })
        );
        setHaAnswers(list);
      });
  }, [selectedHaApp?.id, selectedHaApp?._source]);

  async function fetchData(showRefresh = false) {
    if (showRefresh) setRefreshing(true);
    if (!member) return;
    try {
      const { data: opps, error: oppsError } = await supabase
        .from("opportunities")
        .select("id, name, location, type, slug, created_at")
        .eq("hospital_id", member.hospitalId)
        .order("created_at", { ascending: false });

      if (oppsError) {
        console.error("Error fetching opportunities:", oppsError);
        setOpportunities([]);
      } else if (opps && opps.length > 0) {
        const oppIds = opps.map((o) => o.id);
        const { data: apps } = await supabase
          .from("applications")
          .select("opportunity_id, status")
          .in("opportunity_id", oppIds);

        const appCounts: Record<string, { total: number; new: number }> = {};
        (apps || []).forEach((app: { opportunity_id: string; status: string }) => {
          if (!appCounts[app.opportunity_id]) appCounts[app.opportunity_id] = { total: 0, new: 0 };
          appCounts[app.opportunity_id].total++;
          if (app.status === "new") appCounts[app.opportunity_id].new++;
        });
        const { data: haCounts } = await supabase
          .from("hospital_applications")
          .select("opportunity_id, status")
          .eq("account_id", member.accountId)
          .not("opportunity_id", "is", null);
        (haCounts || []).forEach((ha: { opportunity_id: string; status: string }) => {
          if (!appCounts[ha.opportunity_id]) appCounts[ha.opportunity_id] = { total: 0, new: 0 };
          appCounts[ha.opportunity_id].total++;
          if (ha.status === "submitted") appCounts[ha.opportunity_id].new++;
        });

        setOpportunities(
          opps.map((opp) => ({
            ...opp,
            type: opp.type || "hospital",
            slug: opp.slug,
            application_count: appCounts[opp.id]?.total || 0,
            new_application_count: appCounts[opp.id]?.new || 0,
          }))
        );
      } else {
        setOpportunities([]);
      }

      const legacyApps: ApplicationWithGpa[] = [];
      const haApps: ApplicationWithGpa[] = [];

      if (opps && opps.length > 0) {
        const oppIds = opps.map((o) => o.id);
        const { data: allApps } = await supabase
          .from("applications")
          .select("*")
          .in("opportunity_id", oppIds)
          .order("created_at", { ascending: false });

        const appsList = (allApps || []) as Application[];
        const studentIds = [...new Set(appsList.map((a) => a.student_id).filter(Boolean))] as string[];

        let gpaMap: Record<string, number | null> = {};
        if (studentIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, gpa")
            .in("id", studentIds);
          if (profiles) {
            profiles.forEach((p: { id: string; gpa: number | null }) => {
              gpaMap[p.id] = p.gpa ?? null;
            });
          }
        }

        appsList.forEach((a) => {
          legacyApps.push({
            ...a,
            gpa: a.student_id ? gpaMap[a.student_id] ?? null : null,
            _source: "legacy" as const,
          });
        });
      }

      const { data: hospApps } = await supabase
        .from("hospital_applications")
        .select("id, account_id, applicant_name, applicant_email, opportunity_id, status, submitted_at, student_id, interview_requested_at, interview_confirmed_at")
        .eq("account_id", member.accountId)
        .order("submitted_at", { ascending: false });

      if (hospApps && hospApps.length > 0) {
        const haStudentIds = [...new Set((hospApps as { student_id: string | null }[]).map((a) => a.student_id).filter(Boolean))] as string[];
        let haGpaMap: Record<string, number | null> = {};
        if (haStudentIds.length > 0) {
          const { data: haProfiles } = await supabase
            .from("profiles")
            .select("id, gpa")
            .in("id", haStudentIds);
          if (haProfiles) {
            (haProfiles as { id: string; gpa: number | null }[]).forEach((p) => {
              haGpaMap[p.id] = p.gpa ?? null;
            });
          }
        }

        const statusMap: Record<string, Application["status"]> = {
          submitted: "new",
          in_review: "under_review",
          accepted: "accepted",
          rejected: "rejected",
        };

        hospApps.forEach((ha) => {
          const h = ha as {
            id: string;
            applicant_name: string | null;
            applicant_email: string | null;
            opportunity_id: string | null;
            status: string;
            submitted_at: string;
            student_id: string | null;
            interview_requested_at?: string | null;
            interview_confirmed_at?: string | null;
          };
          haApps.push({
            id: h.id,
            opportunity_id: h.opportunity_id ?? "",
            student_name: h.applicant_name ?? "—",
            student_email: h.applicant_email ?? "—",
            student_phone: null,
            student_id: h.student_id,
            resume_url: "",
            essay_responses: null,
            status: (statusMap[h.status] ?? "new") as Application["status"],
            created_at: h.submitted_at,
            gpa: h.student_id ? haGpaMap[h.student_id] ?? null : null,
            interview_requested_at: h.interview_requested_at ?? null,
            interview_confirmed_at: h.interview_confirmed_at ?? null,
            _source: "hospital" as const,
          });
        });
      }

      setApplications([...legacyApps, ...haApps]);

      const { data: qs } = await supabase
        .from("hospital_application_questions")
        .select("id, question_text, type, required, order_index")
        .eq("account_id", member.accountId)
        .order("order_index");

      setQuestions((qs as AppQuestion[]) || []);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function handleDeploy() {
    if (!member) return;
    setDeployLoading(true);
    try {
      const { data, error } = await supabase.rpc("deploy_hospital_opportunity", {
        p_hospital_id: member.hospitalId,
      });
      if (error) throw error;
      toast.success("Position posted. Your hospital is now visible to students.");
      fetchData();
    } catch (err) {
      console.error("Deploy error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to post position");
    } finally {
      setDeployLoading(false);
    }
  }

  async function handleAddQuestion() {
    if (!member || !newQuestionText.trim()) return;
    setQuestionSaving(true);
    try {
      const maxOrder = questions.length > 0 ? Math.max(...questions.map((q) => q.order_index)) : -1;
      const { error } = await supabase.from("hospital_application_questions").insert({
        account_id: member.accountId,
        question_text: newQuestionText.trim(),
        type: newQuestionType,
        required: newQuestionRequired,
        order_index: maxOrder + 1,
      });
      if (error) throw error;
      setNewQuestionText("");
      setNewQuestionType("short_text");
      setNewQuestionRequired(true);
      toast.success("Question added");
      fetchData();
    } catch (err) {
      console.error("Add question error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to add question");
    } finally {
      setQuestionSaving(false);
    }
  }

  async function handleUpdateQuestion(q: AppQuestion, text: string) {
    if (!member || !text.trim()) return;
    setQuestionSaving(true);
    try {
      const { error } = await supabase
        .from("hospital_application_questions")
        .update({ question_text: text.trim() })
        .eq("id", q.id)
        .eq("account_id", member.accountId);
      if (error) throw error;
      setEditingQuestion(null);
      toast.success("Question updated");
      fetchData();
    } catch (err) {
      console.error("Update question error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to update question");
    } finally {
      setQuestionSaving(false);
    }
  }

  async function handleDeleteQuestion(q: AppQuestion) {
    if (!member || !confirm("Delete this question?")) return;
    setQuestionSaving(true);
    try {
      const { error } = await supabase
        .from("hospital_application_questions")
        .delete()
        .eq("id", q.id)
        .eq("account_id", member.accountId);
      if (error) throw error;
      setEditingQuestion(null);
      toast.success("Question deleted");
      fetchData();
    } catch (err) {
      console.error("Delete question error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete question");
    } finally {
      setQuestionSaving(false);
    }
  }

  async function handleRequestInterviewHa(appId: string) {
    setHaInterviewLoading(true);
    try {
      const { error } = await supabase.rpc("hospital_request_interview_ha", { p_application_id: appId });
      if (error) throw error;
      toast.success("Interview requested. Contact the applicant to schedule.");
      setSelectedHaApp((prev) =>
        prev && prev.id === appId ? { ...prev, interview_requested_at: new Date().toISOString() } : prev
      );
      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId ? { ...a, interview_requested_at: new Date().toISOString() } : a
        )
      );
    } catch (err) {
      console.error("Request interview error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to request interview");
    } finally {
      setHaInterviewLoading(false);
    }
  }

  async function handleConfirmInterviewHa(appId: string, slot: string) {
    const dt = new Date(slot);
    if (isNaN(dt.getTime())) {
      toast.error("Please enter a valid date and time");
      return;
    }
    setHaInterviewLoading(true);
    try {
      const { error } = await supabase.rpc("hospital_confirm_interview_ha", {
        p_application_id: appId,
        p_slot: dt.toISOString(),
      });
      if (error) throw error;
      const iso = dt.toISOString();
      toast.success("Interview confirmed");
      setSelectedHaApp((prev) =>
        prev && prev.id === appId ? { ...prev, interview_confirmed_at: iso } : prev
      );
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, interview_confirmed_at: iso } : a))
      );
      setHaConfirmSlot("");
    } catch (err) {
      console.error("Confirm interview error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to confirm interview");
    } finally {
      setHaInterviewLoading(false);
    }
  }

  const filtered = useMemo(() => {
    let list = applications;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.student_name.toLowerCase().includes(q) ||
          a.student_email.toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      if (sortKey === "gpa") {
        const aVal = a.gpa ?? -1;
        const bVal = b.gpa ?? -1;
        return sortDir === "asc" ? (aVal - bVal) : (bVal - aVal);
      }
      let aVal = a[sortKey] as string | number;
      let bVal = b[sortKey] as string | number;
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [applications, statusFilter, search, sortKey, sortDir]);

  const newCount = applications.filter((a) => a.status === "new").length;
  const totalApplications = opportunities.reduce((sum, o) => sum + o.application_count, 0);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: Briefcase },
    { id: "requirements", label: "Application Requirements", icon: Settings },
    { id: "applications", label: "Student Applications", icon: ListChecks },
  ];

  if (authLoading || memberLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Hospital Admin | ClinicalHours</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <Navigation />

      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <Building2 className="h-4 w-4" />
                <span>Hospital Admin</span>
              </div>
              <h1 className="text-3xl font-bold text-foreground">{member?.hospitalName}</h1>
              <p className="text-muted-foreground mt-1">
                Edit requirements, track applications, and filter by GPA
              </p>
            </div>
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-muted border border-border"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 border-b border-border">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Opportunities</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{opportunities.length}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Total Applications</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{totalApplications}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="h-2 w-2 rounded-full bg-blue-400" />
                    <span className="text-xs text-muted-foreground">New Applications</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{newCount}</p>
                </div>
              </div>

              {opportunities.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium mb-1">No positions posted</p>
                  <p className="text-muted-foreground text-sm mb-4">
                    Post your hospital as an opportunity to start receiving applications.
                  </p>
                  <Button onClick={handleDeploy} disabled={deployLoading} className="gap-2">
                    {deployLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                    Post Position
                  </Button>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Opportunity</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Location</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Date Posted</th>
                          <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Applications</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {opportunities.map((opp, i) => (
                          <tr
                            key={opp.id}
                            className={`border-b border-border last:border-0 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/5"}`}
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{opp.name}</p>
                              <Badge variant="outline" className="text-xs capitalize mt-1">{opp.type}</Badge>
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[200px]">{opp.location}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                              <Calendar className="h-3 w-3 inline mr-1" />
                              {format(new Date(opp.created_at), "MMM d, yyyy")}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="font-medium">{opp.application_count}</span>
                              {opp.new_application_count > 0 && (
                                <span className="ml-1.5 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                  {opp.new_application_count} new
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {opp.slug && (
                                <Link to={`/opportunities/${opp.slug}/admin`}>
                                  <Button size="sm" variant="outline" className="text-xs h-7">
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Manage
                                  </Button>
                                </Link>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Application Requirements */}
          {activeTab === "requirements" && (
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-2">Custom Application Questions</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Add custom questions to your application form. Students will answer these when they apply.
              </p>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    placeholder="Add a question (e.g. Why do you want to volunteer here?)"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={newQuestionType} onValueChange={setNewQuestionType}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short_text">Short text</SelectItem>
                      <SelectItem value="long_text">Long text</SelectItem>
                      <SelectItem value="mcq">Multiple choice</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={newQuestionRequired}
                      onChange={(e) => setNewQuestionRequired(e.target.checked)}
                      className="rounded"
                    />
                    Required
                  </label>
                  <Button onClick={handleAddQuestion} disabled={!newQuestionText.trim() || questionSaving} size="sm" className="gap-1.5">
                    {questionSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </Button>
                </div>
                {questions.length === 0 ? (
                  <p className="text-muted-foreground text-sm py-6 border border-dashed border-border rounded-lg text-center">
                    No custom questions yet. Add questions above.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {questions.map((q, i) => (
                      <li key={q.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <span className="text-xs text-muted-foreground font-mono shrink-0 pt-0.5">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          {editingQuestion?.id === q.id ? (
                            <div className="flex gap-2">
                              <Input
                                value={editingQuestionText}
                                onChange={(e) => setEditingQuestionText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleUpdateQuestion(q, editingQuestionText);
                                  if (e.key === "Escape") { setEditingQuestion(null); setEditingQuestionText(""); }
                                }}
                                onBlur={() => {
                                  const v = editingQuestionText.trim();
                                  if (v && v !== q.question_text) handleUpdateQuestion(q, v);
                                  setEditingQuestion(null);
                                  setEditingQuestionText("");
                                }}
                                autoFocus
                                className="flex-1"
                              />
                              <Button size="sm" variant="ghost" onClick={() => { setEditingQuestion(null); setEditingQuestionText(""); }}>Cancel</Button>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-medium text-foreground">{q.question_text}</p>
                              <div className="flex flex-wrap gap-2 mt-1 items-center">
                                <Badge variant="outline" className="text-[10px]">{q.type}</Badge>
                                {q.required && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                                <div className="flex gap-1 ml-auto">
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setEditingQuestion(q); setEditingQuestionText(q.question_text); }} aria-label="Edit">
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteQuestion(q)} aria-label="Delete">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Student Applications */}
          {activeTab === "applications" && (
            <>
              <div className="bg-card border border-border rounded-xl p-4 mb-4">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between flex-wrap">
                    <div className="flex flex-col sm:flex-row gap-3 flex-1 flex-wrap">
                      <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or email..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 flex-wrap">
                        {(["all", "new", "under_review", "accepted", "rejected"] as StatusFilter[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              statusFilter === s ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {s === "all" ? "All" : STATUS_LABELS[s as Application["status"]]}
                            {s === "new" && newCount > 0 && (
                              <span className="ml-1.5 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{newCount}</span>
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">Sort by</span>
                        <Select
                          value={sortKey}
                          onValueChange={(v) => {
                            const k = v as SortKey;
                            setSortKey(k);
                            setSortDir(k === "gpa" ? "desc" : "asc");
                          }}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                              <SelectItem key={k} value={k} className="text-xs">
                                {SORT_LABELS[k]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted/50 text-xs text-muted-foreground hover:text-foreground"
                          title={sortDir === "asc" ? "Ascending (click for descending)" : "Descending (click for ascending)"}
                        >
                          {sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          {sortDir === "asc" ? "A→Z" : "Z→A"}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-l border-border pl-3">
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled title="Coming soon">
                        <Layers className="h-3 w-3 mr-1" />
                        Bulk actions
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs" disabled title="Coming soon">
                        <ArrowDownToLine className="h-3 w-3 mr-1" />
                        Export
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sorted by {SORT_LABELS[sortKey]} {sortDir === "asc" ? "↑" : "↓"} · Showing {filtered.length} of {applications.length} applications
                  </p>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-foreground font-medium mb-1">No applications found</p>
                  <p className="text-muted-foreground text-sm">
                    {applications.length === 0 ? "No applications yet." : "Try adjusting your search or filter."}
                  </p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/20">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Applicant</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">Email</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Opportunity</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">GPA</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Date Applied</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Status</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((app) => (
                          <tr key={app.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{app.student_name}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{app.student_email}</p>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{app.student_email}</td>
                            <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                              {opportunities.find((o) => o.id === app.opportunity_id)?.name ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              {app.gpa != null ? app.gpa.toFixed(2) : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{format(new Date(app.created_at), "MMM d, yyyy")}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[app.status]}`}>
                                {STATUS_LABELS[app.status]}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {app._source === "hospital" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  onClick={() => setSelectedHaApp(app)}
                                >
                                  View
                                </Button>
                              ) : (() => {
                                const slug = opportunities.find((o) => o.id === app.opportunity_id)?.slug;
                                return slug ? (
                                  <Link to={`/opportunities/${slug}/admin`}>
                                    <Button size="sm" variant="outline" className="text-xs h-7">View</Button>
                                  </Link>
                                ) : (
                                  <Button size="sm" variant="outline" className="text-xs h-7" disabled>View</Button>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Sheet open={!!selectedHaApp} onOpenChange={(open) => !open && setSelectedHaApp(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Application Details</SheetTitle>
            <SheetDescription>
              {selectedHaApp && opportunities.find((o) => o.id === selectedHaApp.opportunity_id)?.name}
            </SheetDescription>
          </SheetHeader>
          {selectedHaApp && (
            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Applicant</p>
                <p className="font-medium">{selectedHaApp.student_name}</p>
                <p className="text-sm text-muted-foreground">{selectedHaApp.student_email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Applied {format(new Date(selectedHaApp.created_at), "MMM d, yyyy")}
                </p>
              </div>
              {haAnswersLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : haAnswers.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-muted-foreground">Answers</p>
                  {haAnswers.map((a, i) => (
                    <div key={i}>
                      <p className="text-xs text-muted-foreground mb-1">{a.question_text}</p>
                      <p className="text-sm">{a.answer_text ?? "—"}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Status</p>
                <Select
                  value={selectedHaApp.status}
                  onValueChange={async (v) => {
                    const newStatus = v as Application["status"];
                    const dbStatus = { new: "submitted", under_review: "in_review", accepted: "accepted", rejected: "rejected" }[newStatus];
                    setHaStatusUpdating(true);
                    const { error } = await supabase
                      .from("hospital_applications")
                      .update({ status: dbStatus })
                      .eq("id", selectedHaApp.id);
                    setHaStatusUpdating(false);
                    if (!error) {
                      setSelectedHaApp((prev) => prev ? { ...prev, status: newStatus } : null);
                      setApplications((prev) =>
                        prev.map((a) => (a.id === selectedHaApp.id ? { ...a, status: newStatus } : a))
                      );
                    }
                  }}
                  disabled={haStatusUpdating}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as Application["status"][]).map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Interview</p>
                {selectedHaApp.interview_confirmed_at ? (
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <CalendarCheck className="h-4 w-4 text-green-500" />
                    Scheduled: {format(new Date(selectedHaApp.interview_confirmed_at), "PPP 'at' p")}
                  </div>
                ) : selectedHaApp.interview_requested_at ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">Requested {format(new Date(selectedHaApp.interview_requested_at), "PP")}. Contact applicant to agree on a time, then confirm below.</p>
                    <div className="flex gap-2">
                      <Input
                        type="datetime-local"
                        value={haConfirmSlot}
                        onChange={(e) => setHaConfirmSlot(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleConfirmInterviewHa(selectedHaApp.id, haConfirmSlot)}
                        disabled={!haConfirmSlot || haInterviewLoading}
                      >
                        {haInterviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleRequestInterviewHa(selectedHaApp.id)}
                      disabled={haInterviewLoading}
                    >
                      {haInterviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                      Request interview
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1.5">Request interview times from this applicant. Contact them to schedule.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Footer />
    </>
  );
}
