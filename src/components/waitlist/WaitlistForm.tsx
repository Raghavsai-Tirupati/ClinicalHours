import { useState, useCallback } from 'react';
import { Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { WaitlistFormData } from './types';
import {
  ROLE_INTEREST_OPTIONS,
  WEEKDAYS,
  TIME_PREF_OPTIONS,
  COMMITMENT_OPTIONS,
} from './types';

interface WaitlistFormProps {
  clinicId: string;
  clinicName: string;
}

export default function WaitlistForm({ clinicId, clinicName }: WaitlistFormProps) {
  const [form, setForm] = useState<WaitlistFormData>({
    full_name: '',
    email: '',
    phone: '',
    university: '',
    major: '',
    gpa: '',
    graduation_year: '',
    role_interest: '',
    message: '',
    days: new Set<string>(),
    time_pref: '',
    hours_per_week: 4,
    commitment: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = useCallback(<K extends keyof WaitlistFormData>(key: K, value: WaitlistFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleDay = useCallback((day: string) => {
    setForm((prev) => {
      const next = new Set(prev.days);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return { ...prev, days: next };
    });
  }, []);

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { toast.error('Please enter your full name.'); return; }
    if (!form.email.trim()) { toast.error('Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Please enter a valid email address.'); return; }

    setSubmitting(true);
    try {
      const gpa = form.gpa ? parseFloat(form.gpa) : null;
      const grad = form.graduation_year ? parseInt(form.graduation_year, 10) : null;

      const { error } = await supabase.from('waitlist_submissions').insert({
        clinic_id: clinicId,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        university: form.university.trim() || null,
        major: form.major.trim() || null,
        gpa: gpa && !isNaN(gpa) ? gpa : null,
        graduation_year: grad && !isNaN(grad) ? grad : null,
        role_interest: form.role_interest || null,
        availability_json: form.days.size > 0 ? {
          days: Array.from(form.days),
          time_pref: form.time_pref || undefined,
          hours_per_week: form.hours_per_week,
          commitment: form.commitment || undefined,
        } : null,
        message: form.message.trim() || null,
      });

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error('Waitlist submit error:', err);
      toast.error('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="pa-success-wrap">
        <div className="pa-success-icon">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" stroke="var(--pa-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 className="pa-success-title">You're on the waitlist!</h1>
        <p className="pa-success-body">
          Thank you for your interest in {clinicName}. We'll reach out when applications open.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Disclaimer banner */}
      <div className="wl-disclaimer">
        <Info size={20} />
        <div className="wl-disclaimer-text">
          <h3>This is an interest form, not a final application.</h3>
          <p>Submitting this form adds you to the waitlist. You will be notified when the clinic opens applications.</p>
        </div>
      </div>

      {/* Personal info */}
      <div className="pa-section-card">
        <div className="pa-section-head">
          <h2>Your Information</h2>
          <p>Tell us about yourself</p>
        </div>
        <div className="pa-section-body">
          <div className="pa-info-grid">
            <div className="pa-form-group">
              <label className="pa-form-label">Full Name <span className="pa-req">*</span></label>
              <input className="pa-input" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} placeholder="Jane Smith" />
            </div>
            <div className="pa-form-group">
              <label className="pa-form-label">Email <span className="pa-req">*</span></label>
              <input className="pa-input" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="jane@university.edu" />
            </div>
            <div className="pa-form-group">
              <label className="pa-form-label">Phone</label>
              <input className="pa-input" type="tel" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="(555) 123-4567" />
            </div>
            <div className="pa-form-group">
              <label className="pa-form-label">University</label>
              <input className="pa-input" value={form.university} onChange={(e) => updateField('university', e.target.value)} placeholder="Texas A&M University" />
            </div>
            <div className="pa-form-group">
              <label className="pa-form-label">Major</label>
              <input className="pa-input" value={form.major} onChange={(e) => updateField('major', e.target.value)} placeholder="Biology" />
            </div>
            <div className="pa-form-group">
              <label className="pa-form-label">GPA</label>
              <input className="pa-input" type="number" step="0.01" min="0" max="4" value={form.gpa} onChange={(e) => updateField('gpa', e.target.value)} placeholder="3.5" />
            </div>
            <div className="pa-form-group">
              <label className="pa-form-label">Graduation Year</label>
              <input className="pa-input" type="number" min="2024" max="2035" value={form.graduation_year} onChange={(e) => updateField('graduation_year', e.target.value)} placeholder="2027" />
            </div>
            <div className="pa-form-group">
              <label className="pa-form-label">Role Interest</label>
              <select className="pa-select" value={form.role_interest} onChange={(e) => updateField('role_interest', e.target.value as WaitlistFormData['role_interest'])}>
                <option value="">Select…</option>
                {ROLE_INTEREST_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Availability */}
      <div className="pa-section-card">
        <div className="pa-section-head">
          <h2>Availability</h2>
          <p>When are you generally available? (Optional)</p>
        </div>
        <div className="pa-section-body">
          <div className="pa-form-group">
            <label className="pa-form-label">Days available</label>
            <div className="pa-avail-grid">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`pa-avail-day${form.days.has(d.id) ? ' pa-selected' : ''}`}
                  onClick={() => toggleDay(d.id)}
                >
                  <span className="pa-ad-name">{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pa-form-group" style={{ marginTop: 16 }}>
            <label className="pa-form-label">Time preference</label>
            <div className="pa-options-list">
              {TIME_PREF_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={`pa-option-item${form.time_pref === o.value ? ' pa-selected' : ''}`}
                >
                  <input type="radio" name="time_pref" value={o.value} checked={form.time_pref === o.value} onChange={() => updateField('time_pref', o.value)} />
                  <span className="pa-option-dot"><span className="pa-option-dot-inner" /></span>
                  <span className="pa-option-label">{o.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pa-form-group" style={{ marginTop: 16 }}>
            <label className="pa-form-label">Hours per week: {form.hours_per_week}</label>
            <div className="pa-slider-wrap">
              <span style={{ fontSize: 12, color: 'var(--pa-text-3)' }}>1</span>
              <input
                type="range"
                className="pa-slider"
                min={1}
                max={20}
                value={form.hours_per_week}
                onChange={(e) => updateField('hours_per_week', Number(e.target.value))}
              />
              <span style={{ fontSize: 12, color: 'var(--pa-text-3)' }}>20</span>
            </div>
          </div>

          <div className="pa-form-group" style={{ marginTop: 16 }}>
            <label className="pa-form-label">Commitment level</label>
            <select className="pa-select" value={form.commitment} onChange={(e) => updateField('commitment', e.target.value)}>
              {COMMITMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Message */}
      <div className="pa-section-card">
        <div className="pa-section-head">
          <h2>Additional Information</h2>
          <p>Anything else you'd like us to know?</p>
        </div>
        <div className="pa-section-body">
          <div className="pa-form-group">
            <textarea
              className="pa-textarea"
              rows={4}
              value={form.message}
              onChange={(e) => updateField('message', e.target.value)}
              placeholder="Tell us about your interest, relevant experience, or questions…"
              maxLength={2000}
            />
            <div className="pa-form-hint">{form.message.length} / 2000</div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button className="pa-btn pa-btn-primary" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : 'Join Waitlist'}
        </button>
      </div>
    </>
  );
}
