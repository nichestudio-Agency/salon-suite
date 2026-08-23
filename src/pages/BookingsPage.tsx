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

  return (
    <section>
      <h2>Prenotazioni</h2>
      <p style={{ color: "var(--muted)", marginBottom: 18 }}>
        Le richieste in attesa bloccano già lo slot fino alla tua decisione.
      </p>
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {bookings.length === 0 ? (
        <div className="card">Nessuna prenotazione da mostrare.</div>
      ) : (
        bookings.map((booking) => (
          <article className="card" key={booking.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>{booking.clientNome ?? booking.clientId}</strong>
                <div>{serviceName(booking.serviceId)} con {operatorName(booking.operatorId)}</div>
                <div style={{ color: "var(--muted)" }}>
                  {booking.date} · {formatTime(booking.startMin)}–{formatTime(booking.endMin)} · {statusLabel(booking.stato)}
                </div>
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
