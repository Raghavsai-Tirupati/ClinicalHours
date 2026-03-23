import type { ApplicationStatus } from '@/types/positions';

const TERMINAL_STATUSES: ApplicationStatus[] = ['accepted', 'rejected', 'waitlisted'];

/** Payload for `student_applications` updates. Sets `reviewed_at` only for final decisions. */
export function buildStudentApplicationStatusUpdate(newStatus: ApplicationStatus): {
  status: ApplicationStatus;
  reviewed_at?: string;
} {
  if (TERMINAL_STATUSES.includes(newStatus)) {
    return { status: newStatus, reviewed_at: new Date().toISOString() };
  }
  return { status: newStatus };
}
