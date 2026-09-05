import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth-context";

export function RequireSuperAdmin({ children }: { children: ReactNode }) {
  const { loading, role } = useAuth();
  if (loading) return <div className="platform-auth-loading">Caricamento piattaforma…</div>;
  if (role !== "superadmin") return <Navigate to="/accedi" replace />;
  return <>{children}</>;
}
