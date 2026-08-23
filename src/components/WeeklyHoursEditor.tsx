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
    <div>
      {DAYS.map(({ key, label }) => {
        const slots = value[key] ?? [];
        return (
          <div key={key} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{label}</strong>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDay(key, [...slots, { ...DEFAULT_SLOT }])}
              >
                Aggiungi fascia
              </button>
            </div>
            {slots.length === 0 && <p style={{ color: "var(--muted)" }}>Chiuso</p>}
            {slots.map((slot, i) => (
              <div className="row" key={i} style={{ marginTop: 6 }}>
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
                  className="btn btn--danger"
                  aria-label={`Rimuovi fascia ${i + 1} di ${label}`}
                  onClick={() => setDay(key, slots.filter((_, j) => j !== i))}
                >
                  Rimuovi fascia
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
