import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth-context";

export function RequireClient({ children }: { children: ReactNode }) {
  const { loading, role } = useAuth();
  if (loading) return <div>caricamento…</div>;
  if (role !== "cliente") return <Navigate to="/accedi" replace />;
  return <>{children}</>;
}
