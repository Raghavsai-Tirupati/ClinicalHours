import type { HospitalPosition } from '@/types/positions';

type PositionAvailabilityInput = Pick<HospitalPosition, 'status' | 'application_deadline'>;

export function isPositionDeadlinePassed(applicationDeadline: string | null | undefined): boolean {
  if (!applicationDeadline) return false;

  const deadline = new Date(applicationDeadline);
  if (Number.isNaN(deadline.getTime())) return false;

  return deadline.getTime() < Date.now();
}

export function isPositionAcceptingApplications(position: PositionAvailabilityInput): boolean {
  return position.status === 'active' && !isPositionDeadlinePassed(position.application_deadline);
}
