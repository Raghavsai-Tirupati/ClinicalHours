import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useHospitalMember } from "@/hooks/useHospitalMember";

export function HospitalOnlyRoute({ children }: { children: React.ReactNode }) {
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

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (!member) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

