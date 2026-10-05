import { useEffect, useState, type FormEvent } from "react";
import {
  createBooking,
  getAvailability,
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
import { AppIcon } from "../components/AppIcon";
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
  const [waitlist, setWaitlist] = useState<WaitlistEntryWithId[]>([]);
  const salonId = salon?.id ?? "";
  const [serviceId, setServiceId] = useState("");
  const [extraServiceIds, setExtraServiceIds] = useState<string[]>([]);
  const [operatorId, setOperatorId] = useState("");
  const [date, setDate] = useState("");
  const [starts, setStarts] = useState<number[] | null>(null);
  const [occupiedStarts, setOccupiedStarts] = useState<number[]>([]);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [selectedWaitlistStart, setSelectedWaitlistStart] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [recurrenceCount, setRecurrenceCount] = useState(1);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!salonId) return () => { active = false; };
    void Promise.all([listServices(salonId), listOperators(salonId), listMyWaitlist(salonId)])
      .then(([nextServices, nextOperators, nextWaitlist]) => {
        if (!active) return;
        setServices(nextServices.filter((service) => service.attivo));
        setOperators(nextOperators.filter((operator) => operator.attivo));
        setWaitlist(nextWaitlist);
        const requestedService = new URLSearchParams(window.location.search).get("servizio");
        if (requestedService && nextServices.some((service) => service.id === requestedService && service.attivo)) {
          setServiceId(requestedService);
          setStep(2);
        }
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

  function resetAvailability() {
    setStarts(null);
    setOccupiedStarts([]);
    setSelectedStart(null);
    setSelectedWaitlistStart(null);
  }

  async function searchAvailability(event?: FormEvent) {
    event?.preventDefault();
    if (!salonId || !serviceId || !operatorId || !date) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    setSelectedStart(null);
    setSelectedWaitlistStart(null);
    try {
      const result = await getAvailability({ salonId, serviceId, operatorId, date, ...advancedBookingFields() });
      setStarts(result.starts);
      setOccupiedStarts(result.occupiedStarts ?? []);
    } catch {
      setStarts(null);
      setOccupiedStarts([]);
      setError("Non è stato possibile calcolare gli orari disponibili.");
    } finally {
      setLoading(false);
    }
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
      const bookingOutcome = created.stato === "confermata"
        ? "Appuntamento confermato automaticamente."
        : "Richiesta inviata. Il salone deve ancora confermarla.";
      setMessage(created.sconto > 0
        ? `${bookingOutcome} Coupon applicato: risparmi € ${(created.sconto / 100).toFixed(2)}.`
        : recurrenceCount > 1
          ? created.stato === "confermata"
            ? `Serie di ${created.occurrenceCount ?? recurrenceCount} appuntamenti confermata automaticamente.`
            : `Serie di ${created.occurrenceCount ?? recurrenceCount} appuntamenti inviata. Il salone deve ancora confermarla.`
          : bookingOutcome);
      setSelectedStart(null);
      const result = await getAvailability({ salonId, serviceId, operatorId, date, ...advancedBookingFields() });
      setStarts(result.starts);
      setOccupiedStarts(result.occupiedStarts ?? []);
    } catch {
      setError("Lo slot non è più disponibile. Cerca nuovamente gli orari.");
    } finally {
      setLoading(false);
    }
  }

  async function enterWaitlist(startMin: number) {
    if (!salonId || !serviceId || !operatorId || !date) return;
    setLoading(true);
    setError(null);
    try {
      await joinWaitlist({ salonId, serviceId, operatorId, date, startMin, ...(selectedServiceIds.length > 1 ? { serviceIds: selectedServiceIds } : {}) });
      setWaitlist(await listMyWaitlist(salonId));
      setSelectedWaitlistStart(null);
      setMessage(`Sei in coda per le ${formatTime(startMin)}. Ti chiederemo conferma appena lo slot torna disponibile.`);
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
        <button type="button" className={step === 1 ? "is-active" : serviceId ? "is-complete" : ""} onClick={() => setStep(1)}><b>{serviceId ? <AppIcon name="check" size={17} /> : "1"}</b><span>Servizio</span></button>
        <button type="button" className={step === 2 ? "is-active" : operatorId ? "is-complete" : ""} disabled={!serviceId} onClick={() => setStep(2)}><b>{operatorId ? <AppIcon name="check" size={17} /> : "2"}</b><span>{experience.professional}</span></button>
        <button type="button" className={step === 3 ? "is-active" : date ? "is-complete" : ""} disabled={!operatorId} onClick={() => setStep(3)}><b>3</b><span>Data e ora</span></button>
      </div>

      <form className="booking-panel" onSubmit={searchAvailability}>
        {step === 1 && <section className="booking-step" aria-labelledby="booking-step-service">
          <div className="booking-section-heading"><span>Passaggio 1 di 3</span><h2 id="booking-step-service">Cosa vuoi fare?</h2><p>Scegli il servizio principale. Potrai aggiungerne altri prima di continuare.</p></div>
          <div className="booking-choice-grid booking-choice-grid--services">
            {services.map((service, index) => (
              <button
                type="button"
                className="booking-choice booking-choice--service"
                aria-pressed={serviceId === service.id}
                key={service.id}
                onClick={() => {
                  setServiceId(service.id);
                  setExtraServiceIds((current) => current.filter((id) => id !== service.id));
                  resetAvailability();
                }}
              >
                {service.fotoUrl ? <img src={service.fotoUrl} alt="" /> : <span className="booking-choice__index">{String(index + 1).padStart(2, "0")}</span>}
                <span className="booking-choice__body"><strong>{service.titolo}</strong><small>{service.descrizione || "Servizio personalizzato in salone"}</small><span>{service.durataMin} min <b>€ {(service.prezzo / 100).toFixed(2)}</b></span></span>
                <span className="booking-choice__select"><AppIcon name={serviceId === service.id ? "check" : "arrow"} size={18} /></span>
              </button>
            ))}
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
                      resetAvailability();
                    }}
                  />
                  <span>{service.titolo}</span>
                  <small>{service.durataMin} min · € {(service.prezzo / 100).toFixed(2)}</small>
                </label>
              ))}
            </fieldset>
          )}
          <div className="booking-step__footer"><span>{serviceId ? `${totalDuration} min · € ${(totalPrice / 100).toFixed(2)}` : "Seleziona un servizio"}</span><button className="customer-button" type="button" disabled={!serviceId} onClick={() => setStep(2)}>Continua <AppIcon name="arrow" size={18} /></button></div>
        </section>}

        {step === 2 && <section className="booking-step" aria-labelledby="booking-step-operator">
          <div className="booking-section-heading"><span>Passaggio 2 di 3</span><h2 id="booking-step-operator">Chi si prenderà cura di te?</h2><p>Scegli il professionista che preferisci.</p></div>
          <div className="booking-choice-grid booking-choice-grid--operators">
            {operators.map((operator) => (
              <button
                type="button"
                className="booking-choice booking-choice--operator"
                aria-pressed={operatorId === operator.id}
                key={operator.id}
                onClick={() => { setOperatorId(operator.id); resetAvailability(); }}
              >
                {operator.fotoUrl ? <img src={operator.fotoUrl} alt={`Foto di ${operator.nome}`} /> : <span className="booking-choice__avatar">{operator.nome.slice(0, 1)}</span>}
                <span className="booking-choice__body"><small>{experience.role}</small><strong>{operator.nome}</strong><span>Disponibile per questo servizio</span></span>
                <span className="booking-choice__select"><AppIcon name={operatorId === operator.id ? "check" : "arrow"} size={18} /></span>
              </button>
            ))}
          </div>
          <div className="booking-step__footer"><button className="booking-back" type="button" onClick={() => setStep(1)}>← Indietro</button><button className="customer-button" type="button" disabled={!operatorId} onClick={() => setStep(3)}>Scegli data <AppIcon name="arrow" size={18} /></button></div>
        </section>}

        {step === 3 && <section className="booking-step" aria-labelledby="booking-step-date">
          <div className="booking-section-heading"><span>Passaggio 3 di 3</span><h2 id="booking-step-date">Quando vuoi venire?</h2><p>Seleziona il giorno e cerca gli orari disponibili.</p></div>
          <div className="booking-date-panel">
            <div className="booking-field booking-field--date">
              <label htmlFor="booking-date">Data</label>
              <input id="booking-date" type="date" value={date} onChange={(event) => { setDate(event.target.value); resetAvailability(); }} required />
            </div>
            <details className="booking-options">
              <summary>Opzioni aggiuntive <span>Ricorrenza e coupon</span></summary>
              <div className="booking-options__content">
                <div className="booking-field">
                  <label htmlFor="booking-recurrence">Frequenza</label>
                  <select id="booking-recurrence" value={recurrenceCount} onChange={(event) => { setRecurrenceCount(Number(event.target.value)); resetAvailability(); }}>
                    <option value={1}>Una volta</option>
                    <option value={4}>Ogni settimana · 4 appuntamenti</option>
                    <option value={8}>Ogni settimana · 8 appuntamenti</option>
                  </select>
                </div>
                <div className="booking-field">
                  <label htmlFor="booking-coupon">Coupon</label>
                  <input id="booking-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Es. OGGI20" autoComplete="off" />
                </div>
              </div>
            </details>
          </div>

          <div className="booking-summary booking-summary--rich" aria-label="Riepilogo servizi">
            <span><small>Il tuo appuntamento</small>{selectedServices.map((service) => service.titolo).join(" + ")}<em>con {operatorName(operatorId)}</em></span>
            <strong>{totalDuration} min<br />€ {(totalPrice / 100).toFixed(2)}{recurrenceCount > 1 ? ` × ${recurrenceCount}` : ""}</strong>
          </div>

          <div className="booking-step__footer"><button className="booking-back" type="button" onClick={() => setStep(2)}>← Indietro</button><button className="customer-button" type="submit" disabled={loading || !date}>
            {loading ? "Caricamento…" : "Cerca orari"}
          </button></div>
        </section>}

        {starts && (
          <section aria-label="Orari disponibili">
            <h2>Orari disponibili</h2>
            {starts.length === 0 && occupiedStarts.length === 0 ? (
              <div className="booking-empty">
                <p>Nessun orario disponibile {recurrenceCount > 1 ? "in tutte le date della serie" : "per questa data"}.</p>
                <span>Prova un altro giorno o un altro professionista.</span>
              </div>
            ) : (
              <>
                {starts.length > 0 && <><h3 className="booking-slot-group-title">Disponibili</h3><div className="booking-slots">
                  {starts.map((start) => (
                    <button
                      className="booking-slot"
                      type="button"
                      key={start}
                      aria-pressed={selectedStart === start}
                      onClick={() => { setSelectedStart(start); setSelectedWaitlistStart(null); }}
                    >
                      {formatTime(start)}
                    </button>
                  ))}
                </div></>}
                {recurrenceCount === 1 && occupiedStarts.length > 0 && <section className="booking-waitlist-slots" aria-label="Orari occupati con lista d'attesa"><header><div><span>Al completo</span><h3>Mettiti in coda su un orario preciso</h3></div><AppIcon name="clock" size={20} /></header><p>Se qualcuno disdice, riceverai una notifica per confermare se ti interessa ancora.</p><div className="booking-slots">
                  {occupiedStarts.map((start) => <button className="booking-slot booking-slot--waitlist" type="button" key={start} aria-pressed={selectedWaitlistStart === start} onClick={() => { setSelectedWaitlistStart(start); setSelectedStart(null); }}><span>{formatTime(start)}</span><small>Coda</small></button>)}
                </div>{selectedWaitlistStart !== null && <button className="customer-button customer-button--secondary" type="button" disabled={loading} onClick={() => void enterWaitlist(selectedWaitlistStart)}>Avvisami per le {formatTime(selectedWaitlistStart)}</button>}</section>}
              </>
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

      {salonId && <a className="booking-history-link" href="/appuntamenti">Vedi e gestisci i miei appuntamenti <span aria-hidden="true">→</span></a>}

      {salonId && waitlist.length > 0 && (
        <section className="booking-panel customer-bookings">
          <h2>I miei avvisi disponibilità</h2>
          {waitlist.map((entry) => (
            <article className="customer-booking" key={entry.id}>
              <div>
                <strong>{entry.serviceItems.map((item) => item.titolo).join(" + ")} con {operatorName(entry.operatorId)}</strong>
                <div className="customer-booking__meta">{entry.date} · {formatTime(entry.startMin)} · {entry.status === "notified" ? "Slot disponibile: conferma dalla notifica" : "In coda"}</div>
              </div>
              <button className="customer-button customer-button--secondary" type="button" onClick={() => void leaveWaitlist(entry.id)}>Annulla avviso</button>
            </article>
          ))}
        </section>
      )}
    </section>
  );
}
