import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { AppIcon } from "../components/AppIcon";
import { formatEuro } from "../domain/money";
import type { Gender } from "../domain/models";
import { createManualClient, getClientHistory, listSalonClients, recordClientVisit, updateManualClient, type ClientHistoryEntry, type ClientHistoryKind, type SalonClient } from "../firebase/client-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";

type Segment = "tutti" | "30" | "60" | "90" | "custom";
const today = () => new Date().toISOString().slice(0, 10);
function daysSince(value: string | null) { return value ? Math.max(0, Math.floor((Date.now() - new Date(`${value}T12:00:00`).getTime()) / 86_400_000)) : null; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T12:00:00`)) : "Mai"; }

export function ClientsPage() {
  const [searchParams] = useSearchParams();
  const { salonId } = useAuth();
  const [clients, setClients] = useState<SalonClient[]>([]);
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<Segment>("tutti");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<SalonClient | null>(null);
  const [showCreate, setShowCreate] = useState(searchParams.get("create") === "1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newClient, setNewClient] = useState({ nome: "", email: "", telefono: "", sesso: "altro" as Gender, dataNascita: "" });
  const [visit, setVisit] = useState({ serviceId: "", date: today(), importo: "", note: "" });
  const [history, setHistory] = useState<ClientHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyType, setHistoryType] = useState<"tutti" | ClientHistoryKind>("tutti");
  const [historyPeriod, setHistoryPeriod] = useState<"30" | "90" | "all" | "custom">("all");
  const [visitFrom, setVisitFrom] = useState("");
  const [visitTo, setVisitTo] = useState(today());
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState(today());

  async function reload(id: string) {
    const [nextClients, nextServices, nextOperators] = await Promise.all([listSalonClients(id), listServices(id).catch(() => []), listOperators(id).catch(() => [])]);
    setClients(nextClients); setServices(nextServices.filter((item) => item.attivo)); setOperators(nextOperators);
    if (selected) setSelected(nextClients.find((item) => item.id === selected.id) ?? null);
  }
  useEffect(() => { if (!salonId) return; setLoading(true); void reload(salonId).catch(() => setError("Non è stato possibile caricare i clienti.")).finally(() => setLoading(false)); }, [salonId]);

  const visible = useMemo(() => clients.filter((client) => {
    if (!`${client.nome} ${client.email} ${client.telefono ?? ""}`.toLowerCase().includes(query.toLowerCase())) return false;
    if (segment === "custom") {
      const lastVisit = client.lastVisitDate ?? client.lastBookingDate;
      return Boolean(lastVisit && (!visitFrom || lastVisit >= visitFrom) && (!visitTo || lastVisit <= visitTo));
    }
    return segment === "tutti" || (daysSince(client.lastVisitDate ?? client.lastBookingDate) ?? Infinity) >= Number(segment);
  }), [clients, query, segment, visitFrom, visitTo]);
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedClients = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); }, [query, segment, pageSize]);
  const filteredHistory = useMemo(() => history.filter((entry) => {
    if (historyType !== "tutti" && entry.kind !== historyType) return false;
    if (historyPeriod === "all") return true;
    if (!entry.date) return false;
    if (historyPeriod === "custom") return (!historyFrom || entry.date >= historyFrom) && (!historyTo || entry.date <= historyTo);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(historyPeriod));
    return entry.date >= cutoff.toISOString().slice(0, 10);
  }), [history, historyFrom, historyPeriod, historyTo, historyType]);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);
  async function selectClient(client: SalonClient) { setSelected(client); setNotice(null); setHistory([]); setHistoryLoading(true); if (salonId) try { setHistory(await getClientHistory(salonId, client.id)); } catch { setHistory([]); } finally { setHistoryLoading(false); } }

  async function createClient(event: FormEvent) {
    event.preventDefault(); if (!salonId) return; setSaving(true); setError(null);
    try { await createManualClient(salonId, newClient); setNewClient({ nome: "", email: "", telefono: "", sesso: "altro", dataNascita: "" }); setShowCreate(false); setNotice("Cliente inserito nell’anagrafica."); await reload(salonId); }
    catch { setError("Non è stato possibile inserire il cliente."); } finally { setSaving(false); }
  }
  async function saveManualClient(event: FormEvent) {
    event.preventDefault(); if (!salonId || !selected || selected.source !== "manual") return; setSaving(true); setError(null);
    try { await updateManualClient(salonId, selected.id, { nome: selected.nome, email: selected.email, sesso: selected.sesso, dataNascita: selected.dataNascita }); setNotice("Anagrafica aggiornata."); await reload(salonId); }
    catch { setError("Non è stato possibile aggiornare l’anagrafica."); } finally { setSaving(false); }
  }
  async function saveVisit(event: FormEvent) {
    event.preventDefault(); if (!salonId || !selected) return; const service = services.find((item) => item.id === visit.serviceId); if (!service) return; setSaving(true); setError(null);
    try { await recordClientVisit(salonId, { clientId: selected.id, serviceId: service.id, serviceTitle: service.titolo, date: visit.date, importo: Math.round(Number(visit.importo.replace(",", ".")) * 100), ...(visit.note.trim() ? { note: visit.note.trim() } : {}) }); setVisit({ serviceId: "", date: today(), importo: "", note: "" }); setNotice(`Visita registrata per ${selected.nome}. Il cliente non risulterà inattivo.`); await reload(salonId); setHistory(await getClientHistory(salonId, selected.id)); }
    catch { setError("Non è stato possibile registrare la visita."); } finally { setSaving(false); }
  }

  return <section className="clients-page">
    <header className="dashboard-page-header"><div><span>Clienti</span><h2>Anagrafica</h2><p>Registrazioni online e visite effettuate direttamente in salone.</p></div><button className="btn" type="button" onClick={() => setShowCreate((value) => !value)}><AppIcon name="users" size={17} /> Nuovo cliente</button></header>
    {showCreate && <form className="client-editor" onSubmit={createClient}><header><span>Inserimento manuale</span><h3>Nuovo cliente</h3></header><div className="client-editor__grid"><label>Nome e cognome<input value={newClient.nome} onChange={(event) => setNewClient((value) => ({ ...value, nome: event.target.value }))} required /></label><label>Email<input type="email" value={newClient.email} onChange={(event) => setNewClient((value) => ({ ...value, email: event.target.value }))} /></label><label>Telefono<input value={newClient.telefono} onChange={(event) => setNewClient((value) => ({ ...value, telefono: event.target.value }))} /></label><label>Data di nascita<input type="date" value={newClient.dataNascita} onChange={(event) => setNewClient((value) => ({ ...value, dataNascita: event.target.value }))} /></label></div><div className="row"><button className="btn" disabled={saving}>Salva cliente</button><button className="btn btn--ghost" type="button" onClick={() => setShowCreate(false)}>Annulla</button></div></form>}
    <div className={`client-toolbar${segment === "custom" ? " has-custom-period" : ""}`}><label className="client-toolbar__search"><span>Cerca cliente</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, email o telefono" /></label><label><span>Ultima visita</span><select value={segment} onChange={(event) => setSegment(event.target.value as Segment)}><option value="tutti">Tutti i clienti</option><option value="30">Assenti da almeno 30 giorni</option><option value="60">Assenti da almeno 60 giorni</option><option value="90">Assenti da almeno 90 giorni</option><option value="custom">Periodo personalizzato</option></select></label>{segment === "custom" && <div className="client-toolbar__period"><label><span>Dal</span><input type="date" value={visitFrom} max={visitTo || undefined} onChange={(event) => setVisitFrom(event.target.value)} /></label><label><span>Al</span><input type="date" value={visitTo} min={visitFrom || undefined} onChange={(event) => setVisitTo(event.target.value)} /></label></div>}<label><span>Righe</span><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option value="20">20 per pagina</option><option value="50">50 per pagina</option><option value="100">100 per pagina</option></select></label></div>
    {(notice || error) && <p className={error ? "owner-home__error" : "loyalty-admin__message"} role={error ? "alert" : "status"}>{error ?? notice}</p>}
    <div className="client-workspace">
      {loading ? <div className="client-empty">Caricamento clienti…</div> : <div className="client-list-panel"><div className="client-list-panel__summary"><strong>{visible.length} clienti</strong><span>Pagina {currentPage} di {pageCount}</span></div><div className="client-table"><div className="client-table__head"><span>Cliente</span><span>Ultima visita</span><span>Attività</span><span>Valore</span><span>Origine</span></div>{pagedClients.map((client) => <button className={selected?.id === client.id ? "is-selected" : ""} type="button" key={client.id} onClick={() => void selectClient(client)}><div className="client-identity"><span>{client.nome.slice(0, 1)}</span><div><strong>{client.nome}</strong><small>{client.email || client.telefono || "Nessun contatto"}</small></div></div><div><strong>{formatDate(client.lastVisitDate ?? client.lastBookingDate)}</strong><small>{daysSince(client.lastVisitDate ?? client.lastBookingDate) === null ? "Nessuna visita" : `${daysSince(client.lastVisitDate ?? client.lastBookingDate)} giorni fa`}</small></div><div><strong>{client.bookingCount + (client.visitCount ?? 0)}</strong><small>{client.bookingCount} prenotazioni</small></div><div><strong>€ {formatEuro(client.totalSpent)}</strong><small>valore rilevato</small></div><div className="client-channels"><AppIcon name={client.source === "manual" ? "building" : "profile"} size={17} /><span>{client.source === "manual" ? "Salone" : "App"}</span></div></button>)}{visible.length === 0 && <div className="client-empty">Nessun cliente corrisponde ai filtri.</div>}</div>{visible.length > 0 && <nav className="client-pagination" aria-label="Paginazione clienti"><span>{(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visible.length)} di {visible.length}</span><div><button className="btn btn--ghost" type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Precedente</button><button className="btn btn--ghost" type="button" disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Successiva</button></div></nav>}</div>}
      {selected && <button className="client-detail__backdrop" type="button" aria-label="Chiudi scheda cliente" onClick={() => setSelected(null)} />}
      <aside className={`client-detail${selected ? " is-open" : ""}`}>{!selected ? <div className="client-detail__empty"><AppIcon name="users" size={34} /><strong>Seleziona un cliente</strong><p>Da qui puoi correggere l’anagrafica o registrare una visita senza prenotazione.</p></div> : <><header><span>{selected.source === "manual" ? "Cliente inserito in salone" : "Cliente registrato nell’app"}</span><h3>{selected.nome}</h3><button type="button" aria-label="Chiudi scheda cliente" onClick={() => setSelected(null)}>×</button></header>{selected.source === "manual" && <form className="client-detail__form" onSubmit={saveManualClient}><label>Nome<input value={selected.nome} onChange={(event) => setSelected((value) => value ? ({ ...value, nome: event.target.value }) : value)} /></label><label>Email<input value={selected.email} onChange={(event) => setSelected((value) => value ? ({ ...value, email: event.target.value }) : value)} /></label><button className="btn btn--ghost" disabled={saving}>Aggiorna anagrafica</button></form>}<form className="client-visit-form" onSubmit={saveVisit}><span>Registra passaggio in salone</span><h3>Servizio effettuato</h3><label>Servizio<select value={visit.serviceId} onChange={(event) => { const service = services.find((item) => item.id === event.target.value); setVisit((value) => ({ ...value, serviceId: event.target.value, importo: service ? (service.prezzo / 100).toFixed(2) : value.importo })); }} required><option value="">Seleziona servizio</option>{services.map((service) => <option value={service.id} key={service.id}>{service.titolo}</option>)}</select></label><div><label>Data<input type="date" value={visit.date} onChange={(event) => setVisit((value) => ({ ...value, date: event.target.value }))} required /></label><label>Importo (€)<input inputMode="decimal" value={visit.importo} onChange={(event) => setVisit((value) => ({ ...value, importo: event.target.value }))} required /></label></div><label>Nota<input value={visit.note} onChange={(event) => setVisit((value) => ({ ...value, note: event.target.value }))} placeholder="Opzionale" /></label><button className="btn" disabled={saving || !visit.serviceId}>Conferma visita</button></form><section className="client-history"><header><div><span>Storico cliente</span><h3>Attività e acquisti</h3></div></header><div className="client-history__filters"><select aria-label="Tipo attività" value={historyType} onChange={(event) => setHistoryType(event.target.value as "tutti" | ClientHistoryKind)}><option value="tutti">Tutte le attività</option><option value="prenotazione">Prenotazioni</option><option value="acquisto">Acquisti</option><option value="ordine">Ordini</option><option value="visita">Visite manuali</option><option value="coupon">Coupon</option><option value="fidelity">Fidelity</option></select><select aria-label="Periodo storico" value={historyPeriod} onChange={(event) => setHistoryPeriod(event.target.value as "30" | "90" | "all" | "custom")}><option value="all">Tutto lo storico</option><option value="30">Ultimi 30 giorni</option><option value="90">Ultimi 90 giorni</option><option value="custom">Periodo personalizzato</option></select>{historyPeriod === "custom" && <div className="client-history__custom"><label>Dal<input type="date" value={historyFrom} max={historyTo || undefined} onChange={(event) => setHistoryFrom(event.target.value)} /></label><label>Al<input type="date" value={historyTo} min={historyFrom || undefined} onChange={(event) => setHistoryTo(event.target.value)} /></label></div>}</div>{historyLoading ? <p>Caricamento storico…</p> : <div className="client-history__timeline">{filteredHistory.map((entry) => <article key={entry.id}><span className={`is-${entry.kind}`}><AppIcon name={entry.kind === "ordine" || entry.kind === "acquisto" ? "bag" : entry.kind === "coupon" || entry.kind === "fidelity" ? "gift" : "calendar"} size={16} /></span><div><time>{formatDate(entry.date || null)}</time><strong>{entry.title}</strong><small>{entry.detail}{entry.operatorId ? ` · ${operators.find((operator) => operator.id === entry.operatorId)?.nome ?? "Operatore"}` : ""}{entry.couponCode ? ` · ${entry.couponCode}` : ""}</small></div><div>{entry.amount !== undefined && <b>€ {formatEuro(entry.amount)}</b>}{entry.points !== undefined && <small className={entry.points < 0 ? "is-down" : "is-up"}>{entry.points > 0 ? "+" : ""}{entry.points} punti</small>}</div></article>)}{filteredHistory.length === 0 && <p>Nessuna attività per i filtri selezionati.</p>}</div>}</section></>}</aside>
    </div>
  </section>;
}
