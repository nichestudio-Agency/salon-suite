import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { WeeklyHoursEditor } from "../components/WeeklyHoursEditor";
import { DashboardFilePicker } from "../components/DashboardFilePicker";
import type { WeeklyHours } from "../domain/availability";
import type { OperatorUnavailability } from "../domain/models";
import { formatEuro } from "../domain/money";
import { getSalon } from "../firebase/salon-repo";
import { listOperatorStats, type OperatorStats } from "../firebase/sales-repo";
import {
  createOperator,
  deleteOperator,
  listOperators,
  resetOperatorHours,
  updateOperator,
  uploadOperatorPhoto,
  type OperatorWithId,
} from "../firebase/operator-repo";

function PerformanceMix({ title, empty, rows }: { title: string; empty: string; rows: Array<{ id: string; label: string; quantity: number; revenue: number }> }) {
  const max = Math.max(...rows.map((row) => row.quantity), 1);
  return <section><header><strong>{title}</strong><span>{rows.reduce((sum, row) => sum + row.quantity, 0)} totali</span></header>{rows.slice(0, 4).map((row) => <article key={row.id}><div><strong>{row.label}</strong><span>{row.quantity} · € {formatEuro(row.revenue)}</span></div><i><b style={{ width: `${Math.max(8, row.quantity / max * 100)}%` }} /></i></article>)}{rows.length === 0 && <p>{empty}</p>}</section>;
}

export function OperatorsPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<OperatorWithId[]>([]);
  const [nome, setNome] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [openHours, setOpenHours] = useState<string | null>(null);
  const [openAvailability, setOpenAvailability] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [unavailableFrom, setUnavailableFrom] = useState("");
  const [unavailableTo, setUnavailableTo] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [storeHours, setStoreHours] = useState<WeeklyHours>({});
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<OperatorStats[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<"7" | "30" | "90" | "all" | "custom">("30");
  const [customFrom, setCustomFrom] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 29); return date.toISOString().slice(0, 10); });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));

  function periodStart(period = statsPeriod) {
    if (period === "custom") return customFrom;
    if (period === "all") return undefined;
    const date = new Date();
    date.setDate(date.getDate() - Number(period) + 1);
    return date.toISOString().slice(0, 10);
  }

  async function reload(id: string, period = statsPeriod) {
    const [operators, operatorStats] = await Promise.all([
      listOperators(id),
      listOperatorStats(id, periodStart(period), period === "custom" ? customTo : undefined).catch(() => []),
    ]);
    setItems(operators);
    setStats(operatorStats);
  }

  useEffect(() => {
    if (salonId) {
      void reload(salonId);
      void getSalon(salonId).then((salon) => setStoreHours(salon?.orariApertura ?? {})).catch(() => setStoreHours({}));
    }
  }, [salonId]);

  async function changeStatsPeriod(period: "7" | "30" | "90" | "all" | "custom") {
    setStatsPeriod(period);
    if (salonId) await reload(salonId, period);
  }

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!salonId) return;

    setBusy(true);
    try {
      const id = await createOperator(salonId, { nome, attivo: true });
      if (newPhoto) {
        const photo = await uploadOperatorPhoto(salonId, id, newPhoto, newPhoto.name);
        await updateOperator(salonId, id, photo);
      }
      setNome("");
      setNewPhoto(null);
      await reload(salonId);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(operator: OperatorWithId) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, { attivo: !operator.attivo });
    await reload(salonId);
  }

  function openUnavailability(operatorId: string) {
    const today = new Date().toISOString().slice(0, 10);
    setOpenAvailability(openAvailability === operatorId ? null : operatorId);
    setUnavailableFrom(today);
    setUnavailableTo(today);
    setUnavailableReason("");
  }

  async function addUnavailability(event: FormEvent, operator: OperatorWithId) {
    event.preventDefault();
    if (!salonId || !unavailableFrom || !unavailableTo || unavailableTo < unavailableFrom) return;
    const period: OperatorUnavailability = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dal: unavailableFrom,
      al: unavailableTo,
      ...(unavailableReason.trim() ? { motivo: unavailableReason.trim() } : {}),
    };
    await updateOperator(salonId, operator.id, {
      indisponibilita: [...(operator.indisponibilita ?? []), period],
    });
    setOpenAvailability(null);
    await reload(salonId);
  }

  async function removeUnavailability(operator: OperatorWithId, periodId: string) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, {
      indisponibilita: (operator.indisponibilita ?? []).filter((period) => period.id !== periodId),
    });
    await reload(salonId);
  }

  async function saveHours(operator: OperatorWithId, hours: WeeklyHours) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, {
      orariPersonalizzati: hours,
    });
    await reload(salonId);
  }

  async function resetToStoreHours(operator: OperatorWithId) {
    if (!salonId) return;
    await resetOperatorHours(salonId, operator.id);
    await reload(salonId);
  }

  async function updatePhoto(operator: OperatorWithId, file: File | undefined) {
    if (!salonId || !file) return;
    const photo = await uploadOperatorPhoto(salonId, operator.id, file, file.name);
    await updateOperator(salonId, operator.id, photo);
    await reload(salonId);
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteOperator(salonId, id);
    setSelectedId(null);
    await reload(salonId);
  }

  const selectedOperator = items.find((operator) => operator.id === selectedId) ?? null;
  const selectedStats = selectedOperator ? stats.find((item) => item.operatorId === selectedOperator.id) : null;
  const statsFor = (operatorId: string) => stats.find((item) => item.operatorId === operatorId);
  const maxDaily = (operatorId: string) => Math.max(...(statsFor(operatorId)?.dailyBookings.map((item) => item.count) ?? [1]), 1);

  return (
    <section>
      <div className="dashboard-page-header"><div><span>Team</span><h2>Operatori</h2><p>Disponibilità, clienti serviti e contributo commerciale.</p></div><div className="operator-period"><label><span>Periodo statistiche</span><select value={statsPeriod} onChange={(event) => void changeStatsPeriod(event.target.value as "7" | "30" | "90" | "all" | "custom")}><option value="7">Ultimi 7 giorni</option><option value="30">Ultimi 30 giorni</option><option value="90">Ultimi 90 giorni</option><option value="all">Tutto il periodo</option><option value="custom">Intervallo personalizzato</option></select></label>{statsPeriod === "custom" && <div className="operator-period__custom"><input aria-label="Statistiche dal" type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /><input aria-label="Statistiche al" type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} /><button type="button" onClick={() => salonId && void reload(salonId, "custom")}>Applica</button></div>}</div></div>
      <div className="operator-card-grid">{items.map((operator) => (
        <article className={`entity-card operator-profile-card ${operator.attivo ? "" : "is-inactive"}`} key={operator.id}>
          <div className="entity-card__media operator-profile-card__media">
            {operator.fotoUrl ? <img src={operator.fotoUrl} alt={`Foto di ${operator.nome}`} /> : <div className="operator-profile-card__placeholder">{operator.nome.slice(0, 1)}</div>}
            <span className={`operator-profile-card__status ${operator.attivo ? "is-active" : ""}`}>{operator.attivo ? "Disponibile" : "Non disponibile"}</span>
          </div>
          <div className="entity-card__body">
            <span>Operatore</span><h3>{operator.nome}</h3>
            <p>{(operator.indisponibilita?.length ?? 0) > 0 ? `${operator.indisponibilita!.length} periodi di indisponibilità programmati` : "Nessuna assenza programmata"}</p>
            <div className="operator-profile-card__metrics"><div><strong>{statsFor(operator.id)?.servedCount ?? 0}</strong><span>Clienti serviti</span></div><div><strong>€ {formatEuro(statsFor(operator.id)?.serviceRevenue ?? 0)}</strong><span>Fatturato</span></div><div><strong>€ {formatEuro(statsFor(operator.id)?.averageTicket ?? 0)}</strong><span>Ticket medio</span></div></div>
            <div className="operator-profile-card__trend"><div><span>Andamento 14 giorni</span><strong className={(statsFor(operator.id)?.recentTrend ?? 0) < 0 ? "is-down" : "is-up"}>{(statsFor(operator.id)?.recentTrend ?? 0) > 0 ? "+" : ""}{statsFor(operator.id)?.recentTrend ?? 0}%</strong></div><div className="operator-sparkline" aria-label="Prenotazioni giornaliere">{(statsFor(operator.id)?.dailyBookings ?? []).map((day) => <i title={`${day.date}: ${day.count}`} style={{ height: `${Math.max(8, day.count / maxDaily(operator.id) * 100)}%` }} key={day.date} />)}</div></div>
            <div className="operator-profile-card__actions">
              <button className="btn btn--ghost" type="button" onClick={() => { setSelectedId(operator.id); if (operator.attivo) openUnavailability(operator.id); else void toggleActive(operator); }}>{operator.attivo ? "Rendi indisponibile" : "Rendi disponibile"}</button>
              <button className="btn" type="button" onClick={() => { setSelectedId(operator.id); setOpenHours(operator.id); setOpenAvailability(null); }}>Gestisci orari</button>
            </div>
          </div>
        </article>
      ))}</div>

      {selectedOperator && <section className="operator-management-panel">
        <header><div><span>Gestione operatore</span><h3>{selectedOperator.nome}</h3><p>Orari, foto e indisponibilità sono raccolti qui senza deformare la card.</p></div><button type="button" aria-label="Chiudi gestione operatore" onClick={() => { setSelectedId(null); setOpenHours(null); setOpenAvailability(null); }}>×</button></header>
        <div className="operator-management-panel__toolbar">
          <label className="btn btn--ghost operator-photo-button">Aggiorna foto<input type="file" accept="image/*" aria-label={`Aggiorna foto di ${selectedOperator.nome}`} onChange={(event) => void updatePhoto(selectedOperator, event.target.files?.[0])} /></label>
          <button className="btn btn--ghost" type="button" onClick={() => openUnavailability(selectedOperator.id)}>Programma indisponibilità</button>
          <button className="btn btn--danger" type="button" onClick={() => void onDelete(selectedOperator.id)}>Elimina operatore</button>
        </div>
        <section className="operator-performance" aria-label={`Statistiche di ${selectedOperator.nome}`}>
          <header><span>Performance commerciale</span><strong>{statsPeriod === "all" ? "Intero periodo" : statsPeriod === "custom" ? `${customFrom} → ${customTo}` : `Ultimi ${statsPeriod} giorni`}</strong></header>
          <div className="operator-performance__grid">
            <article><span>Prenotazioni</span><strong>{selectedStats?.bookingCount ?? 0}</strong><small>{selectedStats?.noShowCount ?? 0} no-show</small></article>
            <article><span>Visite concluse</span><strong>{selectedStats?.servedCount ?? 0}</strong><small>{selectedStats?.uniqueClients ?? 0} clienti unici</small></article>
            <article><span>Nuovi acquisiti</span><strong>{selectedStats?.acquiredClients ?? 0}</strong><small>Prima vendita attribuita</small></article>
            <article><span>Fatturato servizi</span><strong>€ {formatEuro(selectedStats?.serviceRevenue ?? 0)}</strong><small>Vendite pagate</small></article>
            <article><span>Prodotti venduti</span><strong>{selectedStats?.productsSold ?? 0}</strong><small>€ {formatEuro(selectedStats?.productRevenue ?? 0)}</small></article>
            <article><span>Ticket medio</span><strong>€ {formatEuro(selectedStats?.averageTicket ?? 0)}</strong><small>Per visita conclusa</small></article>
            <article><span>Occupazione stimata</span><strong>{selectedStats?.occupancyRate ?? 0}%</strong><small>sulle ore lavorabili</small></article>
            <article><span>Annullamenti</span><strong>{selectedStats?.cancelledCount ?? 0}</strong><small>oltre a {selectedStats?.noShowCount ?? 0} no-show</small></article>
          </div>
          <div className="operator-performance__timeline"><div><strong>Ritmo prenotazioni</strong><span>Ultimi 14 giorni · confronto tra le due settimane</span></div><b className={(selectedStats?.recentTrend ?? 0) < 0 ? "is-down" : "is-up"}>{(selectedStats?.recentTrend ?? 0) > 0 ? "+" : ""}{selectedStats?.recentTrend ?? 0}%</b><div className="operator-performance__bars">{(selectedStats?.dailyBookings ?? []).map((day) => <span key={day.date}><i style={{ height: `${Math.max(6, day.count / Math.max(...(selectedStats?.dailyBookings.map((item) => item.count) ?? [1]), 1) * 100)}%` }} /><small>{new Intl.DateTimeFormat("it-IT", { weekday: "narrow" }).format(new Date(`${day.date}T12:00:00`))}</small></span>)}</div></div>
          <div className="operator-performance__mix"><PerformanceMix title="Servizi eseguiti" empty="Nessun servizio attribuito" rows={selectedStats?.topServices ?? []} /><PerformanceMix title="Prodotti venduti" empty="Nessun prodotto attribuito" rows={selectedStats?.topProducts ?? []} /></div>
        </section>
        {(selectedOperator.indisponibilita?.length ?? 0) > 0 && <div className="operator-unavailability-list">{selectedOperator.indisponibilita!.map((period) => <div key={period.id}><span><strong>{period.dal === period.al ? period.dal : `${period.dal} → ${period.al}`}</strong>{period.motivo && ` · ${period.motivo}`}</span><button className="btn btn--ghost" type="button" onClick={() => void removeUnavailability(selectedOperator, period.id)}>Rendi disponibile</button></div>)}</div>}
        {openAvailability === selectedOperator.id && <form className="operator-unavailability-panel" onSubmit={(event) => void addUnavailability(event, selectedOperator)}><div><span>Programma indisponibilità</span><h3>Scegli il periodo</h3></div><div className="operator-unavailability-fields"><div className="field"><label htmlFor={`from-${selectedOperator.id}`}>Dal</label><input id={`from-${selectedOperator.id}`} type="date" value={unavailableFrom} onChange={(event) => { setUnavailableFrom(event.target.value); if (!unavailableTo || event.target.value > unavailableTo) setUnavailableTo(event.target.value); }} required /></div><div className="field"><label htmlFor={`to-${selectedOperator.id}`}>Al</label><input id={`to-${selectedOperator.id}`} type="date" min={unavailableFrom} value={unavailableTo} onChange={(event) => setUnavailableTo(event.target.value)} required /></div><div className="field"><label htmlFor={`reason-${selectedOperator.id}`}>Motivo (opzionale)</label><input id={`reason-${selectedOperator.id}`} value={unavailableReason} onChange={(event) => setUnavailableReason(event.target.value)} placeholder="Ferie, permesso…" /></div></div><div className="row"><button className="btn" type="submit">Programma periodo</button><button className="btn btn--ghost" type="button" onClick={() => setOpenAvailability(null)}>Annulla</button></div></form>}
        {openHours === selectedOperator.id && <div className="operator-hours-panel"><div className="operator-hours-panel__header"><p>{selectedOperator.orariPersonalizzati ? "Orari personalizzati attivi" : "Usa gli orari del punto vendita"}</p>{selectedOperator.orariPersonalizzati && <button className="btn btn--ghost" type="button" onClick={() => void resetToStoreHours(selectedOperator)}>Ripristina orari del punto vendita</button>}</div><WeeklyHoursEditor value={selectedOperator.orariPersonalizzati ?? storeHours} onChange={(hours) => void saveHours(selectedOperator, hours)} /></div>}
      </section>}

      <form className="entity-create" onSubmit={onAdd}>
        <h3>Nuovo operatore</h3>
        <div className="field">
          <label htmlFor="operator-name">Nome operatore</label>
          <input
            id="operator-name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            required
          />
        </div>
        <DashboardFilePicker id="operator-photo" label="Foto (opzionale)" file={newPhoto} onChange={setNewPhoto} />
        <button className="btn" type="submit" disabled={busy}>
          Aggiungi operatore
        </button>
      </form>
    </section>
  );
}
