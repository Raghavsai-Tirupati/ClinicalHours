import type { HospitalPosition } from '@/types/positions';

type PositionAvailabilityInput = Pick<HospitalPosition, 'status' | 'application_deadline'>;

function parseDeadlineDate(s: string): Date {
  // Date-only strings (YYYY-MM-DD) are parsed as UTC midnight by the JS engine,
  // which shifts them back one day in US timezones.  Appending T12:00:00 (no Z)
  // forces local-noon interpretation, which stays on the correct calendar date
  // in any UTC offset from -12 to +12.
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
}

export function isPositionDeadlinePassed(applicationDeadline: string | null | undefined): boolean {
  if (!applicationDeadline) return false;

  const deadline = parseDeadlineDate(applicationDeadline);
  if (Number.isNaN(deadline.getTime())) return false;

  return deadline.getTime() < Date.now();
}

export function isPositionAcceptingApplications(position: PositionAvailabilityInput): boolean {
  return position.status === 'active' && !isPositionDeadlinePassed(position.application_deadline);
}
