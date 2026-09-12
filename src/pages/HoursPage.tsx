import { useEffect, useState } from "react";
import { useAuth } from "../app/auth-context";
import { WeeklyHoursEditor } from "../components/WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";
import { getSalon, updateOpeningHours } from "../firebase/salon-repo";

export function HoursPage() {
  const { salonId } = useAuth();
  const [hours, setHours] = useState<WeeklyHours | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    void getSalon(salonId).then((salon) => {
      setHours(salon?.orariApertura ?? {});
    });
  }, [salonId]);

  async function onSave() {
    if (!salonId || !hours) return;
    await updateOpeningHours(salonId, hours);
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
      <button className="btn" type="button" onClick={onSave}>
        Salva orari
      </button>
      {saved && (
        <span role="status" style={{ marginLeft: 10 }}>
          Salvato ✓
        </span>
      )}
    </section>
  );
}
