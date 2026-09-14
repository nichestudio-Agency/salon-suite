import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../app/auth-context";
import { AppIcon } from "../components/AppIcon";
import { listBookings, updateBookingStatus, type BookingWithId } from "../firebase/booking-repo";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { getSalon } from "../firebase/salon-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import type { Weekday, WeeklyHours } from "../domain/availability";
import { manageBookingOutcome } from "../firebase/sales-repo";

type AgendaView = "giorno" | "tre-giorni" | "settimana";
const WEEKDAY: Weekday[] = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];
const DEFAULT_WORKDAYS = new Set<Weekday>(["mar", "mer", "gio", "ven", "sab"]);
const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const shiftDate = (value: string, days: number) => { const date = parseDate(value); date.setDate(date.getDate() + days); return dateKey(date); };
const formatTime = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const statusLabel = (status: BookingWithId["stato"]) => ({ in_attesa: "In attesa", confermata: "Confermata", rifiutata: "Rifiutata", annullata: "Annullata", completata: "Completata", no_show: "No-show" })[status];
const initials = (value: string) => value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

const OPERATOR_TONES = [
  { background: "#dfe7dc", border: "#78906f", ink: "#2c3a2a" },
  { background: "#eee3d4", border: "#b48652", ink: "#493520" },
  { background: "#e5e2eb", border: "#81798f", ink: "#393444" },
  { background: "#e8dcd9", border: "#a66e63", ink: "#49302c" },
];

function isWorkingDay(value: string, hours: WeeklyHours) {
  const day = WEEKDAY[parseDate(value).getDay()];
  const configured = Object.values(hours).some((slots) => (slots?.length ?? 0) > 0);
  return configured ? (hours[day]?.length ?? 0) > 0 : DEFAULT_WORKDAYS.has(day);
}
function nextWorkingDay(value: string, direction: 1 | -1, hours: WeeklyHours) {
  let result = value;
  for (let index = 0; index < 8; index++) { result = shiftDate(result, direction); if (isWorkingDay(result, hours)) return result; }
  return result;
}
function weekDates(anchor: string, hours: WeeklyHours) {
  const date = parseDate(anchor);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => shiftDate(dateKey(date), index)).filter((value) => isWorkingDay(value, hours));
}

export function BookingsPage() {
  const { salonId } = useAuth();
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [hours, setHours] = useState<WeeklyHours>({});
  const [view, setView] = useState<AgendaView>("giorno");
  const [anchor, setAnchor] = useState(dateKey(new Date()));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [performedBy, setPerformedBy] = useState<Record<string, string>>({});

  async function reload(id: string) {
    const [nextBookings, nextServices, nextOperators, salon] = await Promise.all([listBookings(id), listServices(id), listOperators(id), getSalon(id).catch(() => null)]);
    setBookings(nextBookings); setServices(nextServices); setOperators(nextOperators); setHours(salon?.orariApertura ?? {}); setAnchor((current) => nextBookings.some((item) => item.date === current) || !nextBookings.length ? current : nextBookings[0].date);
  }
  useEffect(() => { if (salonId) void reload(salonId).catch(() => setError("Non è stato possibile caricare l’agenda.")); }, [salonId]);

  const visibleDates = useMemo(() => {
    if (view === "settimana") return weekDates(anchor, hours);
    if (view === "tre-giorni") { const result = [anchor]; while (result.length < 3) result.push(nextWorkingDay(result.at(-1)!, 1, hours)); return result; }
    return [anchor];
  }, [anchor, hours, view]);
  const dateStrip = useMemo(() => Array.from({ length: 11 }, (_, index) => shiftDate(anchor, index - 5)), [anchor]);
  const active = useMemo(() => bookings.filter((booking) => visibleDates.includes(booking.date) && !["annullata", "rifiutata"].includes(booking.stato)).sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin), [bookings, visibleDates]);
  const agendaOperators = useMemo(() => {
    const visibleOperatorIds = new Set(active.filter((booking) => booking.date === anchor).map((booking) => booking.operatorId));
    return operators.filter((operator) => operator.attivo || visibleOperatorIds.has(operator.id));
  }, [active, anchor, operators]);
  const dayColumns: OperatorWithId[] = agendaOperators.length ? agendaOperators : [{ id: "__empty", nome: "Nessun operatore", attivo: false }];
  const calendarColumnCount = view === "giorno" ? dayColumns.length : visibleDates.length;
  const dayBookings = active.filter((booking) => booking.date === anchor);
  const firstMinute = Math.min(8 * 60, ...active.map((booking) => booking.startMin));
  const lastMinute = Math.max(19 * 60, ...active.map((booking) => booking.endMin));
  const timelineStart = Math.floor(firstMinute / 60) * 60;
  const timelineEnd = Math.ceil(lastMinute / 60) * 60;
  const timelineHours = Array.from({ length: Math.max(1, (timelineEnd - timelineStart) / 60) + 1 }, (_, index) => timelineStart + index * 60);
  const serviceName = (id: string) => services.find((service) => service.id === id)?.titolo ?? "Servizio";
  const bookingServiceName = (booking: BookingWithId) => booking.serviceItems?.length
    ? booking.serviceItems.map((item) => item.titolo).join(" + ")
    : booking.serviceIds?.length ? booking.serviceIds.map(serviceName).join(" + ") : serviceName(booking.serviceId);
  const operatorName = (id: string) => operators.find((operator) => operator.id === id)?.nome ?? "Operatore";
  const operatorTone = (id: string) => {
    const index = Math.max(0, operators.findIndex((operator) => operator.id === id));
    const tone = OPERATOR_TONES[index % OPERATOR_TONES.length];
    return {
      "--agenda-event-bg": tone.background,
      "--agenda-event-border": tone.border,
      "--agenda-event-ink": tone.ink,
    } as CSSProperties;
  };
  const pendingCount = active.filter((booking) => booking.stato === "in_attesa").length;

  function move(direction: 1 | -1) {
    if (view === "settimana") setAnchor(shiftDate(anchor, direction * 7));
    else setAnchor(nextWorkingDay(anchor, direction, hours));
  }
  async function changeStatus(bookingId: string, status: "confermata" | "rifiutata") {
    if (!salonId) return; setError(null);
    try { await updateBookingStatus(salonId, bookingId, status); await reload(salonId); }
    catch { setError("Non è stato possibile aggiornare la richiesta."); }
  }
  async function closeBooking(booking: BookingWithId, outcome: "completata" | "no_show") {
    if (!salonId) return;
    setError(null); setNotice(null); setBusyBookingId(booking.id);
    try {
      const result = await manageBookingOutcome({
        salonId,
        bookingId: booking.id,
        outcome,
        ...(outcome === "completata" ? { performedByOperatorId: performedBy[booking.id] ?? booking.operatorId } : {}),
      });
      setNotice(outcome === "completata"
        ? result.puntiAccreditati > 0
          ? `Incasso registrato e ${result.puntiAccreditati} punti fidelity accreditati.`
          : "Incasso registrato correttamente."
        : "No-show registrato correttamente.");
      await reload(salonId);
    } catch {
      setError(outcome === "completata" ? "Non è stato possibile chiudere e contabilizzare l’appuntamento." : "Non è stato possibile registrare il no-show.");
    } finally { setBusyBookingId(null); }
  }

  return <section className="agenda-page">
    <header className="dashboard-page-header"><div><span>Agenda</span><h2>Calendario</h2><p>Giornata, carico e richieste in un’unica vista.</p></div><div className="agenda-day-summary"><div><strong>{dayBookings.length}</strong><span>Oggi in agenda</span></div><div><strong>{dayBookings.filter((item) => item.stato === "confermata").length}</strong><span>Confermati</span></div><div className={pendingCount ? "has-pending" : ""}><strong>{pendingCount}</strong><span>Da gestire</span></div></div></header>
    {notice && <p className="owner-home__notice" role="status">{notice}</p>}
    <div className="agenda-toolbar"><div className="agenda-view-switch" aria-label="Vista agenda">{(["giorno", "tre-giorni", "settimana"] as AgendaView[]).map((item) => <button className={view === item ? "is-active" : ""} type="button" onClick={() => setView(item)} key={item}>{item === "giorno" ? "Giorno" : item === "tre-giorni" ? "3 giorni" : "Settimana"}</button>)}</div><div className="agenda-date-nav"><button type="button" aria-label="Periodo precedente" onClick={() => move(-1)}>‹</button><input type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} /><button type="button" aria-label="Periodo successivo" onClick={() => move(1)}>›</button><button type="button" onClick={() => setAnchor(dateKey(new Date()))}>Oggi</button></div></div>
    <nav className="agenda-date-strip" aria-label="Seleziona il giorno">
      {dateStrip.map((date) => <button className={date === anchor ? "is-active" : ""} type="button" onClick={() => setAnchor(date)} key={date} aria-current={date === anchor ? "date" : undefined}><small>{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(parseDate(date))}</small><strong>{parseDate(date).getDate()}</strong></button>)}
    </nav>
    {error && <p className="owner-home__error" role="alert">{error}</p>}
    <div className={`agenda-workspace${view === "settimana" ? " is-week" : ""}`}>
      <div className={`agenda-calendar ${view === "giorno" ? "is-operator-view" : "is-date-view"}`} style={{ "--agenda-columns": calendarColumnCount } as CSSProperties}>
        <div className="agenda-calendar__head"><span>Ora</span>{view === "giorno" ? dayColumns.map((operator) => <div className="agenda-operator-head" aria-label={`Agenda di ${operator.nome}`} key={operator.id}>{operator.fotoUrl ? <img src={operator.fotoUrl} alt="" /> : <span aria-hidden="true">{initials(operator.nome) || "—"}</span>}<strong>{operator.nome}</strong><small>{dayBookings.filter((booking) => booking.operatorId === operator.id).length} appuntamenti</small></div>) : visibleDates.map((date) => <button className={date === anchor ? "is-active" : ""} type="button" onClick={() => setAnchor(date)} key={date}><small>{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(parseDate(date))}</small><strong>{parseDate(date).getDate()}</strong></button>)}</div>
        <div className="agenda-calendar__body" style={{ "--agenda-hours": timelineHours.length - 1 } as CSSProperties}>
          <div className="agenda-time-axis">{timelineHours.map((minute) => <time key={minute}>{formatTime(minute)}</time>)}</div>
          {(view === "giorno" ? dayColumns.map((operator) => ({ key: operator.id, bookings: active.filter((booking) => booking.date === anchor && booking.operatorId === operator.id), label: operator.nome })) : visibleDates.map((date) => ({ key: date, bookings: active.filter((booking) => booking.date === date), label: date }))).map((column) => <div className="agenda-day-column" aria-label={column.label} key={column.key}>{timelineHours.slice(0, -1).map((minute) => <span className="agenda-hour-line" key={minute} />)}{column.bookings.map((booking) => <article className={`agenda-event is-${booking.stato}`} style={{ top: `${((booking.startMin - timelineStart) / (timelineEnd - timelineStart)) * 100}%`, height: `${Math.max(5, ((booking.endMin - booking.startMin) / (timelineEnd - timelineStart)) * 100)}%`, ...operatorTone(booking.operatorId) }} key={booking.id}><time>{formatTime(booking.startMin)}–{formatTime(booking.endMin)}</time><strong>{booking.clientNome ?? "Cliente"}</strong><small>{bookingServiceName(booking)}{view !== "giorno" ? ` · ${operatorName(booking.operatorId)}` : ""}</small><span className="agenda-event__status">{statusLabel(booking.stato)}</span></article>)}</div>)}
        </div>
      </div>
      <aside className="agenda-list"><header><span>{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(parseDate(anchor))}</span><strong>{dayBookings.length} prenotazioni</strong></header><div>{dayBookings.map((booking) => <article className={`is-${booking.stato}`} key={booking.id}><div><time>{formatTime(booking.startMin)}</time><span>{formatTime(booking.endMin)}</span></div><section><strong>{booking.clientNome ?? "Cliente"}</strong><span>{bookingServiceName(booking)} con {operatorName(booking.operatorId)}</span><small>{statusLabel(booking.stato)}</small>{booking.stato === "in_attesa" && <footer><button type="button" onClick={() => void changeStatus(booking.id, "confermata")}>Conferma</button><button type="button" onClick={() => void changeStatus(booking.id, "rifiutata")}>Rifiuta</button></footer>}{booking.stato === "confermata" && <footer className="agenda-list__outcome"><label><span>Servizio eseguito da</span><select aria-label={`Operatore effettivo per ${booking.clientNome ?? "cliente"}`} value={performedBy[booking.id] ?? booking.operatorId} onChange={(event) => setPerformedBy((current) => ({ ...current, [booking.id]: event.target.value }))}>{operators.filter((operator) => operator.attivo || operator.id === booking.operatorId).map((operator) => <option value={operator.id} key={operator.id}>{operator.nome}</option>)}</select></label><div><button type="button" disabled={busyBookingId === booking.id} onClick={() => void closeBooking(booking, "completata")}>Completa e incassa</button><button type="button" disabled={busyBookingId === booking.id} onClick={() => void closeBooking(booking, "no_show")}>No-show</button></div></footer>}</section></article>)}{dayBookings.length === 0 && <div className="agenda-list__empty"><AppIcon name="calendar" size={28} /><strong>Giornata libera</strong><span>Nessun appuntamento per questa data.</span></div>}</div></aside>
    </div>
  </section>;
}
