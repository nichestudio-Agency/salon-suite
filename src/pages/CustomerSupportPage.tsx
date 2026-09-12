import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { TicketCenter } from "../components/TicketCenter";
import "./customer.css";

export function CustomerSupportPage() {
  const { user, salonId } = useAuth(); const { salon } = useSalonTenant();
  return <section className="customer-page customer-support-page"><header className="customer-shell__header"><div><span className="customer-shell__eyebrow">Parla con {salon?.nome ?? "il salone"}</span><h1>Assistenza</h1><p>Apri una richiesta e continua la conversazione direttamente dall’app.</p></div></header><TicketCenter mode="customer" salonId={salonId} viewerName={user?.displayName || user?.email || "Cliente"} /></section>;
}
