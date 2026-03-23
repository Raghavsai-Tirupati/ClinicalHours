import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { StudentApplication } from '@/types/positions';

function isLegacyApplication(app: StudentApplication): boolean {
  return '_isLegacy' in app && (app as StudentApplication & { _isLegacy?: boolean })._isLegacy === true;
}

/**
 * When `enabled` and application status is `new` (non-legacy), PATCH to `under_review` without `reviewed_at`.
 */
export function useAutoMarkApplicationUnderReview(
  application: StudentApplication | null,
  enabled: boolean,
  onApplicationPatched: (appId: string, patch: Partial<StudentApplication>) => void,
): boolean {
  const [autoReviewing, setAutoReviewing] = useState(false);
  const lastAutoMarkedId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastAutoMarkedId.current = null;
      setAutoReviewing(false);
      return;
    }

    if (!application?.id) {
      setAutoReviewing(false);
      return;
    }

    if (isLegacyApplication(application) || application.status !== 'new') {
      setAutoReviewing(false);
      return;
    }

    const appId = application.id;
    if (lastAutoMarkedId.current === appId) return;
    lastAutoMarkedId.current = appId;

    let cancelled = false;
    setAutoReviewing(true);

    (async () => {
      const { error } = await supabase
        .from('student_applications')
        .update({ status: 'under_review' })
        .eq('id', appId);

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error('Could not mark as under review');
        lastAutoMarkedId.current = null;
      } else {
        onApplicationPatched(appId, { status: 'under_review' });
      }
      setAutoReviewing(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [application, enabled, onApplicationPatched]);

  return autoReviewing;
}
