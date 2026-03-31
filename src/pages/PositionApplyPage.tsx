import { useState, useEffect, useMemo, useCallback, useRef, Fragment, type ReactNode } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Loader2,
  Building2,
  MapPin,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check,
} from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { isPositionDeadlinePassed } from '@/lib/positionAvailability';
import { useAuth } from '@/hooks/useAuth';
import { usePositionDetail } from '@/hooks/usePositionDetail';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { POSITION_TYPE_LABELS } from '@/types/positions';
import type { ApplicationAvailability, ClinicSchedulingQuestion, PositionQuestion } from '@/types/positions';
import DocumentUpload from '@/components/application/DocumentUpload';
import type { PendingDocument } from '@/components/application/DocumentUpload';
import SchedulingQuestionsForm from '@/components/application/SchedulingQuestionsForm';

import logo from '@/assets/logo.png';
import './position-apply.css';

type StepKey = 'info' | 'questions' | 'documents' | 'availability' | 'review';

const LONG_ANSWER_MAX = 2000;

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

const STEP_LABELS: Record<StepKey, string> = {
  info: 'Your info',
  questions: 'Questions',
  documents: 'Documents',
  availability: 'Availability',
  review: 'Review',
};

function buildStepsWithAvailability(hasQuestions: boolean, askForAvailability: boolean): StepKey[] {
  const steps: StepKey[] = ['info'];
  if (hasQuestions) steps.push('questions');
  steps.push('documents');
  if (askForAvailability) steps.push('availability');
  steps.push('review');
  return steps;
}

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

function parseRequirements(requirements: string | null): string[] {
  if (!requirements) return [];
  return requirements
    .split(/\r?\n|;/g)
    .map((item) => item.trim().replace(/^[\-\u2022*]\s*/, ''))
    .filter(Boolean);
}

export default function PositionApplyPage() {
  const { positionId } = useParams<{ positionId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isComplete: isProfileComplete, isLoading: profileLoading, missingFields } = useProfileComplete();
  const { position, questions, loading, error } = usePositionDetail(positionId);

  const [profile, setProfile] = useState<{
    full_name: string;
    email: string;
    university: string;
    major: string;
    phone: string;
    gpa: number | null;
    graduation_year: number | null;
  } | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fileAnswers, setFileAnswers] = useState<Record<string, File>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Document uploads
  const [pendingDocuments, setPendingDocuments] = useState<PendingDocument[]>([]);

  // Scheduling questions (clinic-configured)
  const [schedulingQuestions, setSchedulingQuestions] = useState<ClinicSchedulingQuestion[]>([]);
  const [schedulingAnswers, setSchedulingAnswers] = useState<Record<string, string>>({});

  const [phoneInput, setPhoneInput] = useState('');
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => new Set());
  const [timePref, setTimePref] = useState<string>('');
  const [hoursPerWeek, setHoursPerWeek] = useState(4);
  const [commitment, setCommitment] = useState('');

  const [stepIndex, setStepIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hospitalName, setHospitalName] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const askForAvailability = position?.ask_for_availability !== false;
  const steps = useMemo(
    () => buildStepsWithAvailability(questions.length > 0, askForAvailability),
    [questions.length, askForAvailability],
  );
  const currentStep = steps[stepIndex];
  const requirementItems = useMemo(() => parseRequirements(position?.requirements ?? null), [position?.requirements]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, university, major, phone, gpa, graduation_year')
        .eq('id', user.id)
        .single();
      if (data) {
        const p = data.phone?.trim() ?? '';
        setProfile({
          full_name: data.full_name || '',
          email: user.email || '',
          university: data.university || '',
          major: data.major || '',
          phone: p,
          gpa: typeof data.gpa === 'number' ? data.gpa : null,
          graduation_year: typeof data.graduation_year === 'number' ? data.graduation_year : null,
        });
        setPhoneInput(p);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!position) return;
    (async () => {
      const { data } = await supabase
        .from('hospital_pages')
        .select('hospital_id, opportunities:hospital_id (name)')
        .eq('id', position.hospital_page_id)
        .single();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opp = (data as any)?.opportunities;
      if (opp?.name) setHospitalName(opp.name);

      // Fetch clinic scheduling questions
      const { data: schedQs } = await supabase
        .from('clinic_scheduling_questions')
        .select('*')
        .eq('clinic_id', position.hospital_page_id)
        .order('display_order', { ascending: true });
      if (schedQs) setSchedulingQuestions(schedQs as ClinicSchedulingQuestion[]);
    })();
  }, [position]);

  useEffect(() => {
    if (position?.hours_per_week != null) {
      setHoursPerWeek(Math.min(20, Math.max(1, position.hours_per_week)));
    }
  }, [position?.hours_per_week]);

  useEffect(() => {
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = '#0f0f0f';
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, []);

  const availabilityPayload = useMemo<ApplicationAvailability>(
    () => ({
      days: Array.from(selectedDays),
      time_pref: timePref || undefined,
      hours_per_week: hoursPerWeek,
      commitment: commitment || undefined,
    }),
    [selectedDays, timePref, hoursPerWeek, commitment],
  );

  const validateQuestions = useCallback(() => {
    for (const q of questions) {
      if (q.question_type === 'file_upload') {
        if (q.is_required && !fileAnswers[q.id]) {
          toast.error(`Please upload: "${q.question_text}"`);
          return false;
        }
        continue;
      }
      if (q.is_required && !answers[q.id]?.trim()) {
        toast.error(`Please answer: "${q.question_text}"`);
        return false;
      }
    }
    return true;
  }, [questions, answers, fileAnswers]);

  const validateCurrentStep = useCallback(() => {
    if (currentStep === 'info') {
      if (!phoneInput.trim()) {
        toast.error('Please enter your phone number.');
        return false;
      }
      return true;
    }
    if (currentStep === 'questions') return validateQuestions();
    if (currentStep === 'documents') {
      // Validate required scheduling questions
      for (const q of schedulingQuestions) {
        if (q.is_required && !schedulingAnswers[q.id]?.trim()) {
          toast.error(`Please answer: "${q.question_text}"`);
          return false;
        }
      }
      return true;
    }
    if (currentStep === 'availability' && askForAvailability) {
      if (selectedDays.size === 0) {
        toast.error('Select at least one day you are available.');
        return false;
      }
      return true;
    }
    return true;
  }, [currentStep, phoneInput, validateQuestions, selectedDays, askForAvailability, schedulingQuestions, schedulingAnswers]);

  const goNext = () => {
    if (!validateCurrentStep()) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setStepIndex((i) => Math.max(0, i - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStepIndex = (i: number) => {
    if (i < stepIndex) {
      setStepIndex(i);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!user || !positionId || !position) return;
    setSubmitError(null);

    if (profileLoading) {
      setSubmitError('Checking your profile requirements. Please wait a moment and try again.');
      return;
    }
    if (!isProfileComplete) {
      setSubmitError('Please complete all required profile fields before submitting this application.');
      return;
    }
    if (!phoneInput.trim()) {
      toast.error('Please enter your phone number.');
      return;
    }
    if (!validateQuestions()) return;
    if (askForAvailability && selectedDays.size === 0) {
      toast.error('Select at least one day you are available.');
      return;
    }
    // Validate required scheduling questions
    for (const sq of schedulingQuestions) {
      if (sq.is_required && !schedulingAnswers[sq.id]?.trim()) {
        toast.error(`Please answer: "${sq.question_text}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const { error: phoneErr } = await supabase
        .from('profiles')
        .update({ phone: phoneInput.trim() })
        .eq('id', user.id);
      if (phoneErr) throw new Error(phoneErr.message);

      const uploadedFiles: Record<string, { fileName: string; publicUrl: string }> = {};

      for (const q of questions) {
        if (q.question_type !== 'file_upload') continue;
        const file = fileAnswers[q.id];
        if (!file) continue;

        const extension = file.name.split('.').pop() || 'dat';
        const storageFileName = `position-applications/${user.id}/${positionId}/${Date.now()}-${q.id}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(storageFileName, file, { upsert: false });

        if (uploadError) {
          throw new Error(uploadError.message || `Failed to upload ${file.name}`);
        }

        const { data: publicUrlData } = supabase.storage.from('resumes').getPublicUrl(storageFileName);
        uploadedFiles[q.id] = {
          fileName: file.name,
          publicUrl: publicUrlData.publicUrl,
        };
      }

      const payloadAnswers = questions
        .map((q) => {
          if (q.question_type === 'file_upload') {
            const uploaded = uploadedFiles[q.id];
            if (!uploaded) return null;
            return {
              question_id: q.id,
              answer_text: uploaded.fileName,
              answer_file_url: uploaded.publicUrl,
            };
          }

          const value = answers[q.id]?.trim();
          if (!value) return null;
          return {
            question_id: q.id,
            answer_text: value,
          };
        })
        .filter(Boolean);

      const { data, error: fnError } = await supabase.functions.invoke('submit-position-application', {
        body: {
          position_id: positionId,
          answers: payloadAnswers,
          availability: askForAvailability ? availabilityPayload : null,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to submit application');
      }
      if (data?.error) {
        throw new Error(data.error);
      }

      const applicationId = data?.id;

      // Upload documents to storage and save metadata
      if (applicationId && pendingDocuments.length > 0) {
        for (const doc of pendingDocuments) {
          const ext = doc.fileName.split('.').pop() || 'dat';
          const storagePath = `position-applications/${user.id}/${positionId}/docs/${Date.now()}-${doc.id}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from('resumes')
            .upload(storagePath, doc.file, { upsert: false });

          if (upErr) {
            console.error('Doc upload error:', upErr);
            continue; // don't fail whole submission for a doc
          }

          const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(storagePath);

          await supabase.from('application_documents').insert({
            application_id: applicationId,
            student_id: user.id,
            file_name: doc.fileName,
            file_url: urlData.publicUrl,
            file_type: doc.fileType,
            file_size_bytes: doc.fileSizeBytes,
          });
        }
      }

      // Save scheduling answers
      if (applicationId && schedulingQuestions.length > 0) {
        const schedAnswerRows = schedulingQuestions
          .filter((q) => schedulingAnswers[q.id]?.trim())
          .map((q) => ({
            application_id: applicationId,
            question_id: q.id,
            answer_text: schedulingAnswers[q.id]?.trim() || null,
          }));

        if (schedAnswerRows.length > 0) {
          await supabase.from('scheduling_answers').insert(schedAnswerRows);
        }
      }

      // Trigger resume scoring in background (fire and forget)
      if (applicationId) {
        supabase.functions.invoke('score-resume-match', {
          body: { application_id: applicationId },
        }).catch(() => {}); // non-blocking
      }

      setSubmitted(true);
    } catch (err) {
      let message = 'Failed to submit application';

      if (err instanceof FunctionsHttpError) {
        try {
          const payload = await err.context.json();
          if (payload?.error && typeof payload.error === 'string') {
            message = payload.error;
          } else if (err.message) {
            message = err.message;
          }
        } catch {
          message = err.message || message;
        }
      } else if (err && typeof err === 'object' && 'message' in err) {
        message = String((err as { message: unknown }).message);
      }

      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderQuestionField = (q: PositionQuestion) => {
    const id = q.id;

    if (q.question_type === 'short_answer') {
      return (
        <input
          type="text"
          className="pa-input"
          value={answers[id] || ''}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [id]: e.target.value }))}
          required={q.is_required}
        />
      );
    }

    if (q.question_type === 'long_answer') {
      const len = (answers[id] || '').length;
      return (
        <div className="pa-char-wrap">
          <textarea
            className="pa-textarea"
            style={{ minHeight: 110, paddingBottom: 28 }}
            value={answers[id] || ''}
            maxLength={LONG_ANSWER_MAX}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [id]: e.target.value }))}
            required={q.is_required}
            placeholder="Your answer…"
          />
          <span className="pa-char-count">
            {len} / {LONG_ANSWER_MAX}
          </span>
        </div>
      );
    }

    if (q.question_type === 'yes_no') {
      return (
        <div className="pa-options-list" role="radiogroup">
          {(['Yes', 'No'] as const).map((opt) => (
            <label
              key={opt}
              className={`pa-option-item ${answers[id] === opt ? 'pa-selected' : ''}`}
            >
              <input
                type="radio"
                name={`q-${id}`}
                value={opt}
                checked={answers[id] === opt}
                onChange={() => setAnswers((prev) => ({ ...prev, [id]: opt }))}
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
      return (
        <div className="pa-options-list" role="radiogroup">
          {(q.options as string[]).map((opt, i) => (
            <label
              key={i}
              className={`pa-option-item ${answers[id] === opt ? 'pa-selected' : ''}`}
            >
              <input
                type="radio"
                name={`q-${id}`}
                value={opt}
                checked={answers[id] === opt}
                onChange={() => setAnswers((prev) => ({ ...prev, [id]: opt }))}
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

    if (q.question_type === 'file_upload') {
      const name = fileNames[id];
      return (
        <>
          <input
            type="file"
            ref={(el) => {
              fileInputRefs.current[id] = el;
            }}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setFileAnswers((prev) => ({ ...prev, [id]: file }));
                setFileNames((prev) => ({ ...prev, [id]: file.name }));
              }
            }}
          />
          <button
            type="button"
            className="pa-file-drop w-full"
            onClick={() => fileInputRefs.current[id]?.click()}
          >
            <span className="text-sm text-[var(--pa-text-1)]">
              {name ? name : 'Click to upload or drag files here'}
            </span>
            <p>PDF, DOC, or DOCX recommended</p>
            <span>Max file size per your hospital’s policy</span>
          </button>
        </>
      );
    }

    return null;
  };

  const layout = (inner: ReactNode) => (
    <div className="pa-root min-h-screen">
      {inner}
    </div>
  );

  if (authLoading || loading) {
    return layout(
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--pa-accent)' }} />
      </div>,
    );
  }

  if (!user) {
    return layout(
      <div className="pa-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="pa-section-card w-full max-w-md">
          <div className="pa-section-head">
            <h2>Sign in required</h2>
            <p>You need to be logged in to apply to this position.</p>
          </div>
          <div className="pa-section-body">
            <Link to={`/auth?redirect=/apply/${positionId}`} className="pa-btn pa-btn-primary w-full justify-center">
              Sign in
            </Link>
          </div>
        </div>
      </div>,
    );
  }

  if (error || !position) {
    return layout(
      <div className="pa-page text-center" style={{ color: 'var(--pa-text-2)' }}>
        {error || 'Position not found'}
      </div>,
    );
  }

  if (position.status !== 'active' || isPositionDeadlinePassed(position.application_deadline)) {
    return layout(
      <div className="pa-page flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="pa-section-card w-full max-w-2xl">
          <div className="pa-section-head">
            <h2>Applications are closed</h2>
            <p>This position is no longer accepting submissions.</p>
          </div>
          <div className="pa-section-body">
            <p className="pa-sub">
              {position.application_deadline
                ? `The deadline passed on ${new Date(position.application_deadline).toLocaleDateString()}.`
                : 'Please return to the opportunities page to explore currently open positions.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/opportunities" className="pa-btn pa-btn-primary">
                Browse open positions
              </Link>
              <Link to="/dashboard" className="pa-btn">
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  if (submitted) {
    return layout(
      <>
        <nav className="pa-topnav">
          <Link to="/dashboard" className="pa-nav-logo">
            <img src={logo} alt="" /><span className="logo-light">Clinical</span><span className="logo-bold">Hours</span>
          </Link>
          <div className="pa-nav-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/opportunities">Opportunities</Link>
            <Link to="/map">Map</Link>
            <Link to="/settings">Settings</Link>
          </div>
        </nav>
        <div className="pa-success-wrap">
          <div className="pa-success-icon">
            <Check className="h-6 w-6" style={{ color: 'var(--pa-accent)' }} strokeWidth={2.2} />
          </div>
          <div className="pa-success-title">Application submitted</div>
          <p className="pa-success-body">
            {hospitalName ? `${hospitalName} will` : 'The organization will'} review your application and reach out if
            you are a good fit. Check your dashboard for updates.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/my-applications" className="pa-btn">
              My applications
            </Link>
            <Link to="/dashboard" className="pa-btn pa-btn-primary">
              Back to dashboard
            </Link>
          </div>
        </div>
      </>,
    );
  }

  const yearLabel = profile?.graduation_year
    ? `Class of ${profile.graduation_year}`
    : '—';

  return (
    <>
      <Helmet>
        <title>
          Apply: {position.title} · {hospitalName || 'ClinicalHours'}
        </title>
      </Helmet>

      <div className="pa-root min-h-screen">
        <nav className="pa-topnav">
          <Link to="/dashboard" className="pa-nav-logo">
            <img src={logo} alt="" /><span className="logo-light">Clinical</span><span className="logo-bold">Hours</span>
          </Link>
          <div className="pa-nav-links">
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/opportunities">Opportunities</Link>
            <Link to="/map">Map</Link>
            <Link to="/settings">Settings</Link>
          </div>
        </nav>

        <div className="pa-progress-track">
          <div className="pa-progress-inner">
            {steps.map((key, i) => (
              <Fragment key={key}>
                <button
                  type="button"
                  className={`pa-step ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''} ${
                    i < stepIndex ? 'clickable' : ''
                  }`}
                  onClick={() => i < stepIndex && goToStepIndex(i)}
                  disabled={i >= stepIndex}
                >
                  <span className="pa-step-dot">
                    {i < stepIndex ? (
                      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span>{STEP_LABELS[key]}</span>
                </button>
                {i < steps.length - 1 && (
                  <div className={`pa-step-line ${i < stepIndex ? 'done' : ''}`} />
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="pa-page">
          {/* Position header */}
          <div className="pa-pos-header">
            <div>
              <div className="pa-pos-clinic">
                <Building2 className="h-3.5 w-3.5" />
                {hospitalName || 'Hospital'}
              </div>
              <h1 className="pa-pos-title">{position.title}</h1>
              <div className="pa-pos-tags">
                <span className="pa-tag pa-tag-accent">{POSITION_TYPE_LABELS[position.position_type]}</span>
                {position.hours_per_week != null && (
                  <span className="pa-tag flex items-center gap-1">
                    <Clock className="h-3 w-3 opacity-70" />
                    {position.hours_per_week}h / week
                  </span>
                )}
                {position.location && (
                  <span className="pa-tag flex items-center gap-1">
                    <MapPin className="h-3 w-3 opacity-70" />
                    {position.location}
                  </span>
                )}
                {position.duration && <span className="pa-tag">{position.duration}</span>}
              </div>
            </div>
          </div>

          {!profileLoading && !isProfileComplete && (
            <div className="pa-warn-banner">
              <p>Complete your profile before applying</p>
              <p className="pa-sub">Required fields: {missingFields.join(', ')}</p>
              <button type="button" className="pa-btn mt-3" onClick={() => navigate('/settings')}>
                Go to settings
              </button>
            </div>
          )}

          {submitError && <div className="pa-error-banner">{submitError}</div>}

          {/* Step: Your info */}
          {currentStep === 'info' && (
            <>
              {(position.description || requirementItems.length > 0) && (
                <div className="pa-section-card">
                  <div className="pa-section-head">
                    <h2>About this opportunity</h2>
                    <p>Details provided by the organization.</p>
                  </div>
                  <div className="pa-section-body">
                    {position.description && (
                      <div className="pa-form-group">
                        <div className="pa-if-label">Description</div>
                        <p className="pa-detail-text">{position.description}</p>
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
                      onChange={(e) => setPhoneInput(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Step: Questions */}
          {currentStep === 'questions' && questions.length > 0 && (
            <div className="pa-section-card">
              <div className="pa-section-head">
                <h2>Application questions</h2>
                <p>
                  {hospitalName ? `Questions from ${hospitalName}` : 'Application questions'} — take your time with
                  these.
                </p>
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
                      {renderQuestionField(q)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: Documents */}
          {currentStep === 'documents' && (
            <>
              <div className="pa-section-card">
                <div className="pa-section-head">
                  <h2>Upload documents</h2>
                  <p>
                    Attach your resume, CV, certifications, references, or other supporting documents.
                    These are optional but strongly recommended.
                  </p>
                </div>
                <div className="pa-section-body">
                  <DocumentUpload
                    documents={pendingDocuments}
                    onChange={setPendingDocuments}
                    maxFiles={5}
                  />
                </div>
              </div>

              {schedulingQuestions.length > 0 && (
                <SchedulingQuestionsForm
                  questions={schedulingQuestions}
                  answers={schedulingAnswers}
                  onAnswerChange={(qId, val) =>
                    setSchedulingAnswers((prev) => ({ ...prev, [qId]: val }))
                  }
                />
              )}
            </>
          )}

          {/* Step: Availability */}
          {currentStep === 'availability' && (
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
                        onClick={() => {
                          setSelectedDays((prev) => {
                            const next = new Set(prev);
                            if (next.has(d.id)) next.delete(d.id);
                            else next.add(d.id);
                            return next;
                          });
                        }}
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
                          onChange={() => setTimePref(opt.value)}
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
                      onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                    />
                    <span className="text-xs" style={{ color: 'var(--pa-text-3)' }}>
                      20h
                    </span>
                  </div>
                  {position.hours_per_week != null && (
                    <p className="pa-form-hint">This position lists approximately {position.hours_per_week}h/week.</p>
                  )}
                </div>

                <div className="pa-form-group">
                  <label className="pa-form-label">Minimum commitment you can make</label>
                  <select
                    className="pa-select"
                    value={commitment}
                    onChange={(e) => setCommitment(e.target.value)}
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
          )}

          {/* Step: Review */}
          {currentStep === 'review' && (
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

                {pendingDocuments.length > 0 && (
                  <div className="pa-form-group">
                    <div className="pa-if-label" style={{ marginBottom: 12 }}>
                      Documents ({pendingDocuments.length})
                    </div>
                    <div className="space-y-2 rounded-md border border-[var(--pa-border)] bg-[var(--pa-surface-2)] p-4">
                      {pendingDocuments.map((doc) => (
                        <div key={doc.id} className="text-sm flex items-center gap-2">
                          <span className="text-[var(--pa-text-3)] text-xs uppercase">{doc.fileType}</span>
                          <span className="text-[var(--pa-text-1)]">{doc.fileName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {schedulingQuestions.length > 0 && schedulingQuestions.some((q) => schedulingAnswers[q.id]?.trim()) && (
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
          )}
        </div>

        {/* Sticky actions */}
        <div className="pa-action-bar">
          <div className="pa-action-inner">
            <div className="pa-action-left">
              Step <span>{stepIndex + 1}</span> of {steps.length}
              {currentStep === 'review' && (
                <>
                  {' '}
                  · <span>Review & submit</span>
                </>
              )}
            </div>
            <div className="pa-action-btns">
              {stepIndex > 0 && (
                <button type="button" className="pa-btn" onClick={goBack} disabled={submitting}>
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>
              )}
              {currentStep !== 'review' ? (
                <button
                  type="button"
                  className="pa-btn pa-btn-primary"
                  onClick={goNext}
                  disabled={submitting || profileLoading || !isProfileComplete}
                >
                  {currentStep === 'availability' ? 'Review application' : 'Continue'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  className="pa-btn pa-btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting || profileLoading || !isProfileComplete}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      Submit application
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
