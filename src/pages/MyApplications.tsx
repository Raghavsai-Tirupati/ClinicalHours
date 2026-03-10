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
import {
  Calendar,
  Clock,
  Loader2,
  FileText,
  CalendarPlus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { format, addDays, setHours, setMinutes } from "date-fns";

interface ApplicationWithOpp {
  id: string;
  opportunity_id: string;
  student_name: string;
  student_email: string;
  status: string;
  created_at: string;
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

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Rejected",
};

export default function MyApplications() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<ApplicationWithOpp[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<ApplicationWithOpp | null>(null);
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
    if (user) fetchApplications();
  }, [user]);

  useEffect(() => {
    if (selectedApp) fetchSlots(selectedApp.id);
  }, [selectedApp?.id]);

  async function fetchApplications() {
    if (!user) return;
    try {
      const { data, error: err } = await supabase
        .from("applications")
        .select(`
          id, opportunity_id, student_name, student_email, status, created_at,
          interview_requested_at, interview_confirmed_at,
          opportunities (name, slug)
        `)
        .eq("student_id", user.id)
        .order("created_at", { ascending: false });

      if (err) throw err;
      const opps = (data || []).map((a: Record<string, unknown>) => ({
        ...a,
        opportunity_name: (a.opportunities as Record<string, unknown>)?.["name"] ?? "Unknown",
        opportunity_slug: (a.opportunities as Record<string, unknown>)?.["slug"] ?? null,
      })) as ApplicationWithOpp[];
      setApplications(opps);
    } catch (e) {
      console.error(e);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchSlots(applicationId: string) {
    const { data } = await supabase
      .from("application_interview_slots")
      .select("*")
      .eq("application_id", applicationId)
      .order("preference_rank");
    setSlots((data as InterviewSlot[]) || []);
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
    setError(null);
    supabase
      .from("application_interview_slots")
      .insert({
        application_id: selectedApp.id,
        slot_start: start.toISOString(),
        slot_end: end.toISOString(),
        preference_rank: slots.length + 1,
      })
      .then(({ error: err }) => {
        if (err) {
          setError(err.message);
        } else {
          fetchSlots(selectedApp.id);
          setSuccess(true);
          setNewSlotDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
          setNewSlotStart("09:00");
          setNewSlotEnd("10:00");
        }
      })
      .finally(() => setSubmitting(false));
  }

  function removeSlot(slotId: string) {
    supabase
      .from("application_interview_slots")
      .delete()
      .eq("id", slotId)
      .then(() => selectedApp && fetchSlots(selectedApp.id));
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

      <main className="min-h-screen bg-background pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-3xl">
          <h1 className="text-2xl font-bold text-foreground mb-2">My Applications</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Track your applications and submit interview times when requested.
          </p>

          {applications.length === 0 ? (
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
          ) : (
            <div className="space-y-4">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openSchedule(app)}
                    >
                      <Calendar className="h-4 w-4 mr-1" />
                      Submit times
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Schedule modal / panel */}
          {selectedApp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
              <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold text-foreground mb-1">
                  Submit available times
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedApp.opportunity_name}
                </p>

                <form onSubmit={addSlot} className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={newSlotDate}
                        onChange={(e) => setNewSlotDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Start</Label>
                      <Input
                        type="time"
                        value={newSlotStart}
                        onChange={(e) => setNewSlotStart(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End</Label>
                      <Input
                        type="time"
                        value={newSlotEnd}
                        onChange={(e) => setNewSlotEnd(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {error && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {error}
                    </p>
                  )}
                  {success && (
                    <p className="text-sm text-green-500">Time slot added.</p>
                  )}
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                    Add time slot
                  </Button>
                </form>

                {slots.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      Your preferred times ({slots.length})
                    </p>
                    <ul className="space-y-2">
                      {slots.map((s, i) => (
                        <li
                          key={s.id}
                          className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg text-sm"
                        >
                          <span>
                            {format(new Date(s.slot_start), "EEE, MMM d, h:mm a")} —{" "}
                            {format(new Date(s.slot_end), "h:mm a")}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground hover:text-destructive h-8"
                            onClick={() => removeSlot(s.id)}
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <Button variant="outline" onClick={() => setSelectedApp(null)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
