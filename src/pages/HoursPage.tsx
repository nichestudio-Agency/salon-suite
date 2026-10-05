import { useEffect, useState } from "react";
import { useAuth } from "../app/auth-context";
import { WeeklyHoursEditor } from "../components/WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";
import type { Salon } from "../domain/models";
import { getSalon, updateBookingConfirmationMode, updateOpeningHours } from "../firebase/salon-repo";
import { AppIcon } from "../components/AppIcon";

export function HoursPage() {
  const { salonId } = useAuth();
  const [hours, setHours] = useState<WeeklyHours | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmationMode, setConfirmationMode] = useState<Salon["impostazioni"]["modalitaConferma"]>("manuale");

  useEffect(() => {
    if (!salonId) return;
    void getSalon(salonId).then((salon) => {
      setHours(salon?.orariApertura ?? {});
      setConfirmationMode(salon?.impostazioni?.modalitaConferma ?? "manuale");
    });
  }, [salonId]);

  async function onSave() {
    if (!salonId || !hours) return;
    await Promise.all([
      updateOpeningHours(salonId, hours),
      updateBookingConfirmationMode(salonId, confirmationMode),
    ]);
    setSaved(true);
  }

  if (!hours) return <p>Caricamento…</p>;

  return (
    <section>
      <header className="dashboard-page-header"><div><span>Disponibilità</span><h2>Orari di apertura</h2><p>L’intera settimana è visibile senza scorrere. Gli operatori ereditano questi orari.</p></div></header>
      <WeeklyHoursEditor
        value={hours}
        onChange={(nextHours) => {
          setHours(nextHours);
          setSaved(false);
        }}
      />
      <section className="booking-confirmation-settings" aria-labelledby="booking-confirmation-title">
        <header><div><span>Gestione richieste</span><h3 id="booking-confirmation-title">Come vuoi accettare le prenotazioni?</h3><p>Puoi cambiare modalità in qualsiasi momento. Le prenotazioni già ricevute non vengono modificate.</p></div><AppIcon name="calendar" size={24} /></header>
        <div role="radiogroup" aria-label="Modalità di conferma delle prenotazioni">
          <label className={confirmationMode === "auto" ? "is-selected" : ""}>
            <input type="radio" name="confirmation-mode" value="auto" checked={confirmationMode === "auto"} onChange={() => { setConfirmationMode("auto"); setSaved(false); }} />
            <span><strong>Accettazione automatica</strong><small>Lo slot viene confermato subito al cliente. Ideale quando l’agenda è sempre aggiornata.</small></span><b>Immediata</b>
          </label>
          <label className={confirmationMode === "manuale" ? "is-selected" : ""}>
            <input type="radio" name="confirmation-mode" value="manuale" checked={confirmationMode === "manuale"} onChange={() => { setConfirmationMode("manuale"); setSaved(false); }} />
            <span><strong>Conferma manuale</strong><small>Ogni richiesta resta in attesa finché il salone non la conferma dall’agenda.</small></span><b>Con controllo</b>
          </label>
        </div>
      </section>
      <button className="btn" type="button" onClick={onSave}>
        Salva impostazioni
      </button>
      {saved && (
        <span role="status" style={{ marginLeft: 10 }}>
          Salvato ✓
        </span>
      )}
    </section>
  );
}
