import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
import { useSalonTenant } from "../app/salon-tenant-context";
import { cancelBooking, listMyBookings, type BookingWithId } from "../firebase/booking";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import type { BookingStatus } from "../domain/models";
import "./customer.css";

const STATUS: Record<BookingStatus, string> = {
  in_attesa: "Da confermare",
  confermata: "Confermata",
  rifiutata: "Non disponibile",
  annullata: "Annullata",
  completata: "Completata",
  no_show: "Non effettuata",
};

function timeLabel(minutes: number) {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00`));
}

export function CustomerAppointmentsPage() {
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const today = now.toLocaleDateString("sv-SE");
  const currentMinute = now.getHours() * 60 + now.getMinutes();

  async function reload() {
    if (!salonId) return;
    const [nextBookings, nextServices, nextOperators] = await Promise.all([
      listMyBookings(salonId), listServices(salonId), listOperators(salonId),
    ]);
    setBookings(nextBookings);
    setServices(nextServices);
    setOperators(nextOperators);
  }

  useEffect(() => {
    void reload().catch(() => setError("Non siamo riusciti a caricare gli appuntamenti.")).finally(() => setLoading(false));
  }, [salonId]);

  const upcoming = useMemo(() => bookings.filter((item) => (item.date > today || (item.date === today && item.endMin > currentMinute)) && !["annullata", "rifiutata", "completata", "no_show"].includes(item.stato)), [bookings, today, currentMinute]);
  const history = useMemo(() => bookings.filter((item) => !upcoming.includes(item)).reverse(), [bookings, upcoming]);
  const serviceName = (booking: BookingWithId) => booking.serviceItems?.map((item) => item.titolo).join(" + ") || services.find((item) => item.id === booking.serviceId)?.titolo || "Servizio";
  const operatorName = (id: string) => operators.find((item) => item.id === id)?.nome || "Professionista del salone";

  async function cancel(id: string) {
    if (!salonId) return;
    setError(null);
    try { await cancelBooking(salonId, id); await reload(); }
    catch { setError("Non è stato possibile annullare la prenotazione."); }
  }

  function bookingCard(item: BookingWithId) {
    return <article className="appointment-list-card" key={item.id}>
      <div className="appointment-list-card__date"><strong>{new Date(`${item.date}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date(`${item.date}T12:00:00`))}</span></div>
      <div className="appointment-list-card__body"><span className={`appointment-status is-${item.stato}`}>{STATUS[item.stato]}</span><h2>{serviceName(item)}</h2><p>{dateLabel(item.date)} · {timeLabel(item.startMin)}–{timeLabel(item.endMin)}</p><small>Con {operatorName(item.operatorId)}</small></div>
      {(item.date > today || (item.date === today && item.endMin > currentMinute)) && ["in_attesa", "confermata"].includes(item.stato) && <button type="button" onClick={() => void cancel(item.id)}>Annulla</button>}
    </article>;
  }

  return <section className="customer-page customer-appointments-page">
    <header className="customer-shell__header"><div><span className="customer-shell__eyebrow">La tua agenda</span><h1>Appuntamenti</h1><p>Controlla le prossime prenotazioni e ritrova lo storico delle visite.</p></div><Link className="customer-icon-button" to="/prenota" aria-label="Nuova prenotazione"><AppIcon name="plus" /></Link></header>
    {error && <p className="customer-error" role="alert">{error}</p>}
    {loading ? <div className="customer-list-skeleton"><span /><span /><span /></div> : <>
      <section className="customer-list-section"><header><span>In programma</span><strong>{upcoming.length}</strong></header>{upcoming.length ? upcoming.map(bookingCard) : <div className="customer-empty customer-empty--stacked"><AppIcon name="calendar" /><strong>Nessun appuntamento in programma</strong><p>Scegli il prossimo momento per te.</p><Link className="customer-button" to="/prenota">Prenota ora</Link></div>}</section>
      {history.length > 0 && <section className="customer-list-section"><header><span>Storico</span><strong>{history.length}</strong></header>{history.map(bookingCard)}</section>}
    </>}
  </section>;
}
