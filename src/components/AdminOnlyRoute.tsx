import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminCheck } from "@/hooks/useAdminCheck";

export function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdminCheck();
  const location = useLocation();

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

