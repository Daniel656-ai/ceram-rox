import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, role, roles, loading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // Mehrfachrollen: Zugriff, sobald EINE der Rollen erlaubt ist.
  const effectiveRoles = roles.length > 0 ? roles : role ? [role] : [];
  if (allowedRoles && effectiveRoles.length > 0 && !effectiveRoles.some((r) => allowedRoles.includes(r))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
