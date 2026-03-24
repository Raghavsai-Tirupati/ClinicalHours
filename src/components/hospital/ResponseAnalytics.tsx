import { useMemo, useState } from 'react';
import {
  BarChart2,
  MessageSquare,
  CheckSquare,
  Square,
  FileText,
  ExternalLink,
  Users,
  ChevronRight,
} from 'lucide-react';
import type { StudentApplication } from '@/types/positions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getApplicantSortName } from '@/lib/applicationFilters';

interface Props {
  applications: StudentApplication[];
  /** Switch to Applicants tab and expand this application */
  onViewApplicant?: (applicationId: string) => void;
}

interface QuestionSummary {
  question_id: string;
  question_text: string;
  question_type: string;
  display_order: number;
  total_responses: number;
  counts: Record<string, number>;
  /** applicants per discrete answer (mcq / yes_no) */
  countApplicants: Record<string, StudentApplication[]>;
  text_responses: { applicant: string; applicationId: string; text: string }[];
  /** normalized text -> applicants */
  textGroups: Map<string, { preview: string; applicants: StudentApplication[] }>;
  file_responses: { applicant: string; applicationId: string; url: string; label: string }[];
}

function applicantLabel(app: StudentApplication): string {
  return getApplicantSortName(app);
}

function buildSummaries(applications: StudentApplication[]): QuestionSummary[] {
  const questionMap = new Map<string, QuestionSummary>();

  const ensure = (ans: { question_id: string; question?: { question_text?: string; question_type?: string; display_order?: number } }) => {
    const qid = ans.question_id;
    if (!questionMap.has(qid)) {
      const q = ans.question;
      questionMap.set(qid, {
        question_id: qid,
        question_text: q?.question_text || 'Question',
        question_type: q?.question_type || 'short_answer',
        display_order: q?.display_order ?? 999,
        total_responses: 0,
        counts: {},
        countApplicants: {},
        text_responses: [],
        textGroups: new Map(),
        file_responses: [],
      });
    }
    return questionMap.get(qid)!;
  };

  const addCountApplicant = (s: QuestionSummary, label: string, app: StudentApplication) => {
    s.counts[label] = (s.counts[label] || 0) + 1;
    if (!s.countApplicants[label]) s.countApplicants[label] = [];
    const list = s.countApplicants[label];
    if (!list.some((x) => x.id === app.id)) list.push(app);
  };

  for (const app of applications) {
    if (!app.answers?.length) continue;
    for (const ans of app.answers) {
      if (!ans.question) continue;
      const s = ensure(ans);
      const qt = s.question_type;

      if (qt === 'file_upload') {
        if (ans.answer_file_url) {
          s.total_responses++;
          s.file_responses.push({
            applicant: applicantLabel(app),
            applicationId: app.id,
            url: ans.answer_file_url,
            label: ans.answer_text || 'File',
          });
        }
      } else if (qt === 'yes_no' || qt === 'multiple_choice' || qt === 'mcq' || qt === 'checkbox') {
        const choices = ans.answer_options?.length
          ? ans.answer_options
          : ans.answer_text
            ? [ans.answer_text]
            : [];
        if (choices.length) {
          s.total_responses++;
          for (const c of choices) {
            addCountApplicant(s, c, app);
          }
        }
      } else {
        const text = ans.answer_text?.trim();
        if (text) {
          s.total_responses++;
          s.text_responses.push({ applicant: applicantLabel(app), applicationId: app.id, text });
          const key = text.toLowerCase();
          const existing = s.textGroups.get(key);
          if (existing) {
            if (!existing.applicants.some((x) => x.id === app.id)) existing.applicants.push(app);
          } else {
            s.textGroups.set(key, {
              preview: text.length > 120 ? `${text.slice(0, 117)}…` : text,
              applicants: [app],
            });
          }
        }
      }
    }
  }

  return Array.from(questionMap.values()).sort((a, b) => a.display_order - b.display_order);
}

export default function ResponseAnalytics({ applications, onViewApplicant }: Props) {
  const summaries = useMemo(() => buildSummaries(applications), [applications]);

  const [drilldown, setDrilldown] = useState<{
    questionTitle: string;
    segmentLabel: string;
    applicants: StudentApplication[];
  } | null>(null);

  const totalRespondents = useMemo(
    () => applications.filter((a) => a.answers && a.answers.length > 0).length,
    [applications],
  );

  const openDrilldown = (questionTitle: string, segmentLabel: string, applicants: StudentApplication[]) => {
    setDrilldown({ questionTitle, segmentLabel, applicants });
  };

  if (applications.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <BarChart2 className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="font-medium text-foreground">No applications yet</p>
        <p className="mt-1 text-sm text-muted-foreground">Response analytics will appear once students apply.</p>
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center">
        <MessageSquare className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
        <p className="font-medium text-foreground">No question responses</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {applications.length} application{applications.length !== 1 ? 's' : ''} received, but no custom question
          answers were recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
        <div>
          <p className="text-2xl font-bold text-foreground">{applications.length}</p>
          <p className="text-xs text-muted-foreground">Total applicants</p>
        </div>
        <div className="hidden h-8 w-px bg-border sm:block" />
        <div>
          <p className="text-2xl font-bold text-foreground">{totalRespondents}</p>
          <p className="text-xs text-muted-foreground">With custom responses</p>
        </div>
        <div className="hidden h-8 w-px bg-border sm:block" />
        <div>
          <p className="text-2xl font-bold text-foreground">{summaries.length}</p>
          <p className="text-xs text-muted-foreground">Questions</p>
        </div>
        <p className="text-xs text-muted-foreground sm:max-w-md sm:ml-auto">
          Click a response segment to see which applicants chose it — useful for comparing cohorts side by side.
        </p>
      </div>

      {summaries.map((s, i) => (
        <div key={s.question_id} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Question {i + 1}</p>
            <p className="mt-0.5 text-base font-medium text-foreground">{s.question_text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.total_responses} response{s.total_responses !== 1 ? 's' : ''} recorded · click a row to see applicants
            </p>
          </div>

          {Object.keys(s.counts).length > 0 && (
            <div className="space-y-2">
              {Object.entries(s.counts)
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => {
                  const pct = s.total_responses > 0 ? Math.round((count / s.total_responses) * 100) : 0;
                  const apps = s.countApplicants[label] || [];
                  return (
                    <button
                      key={label}
                      type="button"
                      className="w-full text-left rounded-lg border border-transparent hover:border-border hover:bg-muted/30 transition-colors p-2 -m-2"
                      onClick={() => openDrilldown(s.question_text, label, apps)}
                    >
                      <div className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {s.question_type === 'yes_no' ? (
                            label.toLowerCase() === 'yes' ? (
                              <CheckSquare className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )
                          ) : null}
                          <span className="min-w-0 break-words text-foreground">{label}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
                          <span>
                            {count} ({pct}%)
                          </span>
                          <Users className="h-3.5 w-3.5" />
                          <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                        </div>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/40">
                        <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {s.file_responses.length > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Files</p>
              {s.file_responses.map((f, j) => (
                <div
                  key={j}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground shrink-0">{f.applicant}</span>
                    <span className="min-w-0 break-words text-foreground">{f.label}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const who = applications.find((a) => a.id === f.applicationId);
                        if (who) openDrilldown(s.question_text, f.label, [who]);
                      }}
                    >
                      Who uploaded
                    </Button>
                    <a
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {s.textGroups.size > 0 && (
            <div className="space-y-2 mt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Text answers</p>
              <p className="text-[11px] text-muted-foreground">
                Grouped by exact answer text. Click to see everyone who wrote the same response.
              </p>
              {Array.from(s.textGroups.entries())
                .sort((a, b) => b[1].applicants.length - a[1].applicants.length)
                .map(([key, { preview, applicants }]) => (
                  <button
                    key={key}
                    type="button"
                    className="w-full text-left rounded-lg border border-border/50 bg-muted/20 p-3 hover:bg-muted/35 transition-colors"
                    onClick={() => openDrilldown(s.question_text, preview.slice(0, 80) + (preview.length > 80 ? '…' : ''), applicants)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap flex-1">{preview}</p>
                      <span className="text-xs font-medium text-muted-foreground shrink-0 tabular-nums">
                        {applicants.length} applicant{applicants.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      ))}

      <Dialog open={!!drilldown} onOpenChange={(o) => !o && setDrilldown(null)}>
        <DialogContent className="max-w-md border-border bg-background">
          <DialogHeader>
            <DialogTitle className="text-base pr-8">Applicants for this response</DialogTitle>
            <DialogDescription className="text-left space-y-1">
              <span className="block text-foreground/90 font-medium">{drilldown?.questionTitle}</span>
              <span className="block text-sm text-muted-foreground">Response: {drilldown?.segmentLabel}</span>
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[min(60vh,360px)] pr-3">
            <ul className="space-y-2">
              {(drilldown?.applicants || []).map((app) => (
                <li
                  key={app.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{applicantLabel(app)}</p>
                    <p className="break-all text-xs text-muted-foreground">
                      {app.applicant_email || app.student_profile?.email || '—'}
                    </p>
                  </div>
                  {onViewApplicant && (
                    <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs h-8" onClick={() => {
                      onViewApplicant(app.id);
                      setDrilldown(null);
                    }}>
                      View in list
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
