/** Super-admin email with full access to all clinic dashboards and data. */
export const SUPER_ADMIN_EMAIL = 'clinicalhours.org@gmail.com';

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}
