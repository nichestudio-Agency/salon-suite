import { useState } from "react";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { TicketCenter } from "../components/TicketCenter";

export function SalonSupportPage() {
  const { user, salonId } = useAuth(); const { salon } = useSalonTenant(); const [tab, setTab] = useState<"clienti" | "piattaforma">("clienti"); const viewer = user?.displayName || salon?.nome || "Salone";
  return <section><header className="dashboard-page-header"><div><span>Centro assistenza</span><h2>Ticket</h2><p>Rispondi ai clienti oppure contatta direttamente il team Salon Suite.</p></div></header><nav className="support-tabs" aria-label="Canali assistenza"><button className={tab === "clienti" ? "is-active" : ""} onClick={() => setTab("clienti")}>Richieste clienti</button><button className={tab === "piattaforma" ? "is-active" : ""} onClick={() => setTab("piattaforma")}>Assistenza Salon Suite</button></nav>{tab === "clienti" ? <TicketCenter mode="salon-customer" salonId={salonId} viewerName={viewer} /> : <TicketCenter mode="salon-platform" salonId={salonId} viewerName={viewer} />}</section>;
}
