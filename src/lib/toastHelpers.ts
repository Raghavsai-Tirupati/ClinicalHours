// Helper functions for consistent toast notifications with appropriate timeouts
import { toast as sonnerToast } from "sonner";

/**
 * Show success toast (shorter duration - 3 seconds)
 */
export function toastSuccess(message: string, description?: string) {
  return sonnerToast.success(message, {
    description,
    duration: 3000,
  });
}

/**
 * Show error toast (longer duration - 6 seconds so users can read it)
 */
export function toastError(message: string, description?: string) {
  return sonnerToast.error(message, {
    description,
    duration: 6000,
  });
}

/**
 * Show info toast (medium duration - 4 seconds)
 */
export function toastInfo(message: string, description?: string) {
  return sonnerToast.info(message, {
    description,
    duration: 4000,
  });
}

/**
 * Show warning toast (medium duration - 5 seconds)
 */
export function toastWarning(message: string, description?: string) {
  return sonnerToast.warning(message, {
    description,
    duration: 5000,
  });
}

/** Consistent success/partial-failure toasts for bulk invite and email sends. */
export function toastBulkSendResult(options: {
  kind: 'invite' | 'email';
  sent: number;
  failed: number;
  alreadySent?: number;
  errors?: unknown[];
}) {
  const { kind, sent, failed, alreadySent = 0, errors = [] } = options;
  const firstError = typeof errors[0] === 'string' ? errors[0] : null;

  if (sent > 0) {
    toastSuccess(
      kind === 'invite'
        ? `Interview invites sent to ${sent} applicant${sent === 1 ? '' : 's'}`
        : `Email sent to ${sent} recipient${sent === 1 ? '' : 's'}`,
    );
  } else if (failed === 0 && alreadySent > 0) {
    toastInfo('Selected applicants have already been invited');
  } else if (failed === 0) {
    toastInfo(kind === 'invite' ? 'No invites were sent' : 'No emails were sent');
  }

  if (failed > 0) {
    const noun = kind === 'invite' ? 'invite' : 'email';
    const errSuffix = firstError ? `: ${firstError}` : '';
    toastError(`${failed} ${noun}${failed === 1 ? '' : 's'} failed${errSuffix}`);
  }
}

