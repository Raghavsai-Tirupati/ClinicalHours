import { Loader2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import ApplyTopNav from './ApplyTopNav';

interface LoadingScreenProps {
  layout: (inner: React.ReactNode) => React.ReactElement;
}

export function LoadingScreen({ layout }: LoadingScreenProps) {
  return layout(
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--pa-accent)' }} />
    </div>,
  );
}

interface SignInRequiredScreenProps {
  layout: (inner: React.ReactNode) => React.ReactElement;
  positionId: string | undefined;
}

export function SignInRequiredScreen({ layout, positionId }: SignInRequiredScreenProps) {
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

interface AlreadyAppliedScreenProps {
  layout: (inner: React.ReactNode) => React.ReactElement;
}

export function AlreadyAppliedScreen({ layout }: AlreadyAppliedScreenProps) {
  return layout(
    <div className="pa-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="pa-section-card w-full max-w-md">
        <div className="pa-section-head">
          <h2>Already applied</h2>
          <p>You have already submitted an application for this position.</p>
        </div>
        <div className="pa-section-body">
          <Link to="/" className="pa-btn pa-btn-primary w-full justify-center">
            Back to home
          </Link>
        </div>
      </div>
    </div>,
  );
}

interface ErrorScreenProps {
  layout: (inner: React.ReactNode) => React.ReactElement;
  message: string;
}

export function ErrorScreen({ layout, message }: ErrorScreenProps) {
  return layout(
    <div className="pa-page text-center" style={{ color: 'var(--pa-text-2)' }}>
      {message}
    </div>,
  );
}

interface ClosedScreenProps {
  layout: (inner: React.ReactNode) => React.ReactElement;
  deadline: string | null;
}

export function ClosedScreen({ layout, deadline }: ClosedScreenProps) {
  return layout(
    <div className="pa-page flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="pa-section-card w-full max-w-2xl">
        <div className="pa-section-head">
          <h2>Applications are closed</h2>
          <p>This position is no longer accepting submissions.</p>
        </div>
        <div className="pa-section-body">
          <p className="pa-sub">
            {deadline
              ? `The deadline passed on ${new Date(deadline).toLocaleDateString()}.`
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

interface SuccessScreenProps {
  layout: (inner: React.ReactNode) => React.ReactElement;
  hospitalName: string;
}

export function SuccessScreen({ layout, hospitalName }: SuccessScreenProps) {
  return layout(
    <>
      <ApplyTopNav />
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
