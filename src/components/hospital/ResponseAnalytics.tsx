import { useMemo } from 'react';
import { BarChart2, MessageSquare, CheckSquare, Square, FileText, ExternalLink } from 'lucide-react';
import type { StudentApplication } from '@/types/positions';

interface Props {
  applications: StudentApplication[];
}

interface QuestionSummary {
  question_id: string;
  question_text: string;
  question_type: string;
  display_order: number;
  total_responses: number;
  // For MCQ / yes_no
  counts: Record<string, number>;
  // For text
  text_responses: { applicant: string; text: string }[];
  // For file
  file_responses: { applicant: string; url: string; label: string }[];
}

function getApplicantLabel(app: StudentApplication): string {
  return (
    app.applicant_name?.trim() ||
    app.student_profile?.full_name?.trim() ||
    app.applicant_email?.split('@')[0] ||
    'Anonymous'
  );
}

export default function ResponseAnalytics({ applications }: Props) {
  const summaries = useMemo<QuestionSummary[]>(() => {
    const questionMap = new Map<string, QuestionSummary>();

    for (const app of applications) {
      if (!app.answers?.length) continue;
      for (const ans of app.answers) {
        if (!ans.question) continue;
        const qid = ans.question_id;
        if (!questionMap.has(qid)) {
          questionMap.set(qid, {
            question_id: qid,
            question_text: ans.question.question_text || 'Question',
            question_type: ans.question.question_type || 'short_answer',
            display_order: ans.question.display_order ?? 999,
            total_responses: 0,
            counts: {},
            text_responses: [],
            file_responses: [],
          });
        }
        const s = questionMap.get(qid)!;
        const qt = s.question_type;
        const applicant = getApplicantLabel(app);

        if (qt === 'file_upload') {
          if (ans.answer_file_url) {
            s.total_responses++;
            s.file_responses.push({ applicant, url: ans.answer_file_url, label: ans.answer_text || 'File' });
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
              s.counts[c] = (s.counts[c] || 0) + 1;
            }
          }
        } else {
          // short_answer / long_answer / short_text / long_text
          const text = ans.answer_text?.trim();
          if (text) {
            s.total_responses++;
            s.text_responses.push({ applicant, text });
          }
        }
      }
    }

    return Array.from(questionMap.values()).sort((a, b) => a.display_order - b.display_order);
  }, [applications]);

  const totalRespondents = useMemo(
    () => applications.filter((a) => a.answers && a.answers.length > 0).length,
    [applications],
  );

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
          {applications.length} application{applications.length !== 1 ? 's' : ''} received, but no custom question answers were recorded.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-5 py-4">
        <div>
          <p className="text-2xl font-bold text-foreground">{applications.length}</p>
          <p className="text-xs text-muted-foreground">Total applicants</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-2xl font-bold text-foreground">{totalRespondents}</p>
          <p className="text-xs text-muted-foreground">With responses</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-2xl font-bold text-foreground">{summaries.length}</p>
          <p className="text-xs text-muted-foreground">Questions</p>
        </div>
      </div>

      {/* Per-question cards */}
      {summaries.map((s, i) => (
        <div key={s.question_id} className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Question {i + 1}
            </p>
            <p className="mt-0.5 text-base font-medium text-foreground">{s.question_text}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {s.total_responses} response{s.total_responses !== 1 ? 's' : ''} of {applications.length}
            </p>
          </div>

          {/* MCQ / yes_no: bar chart */}
          {Object.keys(s.counts).length > 0 && (
            <div className="space-y-2">
              {Object.entries(s.counts)
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => {
                  const pct = s.total_responses > 0 ? Math.round((count / s.total_responses) * 100) : 0;
                  return (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {s.question_type === 'yes_no' ? (
                            label.toLowerCase() === 'yes' ? (
                              <CheckSquare className="h-3.5 w-3.5 text-green-400" />
                            ) : (
                              <Square className="h-3.5 w-3.5 text-muted-foreground" />
                            )
                          ) : null}
                          <span className="text-foreground">{label}</span>
                        </div>
                        <span className="text-muted-foreground">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted/40">
                        <div
                          className="h-full rounded-full bg-primary/70 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* File uploads */}
          {s.file_responses.length > 0 && (
            <div className="space-y-2">
              {s.file_responses.map((f, j) => (
                <div key={j} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{f.applicant}</span>
                    <span className="text-foreground">{f.label}</span>
                  </div>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Text responses */}
          {s.text_responses.length > 0 && (
            <div className="space-y-3">
              {s.text_responses.map((r, j) => (
                <div key={j} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{r.applicant}</p>
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{r.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
