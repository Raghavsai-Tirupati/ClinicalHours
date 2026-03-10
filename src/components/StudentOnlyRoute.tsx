import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalMember } from "@/hooks/useHospitalMember";

/** Paths that hospital members may access (admin for a specific opportunity). */
const HOSPITAL_ALLOWED_PATTERNS = [/^\/opportunities\/[^/]+\/admin$/];

function isHospitalAllowedPath(pathname: string): boolean {
  return HOSPITAL_ALLOWED_PATTERNS.some((re) => re.test(pathname));
}

/**
 * Wraps student-only pages. Hospital members are redirected to /hospital-dashboard,
 * except when on hospital-allowed paths (e.g. /opportunities/:slug/admin).
 */
export function StudentOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { member, loading: memberLoading } = useHospitalMember();
  const location = useLocation();

  if (authLoading || memberLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Hospital members: redirect from student pages, allow hospital-admin paths
  if (user && member && !isHospitalAllowedPath(location.pathname)) {
    return <Navigate to="/hospital-dashboard" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
