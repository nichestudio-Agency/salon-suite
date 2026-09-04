import { useEffect, useState } from "react";
import { useAuth } from "../app/auth-context";
import {
  listBookings,
  updateBookingStatus,
  type BookingWithId,
} from "../firebase/booking-repo";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function statusLabel(status: BookingWithId["stato"]): string {
  const labels = {
    in_attesa: "In attesa",
    confermata: "Confermata",
    rifiutata: "Rifiutata",
    annullata: "Annullata",
  };
  return labels[status];
}

function currentWeek() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: date.toISOString(),
      day: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).replace(".", ""),
      number: date.getDate(),
      isToday: date.toDateString() === today.toDateString(),
    };
  });
}

export function BookingsPage() {
  const { salonId } = useAuth();
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload(id: string) {
    const [nextBookings, nextServices, nextOperators] = await Promise.all([
      listBookings(id),
      listServices(id),
      listOperators(id),
    ]);
    setBookings(nextBookings);
    setServices(nextServices);
    setOperators(nextOperators);
  }

  useEffect(() => {
    if (!salonId) return;
    void reload(salonId).catch(() => {
      setError("Non è stato possibile caricare le prenotazioni.");
    });
  }, [salonId]);

  async function changeStatus(
    bookingId: string,
    status: "confermata" | "rifiutata",
  ) {
    if (!salonId) return;
    setError(null);
    try {
      await updateBookingStatus(salonId, bookingId, status);
      await reload(salonId);
    } catch {
      setError("Non è stato possibile aggiornare la richiesta.");
    }
  }

  function serviceName(id: string): string {
    return services.find((service) => service.id === id)?.titolo ?? "Servizio";
  }

  function operatorName(id: string): string {
    return operators.find((operator) => operator.id === id)?.nome ?? "Operatore";
  }

  const todayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
  const pendingCount = bookings.filter((booking) => booking.stato === "in_attesa").length;
  const confirmedCount = bookings.filter((booking) => booking.stato === "confermata").length;
  const week = currentWeek();

  return (
    <section>
      <header className="dashboard-page-header">
        <div><span>Agenda</span><h2>Agenda di oggi</h2><p>{todayLabel}</p></div>
        <div className="dashboard-alert" aria-label={`${pendingCount} richieste in attesa`}>{pendingCount}</div>
      </header>
      <div className="agenda-week" aria-label="Settimana corrente">
        {week.map((date) => <span className={date.isToday ? "is-today" : ""} key={date.key}><small>{date.day}</small><b>{date.number}</b></span>)}
      </div>
      <div className="agenda-metrics">
        <div><span>Appuntamenti</span><strong>{bookings.length}</strong></div>
        <div><span>Confermati</span><strong>{confirmedCount}</strong></div>
        <div><span>In attesa</span><strong>{pendingCount}</strong></div>
      </div>
      <p className="dashboard-helper">Le richieste in attesa bloccano già lo slot fino alla tua decisione.</p>
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {bookings.length === 0 ? (
        <div className="card">Nessuna prenotazione da mostrare.</div>
      ) : (
        bookings.map((booking) => (
          <article className={`card appointment-card appointment-card--${booking.stato}`} key={booking.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <span className="appointment-card__time">{formatTime(booking.startMin)}</span>
                <strong>{booking.clientNome ?? booking.clientId}</strong>
                <div>{serviceName(booking.serviceId)} con {operatorName(booking.operatorId)}</div>
                <div className="appointment-card__meta">{booking.date} · {formatTime(booking.startMin)}–{formatTime(booking.endMin)} <span>{statusLabel(booking.stato)}</span></div>
              </div>
              {booking.stato === "in_attesa" && (
                <div className="row">
                  <button
                    className="btn"
                    type="button"
                    onClick={() => void changeStatus(booking.id, "confermata")}
                  >
                    Conferma
                  </button>
                  <button
                    className="btn btn--danger"
                    type="button"
                    onClick={() => void changeStatus(booking.id, "rifiutata")}
                  >
                    Rifiuta
                  </button>
                </div>
              )}
            </div>
          </article>
        ))
      )}
    </section>
  );
}
