import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { AppIcon } from "../components/AppIcon";
import { formatEuro } from "../domain/money";
import { listSalonClients, type SalonClient } from "../firebase/client-repo";

type Segment = "tutti" | "attivi" | "senza-prenotazioni" | "senza-acquisti";

function daysSince(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(`${value}T12:00:00`).getTime()) / 86_400_000));
}

function formatDate(value: string | null) {
  if (!value) return "Mai";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`));
}

export function ClientsPage() {
  const { salonId } = useAuth();
  const [clients, setClients] = useState<SalonClient[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("tutti");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salonId) return;
    setLoading(true);
    void listSalonClients(salonId)
      .then(setClients)
      .catch(() => setError("Non è stato possibile caricare i clienti."))
      .finally(() => setLoading(false));
  }, [salonId]);

  const visible = useMemo(() => clients.filter((client) => {
    const matchesQuery = `${client.nome} ${client.email}`.toLowerCase().includes(query.toLowerCase());
    if (!matchesQuery) return false;
    if (segment === "attivi") return (daysSince(client.lastBookingDate) ?? Infinity) <= 60;
    if (segment === "senza-prenotazioni") return (daysSince(client.lastBookingDate) ?? Infinity) > 90;
    if (segment === "senza-acquisti") return (daysSince(client.lastOrderDate) ?? Infinity) > 90;
    return true;
  }), [clients, query, segment]);

  return (
    <section className="clients-page">
      <header className="dashboard-page-header"><div><span>CRM</span><h2>Clienti</h2><p>Anagrafica, frequenza e valore della clientela.</p></div><Link className="btn" to="/dashboard/notifiche">Crea campagna</Link></header>
      <div className="client-metrics"><article><strong>{clients.length}</strong><span>Clienti registrati</span></article><article><strong>{clients.filter((client) => (daysSince(client.lastBookingDate) ?? Infinity) <= 60).length}</strong><span>Attivi negli ultimi 60 giorni</span></article><article><strong>{clients.filter((client) => !client.lastBookingDate).length}</strong><span>Mai prenotato</span></article></div>
      <div className="client-toolbar"><label><span>Cerca cliente</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome o email" /></label><label><span>Segmento</span><select value={segment} onChange={(event) => setSegment(event.target.value as Segment)}><option value="tutti">Tutti</option><option value="attivi">Attivi negli ultimi 60 giorni</option><option value="senza-prenotazioni">Senza prenotazioni da 90 giorni</option><option value="senza-acquisti">Senza acquisti da 90 giorni</option></select></label></div>
      {loading ? <div className="client-empty">Caricamento clienti…</div> : error ? <p role="alert" className="client-empty">{error}</p> : (
        <div className="client-table">
          <div className="client-table__head"><span>Cliente</span><span>Ultima prenotazione</span><span>Ultimo acquisto</span><span>Valore</span><span>Canali</span></div>
          {visible.map((client) => <article key={client.id}>
            <div className="client-identity"><span>{client.nome.slice(0, 1)}</span><div><strong>{client.nome}</strong><small>{client.email}</small></div></div>
            <div><strong>{formatDate(client.lastBookingDate)}</strong><small>{client.bookingCount} {client.bookingCount === 1 ? "prenotazione" : "prenotazioni"}</small></div>
            <div><strong>{formatDate(client.lastOrderDate)}</strong><small>{client.orderCount} {client.orderCount === 1 ? "ordine" : "ordini"}</small></div>
            <div><strong>€ {formatEuro(client.totalSpent)}</strong><small>Totale acquisti</small></div>
            <div className="client-channels"><AppIcon name="bell" size={17} /><span>{client.hasPush ? "Email + push" : "Email"}</span></div>
          </article>)}
          {visible.length === 0 && <div className="client-empty">Nessun cliente corrisponde ai filtri selezionati.</div>}
        </div>
      )}
    </section>
  );
}
