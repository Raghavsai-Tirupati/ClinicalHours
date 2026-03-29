import type { ClinicSchedulingQuestion } from '@/types/positions';

interface SchedulingQuestionsFormProps {
  questions: ClinicSchedulingQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (questionId: string, value: string) => void;
}

/**
 * Renders clinic-configured scheduling questions in the student apply form.
 * Uses the same pa-* CSS classes as the rest of PositionApplyPage.
 */
export default function SchedulingQuestionsForm({
  questions,
  answers,
  onAnswerChange,
}: SchedulingQuestionsFormProps) {
  if (!questions.length) return null;

  return (
    <div className="pa-section-card">
      <div className="pa-section-head">
        <h2>Scheduling questions</h2>
        <p>Help the organization understand your scheduling preferences.</p>
      </div>
      <div className="pa-section-body">
        <div className="pa-required-note">
          <span>*</span> Required fields
        </div>
        {questions.map((q, idx) => (
          <div key={q.id}>
            {idx > 0 && <div className="pa-field-divider" />}
            <div className="pa-form-group">
              <label className="pa-form-label">
                {q.question_text}
                {q.is_required && <span className="pa-req">*</span>}
              </label>
              {renderField(q, answers[q.id] || '', (val) => onAnswerChange(q.id, val))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderField(
  q: ClinicSchedulingQuestion,
  value: string,
  onChange: (v: string) => void,
) {
  if (q.question_type === 'short_answer') {
    return (
      <input
        type="text"
        className="pa-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={q.is_required}
      />
    );
  }

  if (q.question_type === 'long_answer') {
    return (
      <textarea
        className="pa-textarea"
        style={{ minHeight: 90 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={q.is_required}
        placeholder="Your answer…"
      />
    );
  }

  if (q.question_type === 'yes_no') {
    return (
      <div className="pa-options-list" role="radiogroup">
        {(['Yes', 'No'] as const).map((opt) => (
          <label
            key={opt}
            className={`pa-option-item ${value === opt ? 'pa-selected' : ''}`}
          >
            <input
              type="radio"
              name={`sq-${q.id}`}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            <span className="pa-option-dot">
              <span className="pa-option-dot-inner" />
            </span>
            <span className="pa-option-label">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (q.question_type === 'multiple_choice' && q.options) {
    const opts = q.options as string[];
    return (
      <div className="pa-options-list" role="radiogroup">
        {opts.map((opt, i) => (
          <label
            key={i}
            className={`pa-option-item ${value === opt ? 'pa-selected' : ''}`}
          >
            <input
              type="radio"
              name={`sq-${q.id}`}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
            />
            <span className="pa-option-dot">
              <span className="pa-option-dot-inner" />
            </span>
            <span className="pa-option-label">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  return null;
}
