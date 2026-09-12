import { hm, toHM, type Interval } from "../domain/time";
import type { Weekday, WeeklyHours } from "../domain/availability";

const DAYS: { key: Weekday; label: string }[] = [
  { key: "lun", label: "Lunedì" },
  { key: "mar", label: "Martedì" },
  { key: "mer", label: "Mercoledì" },
  { key: "gio", label: "Giovedì" },
  { key: "ven", label: "Venerdì" },
  { key: "sab", label: "Sabato" },
  { key: "dom", label: "Domenica" },
];

const DEFAULT_SLOT: Interval = { start: 540, end: 1020 }; // 09:00–17:00

export function WeeklyHoursEditor({
  value,
  onChange,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
}) {
  function setDay(day: Weekday, slots: Interval[]) {
    onChange({ ...value, [day]: slots });
  }

  return (
    <div className="weekly-schedule">
      <div className="weekly-schedule__head" aria-hidden="true">
        <span>Giorno</span><span>Stato</span><span>Fasce orarie</span>
      </div>
      {DAYS.map(({ key, label }) => {
        const slots = value[key] ?? [];
        return (
          <section key={key} className={`weekly-schedule__row ${slots.length ? "is-open" : "is-closed"}`}>
            <div className="weekly-schedule__day"><strong>{label}</strong><small>{slots.length ? `${slots.length} ${slots.length === 1 ? "fascia" : "fasce"}` : "Nessun orario"}</small></div>
            <div className="weekly-schedule__status">
              <button
                type="button"
                className="weekly-schedule__toggle"
                aria-label={slots.length ? `Imposta ${label} come chiuso` : `Aggiungi fascia a ${label}`}
                onClick={() => setDay(key, slots.length ? [] : [{ ...DEFAULT_SLOT }])}
              >
                {slots.length ? "Aperto" : "Chiuso"}
              </button>
            </div>
            <div className="weekly-schedule__times">
              {slots.map((slot, i) => (
              <div className="weekly-schedule__slot" key={i}>
                <input
                  aria-label={`${label} inizio fascia ${i + 1}`}
                  type="time"
                  value={toHM(slot.start)}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...slot, start: hm(e.target.value) };
                    setDay(key, next);
                  }}
                />
                <span>–</span>
                <input
                  aria-label={`${label} fine fascia ${i + 1}`}
                  type="time"
                  value={toHM(slot.end)}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...slot, end: hm(e.target.value) };
                    setDay(key, next);
                  }}
                />
                <button
                  type="button"
                  className="weekly-schedule__remove"
                  aria-label={`Rimuovi fascia ${i + 1} di ${label}`}
                  onClick={() => setDay(key, slots.filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </div>
              ))}
              {slots.length > 0 && <button type="button" className="weekly-schedule__add" onClick={() => setDay(key, [...slots, { ...DEFAULT_SLOT }])}>+ Altra fascia</button>}
              {slots.length === 0 && <span className="weekly-schedule__closed">Attiva il giorno per impostare l’orario</span>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
