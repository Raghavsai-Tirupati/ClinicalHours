interface Profile {
  full_name: string;
  email: string;
  university: string;
  major: string;
  phone: string;
  gpa: number | null;
  graduation_year: number | null;
}

interface InfoStepProps {
  profile: Profile | null;
  description: string | null | undefined;
  requirementItems: string[];
  phoneInput: string;
  onPhoneChange: (val: string) => void;
}

export default function InfoStep({
  profile,
  description,
  requirementItems,
  phoneInput,
  onPhoneChange,
}: InfoStepProps) {
  const yearLabel = profile?.graduation_year ? `Class of ${profile.graduation_year}` : '—';

  return (
    <>
      {(description || requirementItems.length > 0) && (
        <div className="pa-section-card">
          <div className="pa-section-head">
            <h2>About this opportunity</h2>
            <p>Details provided by the organization.</p>
          </div>
          <div className="pa-section-body">
            {description && (
              <div className="pa-form-group">
                <div className="pa-if-label">Description</div>
                <p className="pa-detail-text">{description}</p>
              </div>
            )}
            {requirementItems.length > 0 && (
              <div className="pa-form-group">
                <div className="pa-if-label">Requirements</div>
                <ul className="pa-detail-list">
                  {requirementItems.map((item, idx) => (
                    <li key={`${item}-${idx}`}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="pa-section-card">
        <div className="pa-section-head">
          <h2>Your information</h2>
          <p>Pre-filled from your profile — edit in settings if anything is incorrect.</p>
        </div>
        <div className="pa-section-body">
          <div className="pa-info-grid">
            <div>
              <div className="pa-if-label">Full name</div>
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
              <div className="pa-if-label">Major</div>
              <div className="pa-if-val">{profile?.major || '—'}</div>
            </div>
            <div>
              <div className="pa-if-label">GPA</div>
              <div className="pa-if-val">
                {profile?.gpa != null ? profile.gpa.toFixed(2) : '—'}
              </div>
            </div>
            <div>
              <div className="pa-if-label">Year</div>
              <div className="pa-if-val">{yearLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="pa-section-card">
        <div className="pa-section-head">
          <h2>A bit more about you</h2>
          <p>Helps the site share accurate contact details with the organization.</p>
        </div>
        <div className="pa-section-body">
          <div className="pa-required-note">
            <span>*</span> Required fields
          </div>
          <div className="pa-form-group">
            <label className="pa-form-label">
              Phone number<span className="pa-req">*</span>
            </label>
            <input
              type="tel"
              className="pa-input"
              placeholder="(555) 000-0000"
              value={phoneInput}
              onChange={(e) => onPhoneChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
