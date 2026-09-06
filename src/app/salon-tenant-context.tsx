import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSalon, type SalonWithId } from "../firebase/salon-repo";
import { useAuth } from "./auth-context";

interface SalonTenantState {
  loading: boolean;
  salon: SalonWithId | null;
  error: string | null;
}

const SalonTenantContext = createContext<SalonTenantState | null>(null);

export function SalonTenantProvider({ children }: { children: ReactNode }) {
  const { loading: authLoading, salonId: accountSalonId } = useAuth();
  const [state, setState] = useState<SalonTenantState>({ loading: true, salon: null, error: null });

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    async function resolveTenant() {
      try {
        const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
        const previewId = isLocal ? new URLSearchParams(window.location.search).get("salon")?.trim() : "";
        const configuredId = accountSalonId || previewId || import.meta.env.VITE_SALON_ID?.trim() || (isLocal ? "salone-x" : "");
        if (configuredId) {
          if (active) setState((current) => current.salon?.id === configuredId ? current : { loading: true, salon: null, error: null });
          const salon = await getSalon(configuredId);
          if (!salon) throw new Error("tenant-not-found");
          if (active) setState({ loading: false, salon: { id: configuredId, ...salon }, error: null });
          return;
        }

        throw new Error("tenant-not-configured");
      } catch {
        if (active) setState({ loading: false, salon: null, error: "Questo salone non è configurato." });
      }
    }
    void resolveTenant();
    return () => { active = false; };
  }, [accountSalonId, authLoading]);

  return <SalonTenantContext.Provider value={state}>{children}</SalonTenantContext.Provider>;
}

export function useSalonTenant(): SalonTenantState {
  const value = useContext(SalonTenantContext);
  if (!value) throw new Error("useSalonTenant deve essere usato dentro SalonTenantProvider");
  return value;
}

export function useOptionalSalonTenant(): SalonTenantState | null {
  return useContext(SalonTenantContext);
}
