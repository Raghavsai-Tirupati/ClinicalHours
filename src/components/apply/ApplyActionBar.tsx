import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

interface ApplyActionBarProps {
  stepIndex: number;
  totalSteps: number;
  currentStep: string;
  submitting: boolean;
  profileLoading: boolean;
  isProfileComplete: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export default function ApplyActionBar({
  stepIndex,
  totalSteps,
  currentStep,
  submitting,
  profileLoading,
  isProfileComplete,
  onBack,
  onNext,
  onSubmit,
}: ApplyActionBarProps) {
  return (
    <div className="pa-action-bar">
      <div className="pa-action-inner">
        <div className="pa-action-left">
          Step <span>{stepIndex + 1}</span> of {totalSteps}
          {currentStep === 'review' && (
            <>
              {' '}
              · <span>Review & submit</span>
            </>
          )}
        </div>
        <div className="pa-action-btns">
          {stepIndex > 0 && (
            <button type="button" className="pa-btn" onClick={onBack} disabled={submitting}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          )}
          {currentStep !== 'review' ? (
            <button
              type="button"
              className="pa-btn pa-btn-primary"
              onClick={onNext}
              disabled={submitting || profileLoading || !isProfileComplete}
            >
              {currentStep === 'availability' ? 'Review application' : 'Continue'}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className="pa-btn pa-btn-primary"
              onClick={onSubmit}
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
  );
}
