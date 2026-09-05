import { Navigate } from "react-router-dom";
import { useAuth } from "./auth-context";

export function RoleHome() {
  const { loading, role, salonId } = useAuth();
  if (loading) return <div>caricamento…</div>;
  if (role === "owner" && salonId) {
    return <Navigate to="/dashboard" replace />;
  }
  if (role === "superadmin") {
    return <Navigate to="/admin" replace />;
  }
  if (role === "cliente") {
    return <Navigate to="/home" replace />;
  }
  return <Navigate to="/accedi" replace />;
}
