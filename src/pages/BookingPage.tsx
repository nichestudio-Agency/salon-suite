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
import {
  cancelWaitlist,
  joinWaitlist,
  listMyWaitlist,
  type WaitlistEntryWithId,
} from "../firebase/waitlist-repo";
import { useSalonTenant } from "../app/salon-tenant-context";
import { getSalonExperience } from "../app/salon-experience";
import "./customer.css";

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function BookingPage() {
  const { salon } = useSalonTenant();
  const experience = getSalonExperience(salon?.tipo, salon?.branding);
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntryWithId[]>([]);
  const salonId = salon?.id ?? "";
  const [serviceId, setServiceId] = useState("");
  const [extraServiceIds, setExtraServiceIds] = useState<string[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [date, setDate] = useState("");
  const [starts, setStarts] = useState<number[] | null>(null);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!salonId) return () => { active = false; };
    void Promise.all([listServices(salonId), listOperators(salonId), listMyBookings(salonId), listMyWaitlist(salonId)])
      .then(([nextServices, nextOperators, nextBookings, nextWaitlist]) => {
        if (!active) return;
        setServices(nextServices.filter((service) => service.attivo));
        setOperators(nextOperators.filter((operator) => operator.attivo));
        setBookings(nextBookings);
        setWaitlist(nextWaitlist);
      })
      .catch(() => { if (active) setError("Non è stato possibile caricare il salone."); });
    return () => {
      active = false;
    };
  }, [salonId]);

  const selectedServiceIds = serviceId ? [serviceId, ...extraServiceIds] : [];
  const selectedServices = selectedServiceIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is ServiceWithId => Boolean(service));
  const totalDuration = selectedServices.reduce((sum, service) => sum + service.durataMin, 0);
  const totalPrice = selectedServices.reduce((sum, service) => sum + service.prezzo, 0);

  function advancedBookingFields() {
    return {
      ...(selectedServiceIds.length > 1 ? { serviceIds: selectedServiceIds } : {}),
      ...(recurrenceCount > 1 ? { recurrenceCount } : {}),
    };
  }

  async function searchAvailability(event?: FormEvent) {
    event?.preventDefault();
    if (!salonId || !serviceId || !operatorId || !date) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setSelectedStart(null);
    try {
      const result = await getAvailability({ salonId, serviceId, operatorId, date, ...advancedBookingFields() });
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
        const result = await getAvailability({ salonId, serviceId, operatorId, date, ...advancedBookingFields() });
        setStarts(result.starts);
      }
    } catch {
      setError("Non è stato possibile annullare la prenotazione.");
    }
  }

  function serviceName(id: string): string {
    return services.find((service) => service.id === id)?.titolo ?? "Servizio";
  }

  function bookingServiceName(booking: BookingWithId): string {
    if (booking.serviceItems?.length) return booking.serviceItems.map((item) => item.titolo).join(" + ");
    if (booking.serviceIds?.length) return booking.serviceIds.map(serviceName).join(" + ");
    return serviceName(booking.serviceId);
  }

  function operatorName(id: string): string {
    return operators.find((operator) => operator.id === id)?.nome ?? "Operatore";
  }

  async function confirmBooking() {
    if (selectedStart === null) return;
    setLoading(true);
    setError(null);
    try {
      const created = await createBooking({
        salonId,
        serviceId,
        operatorId,
        date,
        startMin: selectedStart,
        ...advancedBookingFields(),
        ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
      });
      setMessage(created.sconto > 0
        ? `Richiesta inviata. Coupon applicato: risparmi € ${(created.sconto / 100).toFixed(2)}.`
        : recurrenceCount > 1
          ? `Serie di ${created.occurrenceCount ?? recurrenceCount} appuntamenti inviata. Il salone deve ancora confermarla.`
          : "Richiesta inviata. Il salone deve ancora confermarla.");
      setSelectedStart(null);
      const result = await getAvailability({ salonId, serviceId, operatorId, date, ...advancedBookingFields() });
      setStarts(result.starts);
      setBookings(await listMyBookings(salonId));
    } catch {
      setError("Lo slot non è più disponibile. Cerca nuovamente gli orari.");
    } finally {
      setLoading(false);
    }
  }

  async function enterWaitlist() {
    if (!salonId || !serviceId || !operatorId || !date) return;
    setLoading(true);
    setError(null);
    try {
      await joinWaitlist({ salonId, serviceId, operatorId, date, ...(selectedServiceIds.length > 1 ? { serviceIds: selectedServiceIds } : {}) });
      setWaitlist(await listMyWaitlist(salonId));
      setMessage("Sei in lista d'attesa. Ti avviseremo appena si libera un posto.");
    } catch {
      setError("Non è stato possibile aggiungerti alla lista d'attesa.");
    } finally {
      setLoading(false);
    }
  }

  async function leaveWaitlist(entryId: string) {
    setError(null);
    try {
      await cancelWaitlist(salonId, entryId);
      setWaitlist(await listMyWaitlist(salonId));
    } catch {
      setError("Non è stato possibile annullare l'avviso.");
    }
  }

  return (
    <section className="customer-page customer-page--booking">
      <div className="booking-hero">
        <img src={experience.images.treatment} alt={experience.featureAlt} />
        <div className="booking-hero__copy">
          <span className="customer-shell__eyebrow">Prenotazione online</span>
          <h1>Prenota / ora</h1>
          <p>{salon?.nome ? `${salon.nome} · ` : ""}{experience.bookingDescription}</p>
        </div>
      </div>

      <div className="booking-progress" aria-label="Avanzamento prenotazione">
        <span className={serviceId ? "is-complete" : "is-active"}><b>1</b> Servizio</span>
        <span className={operatorId ? "is-complete" : serviceId ? "is-active" : ""}><b>2</b> {experience.professional}</span>
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
                setExtraServiceIds((current) => current.filter((id) => id !== event.target.value));
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

          {serviceId && services.length > 1 && (
            <fieldset className="booking-addons">
              <legend>Aggiungi altri servizi (opzionale)</legend>
              {services.filter((service) => service.id !== serviceId).map((service) => (
                <label key={service.id}>
                  <input
                    type="checkbox"
                    checked={extraServiceIds.includes(service.id)}
                    disabled={!extraServiceIds.includes(service.id) && selectedServiceIds.length >= 5}
                    onChange={(event) => {
                      setExtraServiceIds((current) => event.target.checked
                        ? [...current, service.id]
                        : current.filter((id) => id !== service.id));
                      setStarts(null);
                    }}
                  />
                  <span>{service.titolo}</span>
                  <small>{service.durataMin} min · € {(service.prezzo / 100).toFixed(2)}</small>
                </label>
              ))}
            </fieldset>
          )}

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
            <label htmlFor="booking-recurrence">Frequenza</label>
            <select
              id="booking-recurrence"
              value={recurrenceCount}
              onChange={(event) => { setRecurrenceCount(Number(event.target.value)); setStarts(null); }}
            >
              <option value={1}>Una volta</option>
              <option value={4}>Ogni settimana · 4 appuntamenti</option>
              <option value={8}>Ogni settimana · 8 appuntamenti</option>
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
          <div className="booking-field">
            <label htmlFor="booking-coupon">Coupon (opzionale)</label>
            <input id="booking-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Es. OGGI20" autoComplete="off" />
          </div>
        </div>

        {selectedServices.length > 0 && (
          <div className="booking-summary" aria-label="Riepilogo servizi">
            <span>{selectedServices.map((service) => service.titolo).join(" + ")}</span>
            <strong>{totalDuration} min · € {(totalPrice / 100).toFixed(2)}{recurrenceCount > 1 ? ` × ${recurrenceCount}` : ""}</strong>
          </div>
        )}

        <div className="booking-actions">
          <button className="customer-button" type="submit" disabled={loading}>
            {loading ? "Caricamento…" : "Cerca orari"}
          </button>
        </div>

        {starts && (
          <section aria-label="Orari disponibili">
            <h2>Orari disponibili</h2>
            {starts.length === 0 ? (
              <div className="booking-empty">
                <p>Nessun orario disponibile {recurrenceCount > 1 ? "in tutte le date della serie" : "per questa data"}.</p>
                {recurrenceCount === 1 && (
                  <button className="customer-button customer-button--secondary" type="button" disabled={loading} onClick={() => void enterWaitlist()}>
                    Entra in lista d'attesa
                  </button>
                )}
              </div>
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
                  <strong>{bookingServiceName(booking)} con {operatorName(booking.operatorId)}</strong>
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

      {salonId && waitlist.length > 0 && (
        <section className="booking-panel customer-bookings">
          <h2>I miei avvisi disponibilità</h2>
          {waitlist.map((entry) => (
            <article className="customer-booking" key={entry.id}>
              <div>
                <strong>{entry.serviceItems.map((item) => item.titolo).join(" + ")} con {operatorName(entry.operatorId)}</strong>
                <div className="customer-booking__meta">{entry.date} · In lista d'attesa</div>
              </div>
              <button className="customer-button customer-button--secondary" type="button" onClick={() => void leaveWaitlist(entry.id)}>Annulla avviso</button>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
