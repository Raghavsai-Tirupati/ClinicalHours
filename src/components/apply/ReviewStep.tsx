import { POSITION_TYPE_LABELS } from '@/types/positions';
import type { ApplicationAvailability, ClinicSchedulingQuestion, HospitalPosition, PositionQuestion } from '@/types/positions';

const WEEKDAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
] as const;

const TIME_PREF_OPTIONS = [
  { value: 'morning', label: 'Mornings (8am – 12pm)' },
  { value: 'afternoon', label: 'Afternoons (12pm – 5pm)' },
  { value: 'evening', label: 'Evenings (5pm – 9pm)' },
  { value: 'flexible', label: 'Flexible' },
] as const;

const COMMITMENT_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: '1sem', label: '1 semester' },
  { value: '2sem', label: '2 semesters (full year)' },
  { value: 'ongoing', label: 'Ongoing — no set end date' },
  { value: 'summer', label: 'Summer only' },
] as const;

function formatAvailabilitySummary(a: ApplicationAvailability): string {
  const parts: string[] = [];
  if (a.days?.length) {
    const order: string[] = WEEKDAYS.map((d) => d.label);
    const labels = [...a.days]
      .map((id) => WEEKDAYS.find((d) => d.id === id)?.label)
      .filter(Boolean) as string[];
    labels.sort((x, y) => order.indexOf(x) - order.indexOf(y));
    parts.push(labels.join(', '));
  }
  if (a.time_pref) {
    const opt = TIME_PREF_OPTIONS.find((o) => o.value === a.time_pref);
    parts.push(opt?.label ?? a.time_pref);
  }
  if (typeof a.hours_per_week === 'number') parts.push(`${a.hours_per_week}h/week`);
  if (a.commitment) {
    const c = COMMITMENT_OPTIONS.find((o) => o.value === a.commitment);
    parts.push(c?.label ?? a.commitment);
  }
  return parts.join(' · ') || '—';
}

interface ReviewProfile {
  full_name: string;
  email: string;
  university: string;
}

interface ReviewStepProps {
  position: HospitalPosition;
  hospitalName: string;
  profile: ReviewProfile | null;
  phoneInput: string;
  questions: PositionQuestion[];
  answers: Record<string, string>;
  fileAnswers: Record<string, File>;
  fileNames: Record<string, string>;
  schedulingQuestions: ClinicSchedulingQuestion[];
  schedulingAnswers: Record<string, string>;
  askForAvailability: boolean;
  availabilityPayload: ApplicationAvailability;
}

export default function ReviewStep({
  position,
  hospitalName,
  profile,
  phoneInput,
  questions,
  answers,
  fileAnswers,
  fileNames,
  schedulingQuestions,
  schedulingAnswers,
  askForAvailability,
  availabilityPayload,
}: ReviewStepProps) {
  return (
    <div className="pa-section-card">
      <div className="pa-section-head">
        <h2>Review your application</h2>
        <p>Everything looks good? Submit when you are ready — you cannot edit after submission.</p>
      </div>
      <div className="pa-section-body">
        <div className="pa-form-group">
          <div className="pa-if-label" style={{ marginBottom: 12 }}>
            Applying to
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--pa-border)] bg-[var(--pa-surface-2)] p-4">
            <div className="min-w-0 flex-1">
              <div className="font-medium text-[var(--pa-text-1)]">{position.title}</div>
              <div className="mt-0.5 text-xs text-[var(--pa-text-2)]">
                {hospitalName}
                {position.location ? ` · ${position.location}` : ''}
              </div>
            </div>
            <span className="pa-tag pa-tag-accent shrink-0">
              {POSITION_TYPE_LABELS[position.position_type]}
            </span>
          </div>
        </div>

        <div className="pa-form-group">
          <div className="pa-if-label" style={{ marginBottom: 12 }}>
            Your profile
          </div>
          <div className="pa-info-grid rounded-md border border-[var(--pa-border)] bg-[var(--pa-surface-2)] p-4">
            <div>
              <div className="pa-if-label">Name</div>
              <div className="pa-if-val">{profile?.full_name || '—'}</div>
            </div>
            <div>
              <div className="pa-if-label">Email</div>
              <div className="pa-if-val">{profile?.email || '—'}</div>
            </div>
            <div>
              <div className="pa-if-label">University</div>
              <div className="pa-if-val">{profile?.university || '—'}</div>
            </div>
            <div>
              <div className="pa-if-label">Phone</div>
              <div className="pa-if-val">{phoneInput.trim() || '—'}</div>
            </div>
          </div>
        </div>

        {questions.length > 0 && (
          <div className="pa-form-group">
            <div className="pa-if-label" style={{ marginBottom: 12 }}>
              Application responses
            </div>
            <div className="space-y-3 rounded-md border border-[var(--pa-border)] bg-[var(--pa-surface-2)] p-4">
              {questions.map((q) => (
                <div key={q.id} className="text-sm">
                  <div className="text-[var(--pa-text-3)]">{q.question_text}</div>
                  <div className="mt-1 text-[var(--pa-text-1)]">
                    {q.question_type === 'file_upload'
                      ? fileNames[q.id] || fileAnswers[q.id]?.name || '—'
                      : answers[q.id]?.trim() || '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {schedulingQuestions.length > 0 &&
          schedulingQuestions.some((q) => schedulingAnswers[q.id]?.trim()) && (
            <div className="pa-form-group">
              <div className="pa-if-label" style={{ marginBottom: 12 }}>
                Scheduling responses
              </div>
              <div className="space-y-3 rounded-md border border-[var(--pa-border)] bg-[var(--pa-surface-2)] p-4">
                {schedulingQuestions.map((q) => {
                  const val = schedulingAnswers[q.id]?.trim();
                  if (!val) return null;
                  return (
                    <div key={q.id} className="text-sm">
                      <div className="text-[var(--pa-text-3)]">{q.question_text}</div>
                      <div className="mt-1 text-[var(--pa-text-1)]">{val}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {askForAvailability && (
          <div className="pa-form-group">
            <div className="pa-if-label" style={{ marginBottom: 12 }}>
              Availability
            </div>
            <div className="pa-review-block">{formatAvailabilitySummary(availabilityPayload)}</div>
          </div>
        )}

        <div className="pa-confirm-box">
          By submitting, you confirm that the information provided is accurate and that you meet the eligibility
          requirements for this position.
        </div>
      </div>
    </div>
  );
}
