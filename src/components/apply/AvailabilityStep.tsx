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

interface AvailabilityStepProps {
  selectedDays: Set<string>;
  onDayToggle: (dayId: string) => void;
  timePref: string;
  onTimePrefChange: (val: string) => void;
  hoursPerWeek: number;
  onHoursChange: (val: number) => void;
  commitment: string;
  onCommitmentChange: (val: string) => void;
  positionHoursPerWeek: number | null | undefined;
}

export default function AvailabilityStep({
  selectedDays,
  onDayToggle,
  timePref,
  onTimePrefChange,
  hoursPerWeek,
  onHoursChange,
  commitment,
  onCommitmentChange,
  positionHoursPerWeek,
}: AvailabilityStepProps) {
  return (
    <div className="pa-section-card">
      <div className="pa-section-head">
        <h2>Your availability</h2>
        <p>Let the organization know when you are generally free each week.</p>
      </div>
      <div className="pa-section-body">
        <div className="pa-form-group">
          <label className="pa-form-label">Which days are you available?</label>
          <div className="pa-avail-grid">
            {WEEKDAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`pa-avail-day ${selectedDays.has(d.id) ? 'pa-selected' : ''}`}
                onClick={() => onDayToggle(d.id)}
              >
                <span className="pa-ad-name">{d.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pa-form-group">
          <label className="pa-form-label">Preferred time of day</label>
          <div className="pa-options-list" role="radiogroup">
            {TIME_PREF_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`pa-option-item ${timePref === opt.value ? 'pa-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="time_pref"
                  value={opt.value}
                  checked={timePref === opt.value}
                  onChange={() => onTimePrefChange(opt.value)}
                />
                <span className="pa-option-dot">
                  <span className="pa-option-dot-inner" />
                </span>
                <span className="pa-option-label">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pa-form-group">
          <label className="pa-form-label">
            How many hours per week can you commit?{' '}
            <span style={{ color: 'var(--pa-accent)', fontFamily: 'monospace' }}>{hoursPerWeek}h</span>
          </label>
          <div className="pa-slider-wrap">
            <span className="text-xs" style={{ color: 'var(--pa-text-3)' }}>
              1h
            </span>
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={hoursPerWeek}
              className="pa-slider"
              onChange={(e) => onHoursChange(Number(e.target.value))}
            />
            <span className="text-xs" style={{ color: 'var(--pa-text-3)' }}>
              20h
            </span>
          </div>
          {positionHoursPerWeek != null && (
            <p className="pa-form-hint">This position lists approximately {positionHoursPerWeek}h/week.</p>
          )}
        </div>

        <div className="pa-form-group">
          <label className="pa-form-label">Minimum commitment you can make</label>
          <select
            className="pa-select"
            value={commitment}
            onChange={(e) => onCommitmentChange(e.target.value)}
          >
            {COMMITMENT_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
