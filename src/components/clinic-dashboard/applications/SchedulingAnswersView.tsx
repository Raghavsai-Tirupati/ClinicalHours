import { Clock, CheckSquare, Square } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SchedulingAnswer } from '@/types/positions';

interface SchedulingAnswersViewProps {
  answers: SchedulingAnswer[];
}

export default function SchedulingAnswersView({ answers }: SchedulingAnswersViewProps) {
  if (!answers.length) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" />
          Scheduling Responses
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {answers
            .slice()
            .sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0))
            .map((ans) => (
              <div key={ans.id} className="border-b border-border/40 pb-3 last:border-0 last:pb-0 space-y-1.5">
                <p className="text-sm font-medium">
                  {ans.question?.question_text || 'Question'}
                </p>
                {ans.answer_options && ans.answer_options.length > 0 ? (
                  <div className="space-y-1">
                    {(ans.answer_options as string[]).map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                ) : ans.question?.question_type === 'yes_no' ? (
                  <div className="flex items-center gap-2">
                    {ans.answer_text?.toLowerCase() === 'yes' ? (
                      <CheckSquare className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm capitalize">{ans.answer_text || '—'}</span>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                    {ans.answer_text?.trim() || <span className="text-muted-foreground italic">No answer</span>}
                  </p>
                )}
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
