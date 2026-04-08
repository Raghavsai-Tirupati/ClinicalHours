import { useState, useCallback } from 'react';
import { Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface WaitlistFormProps {
  clinicId: string;
  clinicName: string;
  waitlistId?: string;
}

// Simplified form: only name, email, phone, university. Other DB columns
// (major, gpa, role_interest, availability_json, message, etc.) still exist
// in `waitlist_submissions` but are no longer written from this form.
interface SimpleFormData {
  full_name: string;
  email: string;
  phone: string;
  university: string;
}

export default function WaitlistForm({ clinicId, clinicName, waitlistId }: WaitlistFormProps) {
  const [form, setForm] = useState<SimpleFormData>({
    full_name: '',
    email: '',
    phone: '',
    university: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateField = useCallback(<K extends keyof SimpleFormData>(key: K, value: SimpleFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!form.full_name.trim()) { toast.error('Please enter your full name.'); return; }
    if (!form.email.trim()) { toast.error('Please enter your email.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { toast.error('Please enter a valid email address.'); return; }

    setSubmitting(true);
    try {
      const insertRow: Record<string, unknown> = {
        clinic_id: clinicId,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        university: form.university.trim() || null,
      };
      if (waitlistId) insertRow.waitlist_id = waitlistId;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('waitlist_submissions').insert(insertRow);

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
