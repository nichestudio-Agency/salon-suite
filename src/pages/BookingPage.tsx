import { useEffect, useState, type FormEvent } from "react";
import {
  cancelBooking,
  createBooking,
  getAvailability,
  listMyBookings,
  type BookingWithId,
} from "../firebase/booking";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import { useSalonTenant } from "../app/salon-tenant-context";
import barberEditorial from "../assets/barber-editorial.webp";
import "./customer.css";

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function BookingPage() {
  const { salon } = useSalonTenant();
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const salonId = salon?.id ?? "";
  const [serviceId, setServiceId] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [date, setDate] = useState("");
  const [starts, setStarts] = useState<number[] | null>(null);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!salonId) return () => { active = false; };
    void Promise.all([listServices(salonId), listOperators(salonId), listMyBookings(salonId)])
      .then(([nextServices, nextOperators, nextBookings]) => {
        if (!active) return;
        setServices(nextServices.filter((service) => service.attivo));
        setOperators(nextOperators.filter((operator) => operator.attivo));
        setBookings(nextBookings);
      })
      .catch(() => { if (active) setError("Non è stato possibile caricare il salone."); });
    return () => {
      active = false;
    };
  }, [salonId]);

  async function searchAvailability(event?: FormEvent) {
    event?.preventDefault();
    if (!salonId || !serviceId || !operatorId || !date) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setSelectedStart(null);
    try {
      const result = await getAvailability({ salonId, serviceId, operatorId, date });
      setStarts(result.starts);
      setBookings(await listMyBookings(salonId));
    } catch {
      setStarts(null);
      setError("Non è stato possibile calcolare gli orari disponibili.");
    } finally {
      setLoading(false);
    }
  }

  async function cancel(id: string) {
    setError(null);
    try {
      await cancelBooking(salonId, id);
      setBookings(await listMyBookings(salonId));
      if (serviceId && operatorId && date) {
        const result = await getAvailability({ salonId, serviceId, operatorId, date });
        setStarts(result.starts);
      }
    } catch {
      setError("Non è stato possibile annullare la prenotazione.");
    }
  }

  function serviceName(id: string): string {
    return services.find((service) => service.id === id)?.titolo ?? "Servizio";
  }

  function operatorName(id: string): string {
    return operators.find((operator) => operator.id === id)?.nome ?? "Operatore";
  }

  async function confirmBooking() {
    if (selectedStart === null) return;
    setLoading(true);
    setError(null);
    try {
      await createBooking({
        salonId,
        serviceId,
        operatorId,
        date,
        startMin: selectedStart,
      });
      setMessage("Richiesta inviata. Il salone deve ancora confermarla.");
      setSelectedStart(null);
      const result = await getAvailability({ salonId, serviceId, operatorId, date });
      setStarts(result.starts);
      setBookings(await listMyBookings(salonId));
    } catch {
      setError("Lo slot non è più disponibile. Cerca nuovamente gli orari.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="customer-page customer-page--booking">
      <div className="booking-hero">
        <img src={barberEditorial} alt="" />
        <div className="booking-hero__copy">
          <span className="customer-shell__eyebrow">Prenotazione online</span>
          <h1>Scegli il tuo prossimo appuntamento</h1>
          <p>{salon?.nome ? `${salon.nome} · ` : ""}Taglio, barba e styling su misura, quando vuoi tu.</p>
        </div>
      </div>

      <div className="booking-progress" aria-label="Avanzamento prenotazione">
        <span className={serviceId ? "is-complete" : "is-active"}><b>1</b> Servizio</span>
        <span className={operatorId ? "is-complete" : serviceId ? "is-active" : ""}><b>2</b> Barber</span>
        <span className={date ? "is-active" : ""}><b>3</b> Orario</span>
      </div>

      <form className="booking-panel" onSubmit={searchAvailability}>
        <div className="booking-section-heading"><span>Configura</span><h2>Scegli il tuo appuntamento</h2></div>
        <div className="booking-grid">
          <div className="booking-field">
            <label htmlFor="booking-service">Servizio</label>
            <select
              id="booking-service"
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value);
                setStarts(null);
              }}
              disabled={!salonId}
              required
            >
              <option value="">Seleziona un servizio</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.titolo} · {service.durataMin} min · € {(service.prezzo / 100).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="booking-field">
            <label htmlFor="booking-operator">Operatore</label>
            <select
              id="booking-operator"
              value={operatorId}
              onChange={(event) => {
                setOperatorId(event.target.value);
                setStarts(null);
              }}
              disabled={!salonId}
              required
            >
              <option value="">Seleziona un operatore</option>
              {operators.map((operator) => (
                <option key={operator.id} value={operator.id}>{operator.nome}</option>
              ))}
            </select>
          </div>

          <div className="booking-field">
            <label htmlFor="booking-date">Data</label>
            <input
              id="booking-date"
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setStarts(null);
              }}
              required
            />
          </div>
        </div>

        <div className="booking-actions">
          <button className="customer-button" type="submit" disabled={loading}>
            {loading ? "Caricamento…" : "Cerca orari"}
          </button>
        </div>

        {starts && (
          <section aria-label="Orari disponibili">
            <h2>Orari disponibili</h2>
            {starts.length === 0 ? (
              <p>Nessun orario disponibile per questa data.</p>
            ) : (
              <div className="booking-slots">
                {starts.map((start) => (
                  <button
                    className="booking-slot"
                    type="button"
                    key={start}
                    aria-pressed={selectedStart === start}
                    onClick={() => setSelectedStart(start)}
                  >
                    {formatTime(start)}
                  </button>
                ))}
              </div>
            )}
            {selectedStart !== null && (
              <button
                className="customer-button"
                type="button"
                disabled={loading}
                onClick={confirmBooking}
              >
                Conferma prenotazione alle {formatTime(selectedStart)}
              </button>
            )}
          </section>
        )}

        {message && <p className="customer-feedback" role="status">{message}</p>}
        {error && <p className="customer-error" role="alert">{error}</p>}
      </form>

      {salonId && (
        <section className="booking-panel customer-bookings">
          <h2>Le mie prenotazioni in questo salone</h2>
          {bookings.length === 0 ? (
            <p>Non hai ancora prenotazioni.</p>
          ) : (
            bookings.map((booking) => (
              <article className="customer-booking" key={booking.id}>
                <div>
                  <strong>{serviceName(booking.serviceId)} con {operatorName(booking.operatorId)}</strong>
                  <div className="customer-booking__meta">
                    {booking.date} · {formatTime(booking.startMin)}–{formatTime(booking.endMin)} · {booking.stato.replace("_", " ")}
                  </div>
                </div>
                {["in_attesa", "confermata"].includes(booking.stato) && (
                  <button
                    className="customer-button customer-button--secondary"
                    type="button"
                    onClick={() => void cancel(booking.id)}
                  >
                    Annulla
                  </button>
                )}
              </article>
            ))
          )}
        </section>
      )}
    </section>
  );
}
