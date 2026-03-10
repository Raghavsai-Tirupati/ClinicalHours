import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  AlertCircle,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Users,
  FileText,
  RefreshCw,
  Building2,
  MapPin,
  Calendar,
  CalendarCheck,
  Mail,
} from "lucide-react";
import { format } from "date-fns";

interface Opportunity {
  id: string;
  name: string;
  location: string;
}

interface Application {
  id: string;
  opportunity_id: string;
  student_name: string;
  student_email: string;
  student_phone: string | null;
  resume_url: string;
  essay_responses: { question1: string; question2: string } | null;
  status: "new" | "under_review" | "accepted" | "rejected";
  created_at: string;
  interview_requested_at?: string | null;
  interview_confirmed_at?: string | null;
}

interface InterviewSlot {
  id: string;
  slot_start: string;
  slot_end: string;
  preference_rank: number;
}

type StatusFilter = "all" | Application["status"];

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

const STATUS_DOT: Record<Application["status"], string> = {
  new: "bg-blue-400",
  under_review: "bg-yellow-400",
  accepted: "bg-green-400",
  rejected: "bg-red-400",
};

type SortKey = "student_name" | "created_at" | "status";
type SortDir = "asc" | "desc";

export default function HospitalAdmin() {
  const { slug } = useParams<{ slug: string }>();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<Application["status"]>("new");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [interviewSlots, setInterviewSlots] = useState<InterviewSlot[]>([]);
  const [interviewLoading, setInterviewLoading] = useState(false);

  async function fetchData(showRefreshSpinner = false) {
    if (showRefreshSpinner) setRefreshing(true);

    const { data: opp, error: oppError } = await supabase
      .from("opportunities")
      .select("id, name, location")
      .eq("slug", slug!)
      .maybeSingle();

    if (oppError || !opp) {
      setNotFound(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setOpportunity(opp as Opportunity);

    const { data: apps } = await supabase
      .from("applications")
      .select("*")
      .eq("opportunity_id", opp.id)
      .order("created_at", { ascending: false });

    setApplications((apps as Application[]) || []);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    if (!slug) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    fetchData();
  }, [slug]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
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
      let aVal = a[sortKey] as string;
      let bVal = b[sortKey] as string;
      aVal = aVal?.toLowerCase?.() ?? aVal;
      bVal = bVal?.toLowerCase?.() ?? bVal;
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [applications, statusFilter, search, sortKey, sortDir]);

  const newCount = applications.filter((a) => a.status === "new").length;

  function openDetail(app: Application) {
    setSelectedApp(app);
    setNewStatus(app.status);
    setSaveSuccess(false);
    if (app.interview_requested_at) {
      fetchInterviewSlots(app.id);
    } else {
      setInterviewSlots([]);
    }
  }

  async function fetchInterviewSlots(applicationId: string) {
    const { data } = await supabase
      .from("application_interview_slots")
      .select("*")
      .eq("application_id", applicationId)
      .order("preference_rank");
    setInterviewSlots((data as InterviewSlot[]) || []);
  }

  async function requestInterview() {
    if (!selectedApp) return;
    setInterviewLoading(true);
    const { error } = await supabase.rpc("hospital_request_interview", {
      p_application_id: selectedApp.id,
    });
    if (!error) {
      setSelectedApp((prev) =>
        prev ? { ...prev, interview_requested_at: new Date().toISOString() } : null
      );
      fetchData();
    }
    setInterviewLoading(false);
  }

  async function confirmInterview(slotStart: string) {
    if (!selectedApp) return;
    setInterviewLoading(true);
    const { error } = await supabase.rpc("hospital_confirm_interview", {
      p_application_id: selectedApp.id,
      p_confirmed_at: slotStart,
    });
    if (!error) {
      setSelectedApp((prev) =>
        prev ? { ...prev, interview_confirmed_at: slotStart } : null
      );
      fetchData();
    }
    setInterviewLoading(false);
  }

  async function saveStatus() {
    if (!selectedApp) return;
    setUpdatingStatus(true);
    setSaveSuccess(false);
    const { error } = await supabase
      .from("applications")
      .update({ status: newStatus })
      .eq("id", selectedApp.id);

    if (!error) {
      setApplications((prev) =>
        prev.map((a) => (a.id === selectedApp.id ? { ...a, status: newStatus } : a))
      );
      setSelectedApp((prev) => (prev ? { ...prev, status: newStatus } : prev));
      setSaveSuccess(true);
    }
    setUpdatingStatus(false);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-30 ml-1 inline" />;
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 ml-1 inline text-primary" />
    ) : (
      <ChevronDown className="h-3 w-3 ml-1 inline text-primary" />
    );
  }

  if (loading) {
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Opportunity Not Found</h1>
        <p className="text-muted-foreground max-w-md">
          The admin portal you're looking for doesn't exist or the link may be incorrect.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Detail Modal */}
      {selectedApp && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end bg-black/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setSelectedApp(null)}
        >
          <div className="h-full w-full max-w-xl bg-card border-l border-border overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-foreground">Application Details</h2>
              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-md p-1.5 hover:bg-muted transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              {/* Student Info */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Applicant
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                  <div>
                    <span className="text-xs text-muted-foreground">Full Name</span>
                    <p className="text-sm font-medium text-foreground">{selectedApp.student_name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Email</span>
                    <p className="text-sm text-foreground">
                      <a href={`mailto:${selectedApp.student_email}`} className="hover:underline text-primary">
                        {selectedApp.student_email}
                      </a>
                    </p>
                  </div>
                  {selectedApp.student_phone && (
                    <div>
                      <span className="text-xs text-muted-foreground">Phone</span>
                      <p className="text-sm text-foreground">
                        <a href={`tel:${selectedApp.student_phone}`} className="hover:underline text-primary">
                          {selectedApp.student_phone}
                        </a>
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs text-muted-foreground">Applied</span>
                    <p className="text-sm text-foreground">
                      {format(new Date(selectedApp.created_at), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              </section>

              {/* Resume */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Resume
                </h3>
                <a
                  href={selectedApp.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-muted/30 hover:bg-muted/50 transition-colors rounded-xl p-4"
                >
                  <FileText className="h-8 w-8 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">View / Download Resume</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedApp.resume_url}</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </a>
              </section>

              {/* Essays */}
              {selectedApp.essay_responses && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Essay Responses
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-muted/30 rounded-xl p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Why do you want to volunteer at this facility?
                      </p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {selectedApp.essay_responses.question1}
                      </p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-4">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Describe any relevant healthcare or volunteer experience
                      </p>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {selectedApp.essay_responses.question2}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Status Update */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Update Status
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">Current:</span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                        STATUS_COLORS[selectedApp.status]
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[selectedApp.status]}`} />
                      {STATUS_LABELS[selectedApp.status]}
                    </span>
                  </div>
                  <select
                    value={newStatus}
                    onChange={(e) => {
                      setNewStatus(e.target.value as Application["status"]);
                      setSaveSuccess(false);
                    }}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="new">New</option>
                    <option value="under_review">Under Review</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <Button onClick={saveStatus} disabled={updatingStatus || newStatus === selectedApp.status} className="w-full">
                    {updatingStatus ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Save Status"
                    )}
                  </Button>
                  {saveSuccess && (
                    <p className="text-xs text-green-400 text-center">Status updated successfully!</p>
                  )}
                </div>
              </section>

              {/* Interview Scheduling */}
              <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Interview Scheduling
                </h3>
                <div className="bg-muted/30 rounded-xl p-4 space-y-3">
                  {selectedApp.interview_confirmed_at ? (
                    <div>
                      <p className="text-sm text-green-500 flex items-center gap-2">
                        <CalendarCheck className="h-4 w-4" />
                        Interview scheduled: {format(new Date(selectedApp.interview_confirmed_at), "PPP 'at' p")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        disabled
                        title="Email integration coming soon"
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Send confirmation email
                      </Button>
                    </div>
                  ) : selectedApp.interview_requested_at ? (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Student&apos;s preferred times:
                      </p>
                      {interviewSlots.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No times submitted yet. The student can submit availability from My Applications when logged in.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {interviewSlots.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between py-2 px-3 bg-card rounded-lg border border-border text-sm"
                            >
                              <span>
                                {format(new Date(s.slot_start), "EEE, MMM d, h:mm a")} —{" "}
                                {format(new Date(s.slot_end), "h:mm a")}
                              </span>
                              <Button
                                size="sm"
                                onClick={() => confirmInterview(s.slot_start)}
                                disabled={interviewLoading}
                              >
                                {interviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Request interview times from this applicant. They can then submit their availability.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={requestInterview}
                        disabled={
                          interviewLoading ||
                          (selectedApp.status !== "under_review" && selectedApp.status !== "accepted")
                        }
                      >
                        {interviewLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Calendar className="h-4 w-4 mr-2" />
                        )}
                        Request interview times
                      </Button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
            <Building2 className="h-4 w-4" />
            <span>Admin Portal</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">{opportunity!.name}</h1>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span>{opportunity!.location}</span>
              </div>
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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {(["all", "new", "under_review", "accepted", "rejected"] as const).map((s) => {
            if (s === "all") {
              return (
                <div key="all" className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Total</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{applications.length}</p>
                </div>
              );
            }
            const count = applications.filter((a) => a.status === s).length;
            return (
              <div key={s} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
                  <span className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Filters & Search */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-1 flex-wrap">
              {(["all", "new", "under_review", "accepted", "rejected"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    statusFilter === s
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s === "all" ? "All" : STATUS_LABELS[s as Application["status"]]}
                  {s === "new" && newCount > 0 && (
                    <span className="ml-1.5 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {newCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2 text-xs text-muted-foreground">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
            <span className="font-medium text-foreground">{applications.length}</span> applications
            {newCount > 0 && (
              <span className="ml-2 text-blue-400">
                · {newCount} new
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-foreground font-medium mb-1">No applications found</p>
            <p className="text-muted-foreground text-sm">
              {applications.length === 0
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
                      <button
                        className="flex items-center hover:text-foreground transition-colors"
                        onClick={() => handleSort("student_name")}
                      >
                        Student Name
                        <SortIcon col="student_name" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                      <button
                        className="flex items-center hover:text-foreground transition-colors"
                        onClick={() => handleSort("created_at")}
                      >
                        Date Applied
                        <SortIcon col="created_at" />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <button
                        className="flex items-center hover:text-foreground transition-colors"
                        onClick={() => handleSort("status")}
                      >
                        Status
                        <SortIcon col="status" />
                      </button>
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
                        <p className="font-medium text-foreground">{app.student_name}</p>
                        <p className="text-xs text-muted-foreground sm:hidden">{app.student_email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {app.student_email}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                        {format(new Date(app.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                            STATUS_COLORS[app.status]
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[app.status]}`} />
                          {STATUS_LABELS[app.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetail(app)}
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
      </div>
    </div>
  );
}
