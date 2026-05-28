import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { isPositionDeadlinePassed } from '@/lib/positionAvailability';
import { useAuth } from '@/hooks/useAuth';
import { usePositionDetail } from '@/hooks/usePositionDetail';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import type { ApplicationAvailability, ClinicSchedulingQuestion } from '@/types/positions';
import ApplyTopNav from '@/components/apply/ApplyTopNav';
import PositionHeader from '@/components/apply/PositionHeader';
import InfoStep from '@/components/apply/InfoStep';
import QuestionsStep from '@/components/apply/QuestionsStep';
import AvailabilityStep from '@/components/apply/AvailabilityStep';
import ReviewStep from '@/components/apply/ReviewStep';
import {
  LoadingScreen,
  SignInRequiredScreen,
  AlreadyAppliedScreen,
  ErrorScreen,
  ClosedScreen,
  SuccessScreen,
} from '@/components/apply/ApplyGuardScreens';
import ApplyActionBar from '@/components/apply/ApplyActionBar';

import './position-apply.css';

type StepKey = 'info' | 'questions' | 'availability' | 'review';

const STEP_LABELS: Record<StepKey, string> = {
  info: 'Your info',
  questions: 'Questions',
  availability: 'Availability',
  review: 'Review',
};

function buildStepsWithAvailability(hasQuestions: boolean, askForAvailability: boolean): StepKey[] {
  const steps: StepKey[] = ['info'];
  if (hasQuestions) steps.push('questions');
  if (askForAvailability) steps.push('availability');
  steps.push('review');
  return steps;
}

function parseRequirements(requirements: string | null): string[] {
  if (!requirements) return [];
  return requirements
    .split(/\r?\n|;/g)
    .map((item) => item.trim().replace(/^[\-•*]\s*/, ''))
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
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  const askForAvailability = position?.ask_for_availability !== false;
  const steps = useMemo(
    () => buildStepsWithAvailability(questions.length > 0 || schedulingQuestions.length > 0, askForAvailability),
    [questions.length, schedulingQuestions.length, askForAvailability],
  );
  const currentStep = steps[stepIndex];
  const requirementItems = useMemo(() => parseRequirements(position?.requirements ?? null), [position?.requirements]);

  // Check if user already applied (new system or legacy)
  useEffect(() => {
    if (!user || !positionId) return;
    (async () => {
      // New system check
      const { data: newApp } = await supabase
        .from('student_applications')
        .select('id')
        .eq('position_id', positionId)
        .eq('student_id', user.id)
        .maybeSingle();
      if (newApp) { setAlreadyApplied(true); return; }

      // Legacy check: position → hospital_page → opportunity → hospital_account → hospital_applications
      const { data: posRow } = await supabase
        .from('hospital_positions')
        .select('hospital_page_id')
        .eq('id', positionId)
        .maybeSingle();
      if (!posRow?.hospital_page_id) return;

      const { data: hpRow } = await supabase
        .from('hospital_pages')
        .select('hospital_id')
        .eq('id', posRow.hospital_page_id)
        .maybeSingle();
      if (!hpRow?.hospital_id) return;

      const { data: oppRow } = await supabase
        .from('opportunities')
        .select('hospital_id')
        .eq('id', hpRow.hospital_id)
        .maybeSingle();
      if (!oppRow?.hospital_id) return;

      const { data: acctRow } = await supabase
        .from('hospital_accounts')
        .select('id')
        .eq('hospital_id', oppRow.hospital_id)
        .maybeSingle();
      if (!acctRow?.id) return;

      const { data: legacyApp } = await supabase
        .from('hospital_applications')
        .select('id')
        .eq('account_id', acctRow.id)
        .eq('opportunity_id', hpRow.hospital_id)
        .eq('student_id', user.id)
        .maybeSingle();
      if (legacyApp) setAlreadyApplied(true);
    })();
  }, [user, positionId]);

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

      // Fetch scheduling questions for THIS position. Questions are now
      // scoped per-position rather than clinic-wide.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: schedQs } = await (supabase as any)
        .from('clinic_scheduling_questions')
        .select('*')
        .eq('position_id', position.id)
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
    if (currentStep === 'questions') {
      if (!validateQuestions()) return false;
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

  const layout = (inner: React.ReactNode) => (
    <div className="pa-root min-h-screen">
      {inner}
    </div>
  );

  if (authLoading || loading) return <LoadingScreen layout={layout} />;
  if (!user) return <SignInRequiredScreen layout={layout} positionId={positionId} />;
  if (alreadyApplied) return <AlreadyAppliedScreen layout={layout} />;
  if (error || !position) return <ErrorScreen layout={layout} message={error || 'Position not found'} />;
  if (position.status !== 'active' || isPositionDeadlinePassed(position.application_deadline)) {
    return <ClosedScreen layout={layout} deadline={position.application_deadline} />;
  }
  if (submitted) return <SuccessScreen layout={layout} hospitalName={hospitalName} />;

  return (
    <>
      <Helmet>
        <title>
          Apply: {position.title} · {hospitalName || 'ClinicalHours'}
        </title>
      </Helmet>

      <div className="pa-root min-h-screen">
        <ApplyTopNav />

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
          <PositionHeader
            position={position}
            hospitalName={hospitalName}
            isProfileComplete={isProfileComplete}
            profileLoading={profileLoading}
            missingFields={missingFields}
            submitError={submitError}
          />

          {currentStep === 'info' && (
            <InfoStep
              profile={profile}
              description={position.description}
              requirementItems={requirementItems}
              phoneInput={phoneInput}
              onPhoneChange={setPhoneInput}
            />
          )}

          {currentStep === 'questions' && (
            <QuestionsStep
              hospitalName={hospitalName}
              questions={questions}
              answers={answers}
              onAnswerChange={(id, val) => setAnswers((prev) => ({ ...prev, [id]: val }))}
              fileAnswers={fileAnswers}
              onFileChange={(id, file) => {
                setFileAnswers((prev) => ({ ...prev, [id]: file }));
                setFileNames((prev) => ({ ...prev, [id]: file.name }));
              }}
              fileNames={fileNames}
              schedulingQuestions={schedulingQuestions}
              schedulingAnswers={schedulingAnswers}
              onSchedulingAnswerChange={(qId, val) =>
                setSchedulingAnswers((prev) => ({ ...prev, [qId]: val }))
              }
            />
          )}

          {currentStep === 'availability' && (
            <AvailabilityStep
              selectedDays={selectedDays}
              onDayToggle={(dayId) =>
                setSelectedDays((prev) => {
                  const next = new Set(prev);
                  if (next.has(dayId)) next.delete(dayId);
                  else next.add(dayId);
                  return next;
                })
              }
              timePref={timePref}
              onTimePrefChange={setTimePref}
              hoursPerWeek={hoursPerWeek}
              onHoursChange={setHoursPerWeek}
              commitment={commitment}
              onCommitmentChange={setCommitment}
              positionHoursPerWeek={position.hours_per_week}
            />
          )}

          {currentStep === 'review' && (
            <ReviewStep
              position={position}
              hospitalName={hospitalName}
              profile={profile}
              phoneInput={phoneInput}
              questions={questions}
              answers={answers}
              fileAnswers={fileAnswers}
              fileNames={fileNames}
              schedulingQuestions={schedulingQuestions}
              schedulingAnswers={schedulingAnswers}
              askForAvailability={askForAvailability}
              availabilityPayload={availabilityPayload}
            />
          )}
        </div>

        <ApplyActionBar
          stepIndex={stepIndex}
          totalSteps={steps.length}
          currentStep={currentStep}
          submitting={submitting}
          profileLoading={profileLoading}
          isProfileComplete={isProfileComplete}
          onBack={goBack}
          onNext={goNext}
          onSubmit={handleSubmit}
        />
      </div>
    </>
  );
}
