/**
 * /auth/google/callback
 *
 * Landing page after Google redirects back from the OAuth consent screen.
 * Extracts `code` and `state` from the URL, calls the `gmail-oauth-callback`
 * edge function (which uses the server-side client secret), then sends the
 * admin back to their settings page.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

type Status = 'loading' | 'success' | 'error';

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Connecting your Gmail account…');
  const calledRef = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke.
    if (calledRef.current) return;
    calledRef.current = true;

    void handleCallback();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const errorParam = params.get('error');

    // Retrieve the return path the settings page stored before the redirect.
    const returnPath = sessionStorage.getItem('gmail_oauth_return_path') ?? '/hospital-dashboard/settings';
    sessionStorage.removeItem('gmail_oauth_return_path');

    if (errorParam) {
      setStatus('error');
      setMessage(
        errorParam === 'access_denied'
          ? 'Gmail connection was cancelled.'
          : `Google returned an error: ${errorParam}`,
      );
      setTimeout(() => navigate(returnPath), 3000);
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Missing authorisation code or state. Please try again.');
      setTimeout(() => navigate(returnPath), 3000);
      return;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setStatus('error');
        setMessage('Your session has expired. Please log in again.');
        setTimeout(() => navigate('/auth'), 3000);
        return;
      }

      const { data, error } = await supabase.functions.invoke('gmail-oauth-callback', {
        body: { code, state },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error || !data?.success) {
        throw new Error(data?.error ?? error?.message ?? 'Unknown error');
      }

      setStatus('success');
      setMessage(`Gmail connected: ${data.gmail_email}`);
      setTimeout(() => navigate(returnPath), 2000);
    } catch (err: unknown) {
      console.error('Gmail callback error:', err);
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Failed to connect Gmail. Please try again.');
      setTimeout(() => navigate(returnPath), 4000);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-sm px-6">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">{message}</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="rounded-full h-12 w-12 bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium text-foreground">{message}</p>
            <p className="text-sm text-muted-foreground mt-1">Redirecting back to settings…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="rounded-full h-12 w-12 bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-medium text-destructive">Connection failed</p>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
            <p className="text-xs text-muted-foreground mt-2">Redirecting back to settings…</p>
          </>
        )}
      </div>
    </div>
  );
}
