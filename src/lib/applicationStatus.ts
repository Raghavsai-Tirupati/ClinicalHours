import { supabase } from '@/integrations/supabase/client';
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

/**
 * Auto-promote an accepted applicant into the Staff (clinic_members) table.
 * Safe to call multiple times — skips if a row already exists for this
 * application or student in the same clinic.
 *
 * Returns `{ created: true }` if a new row was inserted, or `{ created: false }`
 * if one already existed (or if the insert failed, in which case `error` is set).
 */
export async function autoPromoteToStaff({
  clinicId,
  applicationId,
  studentId,
  fullName,
  email,
}: {
  clinicId: string;
  applicationId: string;
  studentId: string | null;
  fullName: string;
  email: string | null;
}): Promise<{ created: boolean; error?: string }> {
  // Check by application_id first
  const { data: byApp } = await supabase
    .from('clinic_members')
    .select('id')
    .eq('clinic_id', clinicId)
    .eq('application_id', applicationId)
    .maybeSingle();

  if (byApp) return { created: false };

  // Check by user_id (same student, different application)
  if (studentId) {
    const { data: byUser } = await supabase
      .from('clinic_members')
      .select('id')
      .eq('clinic_id', clinicId)
      .eq('user_id', studentId)
      .maybeSingle();

    if (byUser) {
      // Link existing member to this application
      await supabase
        .from('clinic_members')
        .update({ application_id: applicationId, status: 'active' })
        .eq('id', byUser.id);
      return { created: false };
    }
  }

  const { error } = await supabase.from('clinic_members').insert({
    clinic_id: clinicId,
    user_id: studentId || null,
    application_id: applicationId,
    full_name: fullName,
    email,
    status: 'active',
    onboarding_source: 'new_applicant',
    join_date: new Date().toISOString().slice(0, 10),
  });

  if (error) {
    console.error('autoPromoteToStaff failed:', error);
    return { created: false, error: error.message };
  }

  return { created: true };
}
