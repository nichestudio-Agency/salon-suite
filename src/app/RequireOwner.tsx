import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth-context";

/** Consente l'accesso solo a un utente con ruolo owner; altrimenti reindirizza. */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { loading, role, salonId } = useAuth();
  if (loading) return <div>caricamento…</div>;
  if (role !== "owner" || !salonId) return <Navigate to="/accedi" replace />;
  return <>{children}</>;
}
