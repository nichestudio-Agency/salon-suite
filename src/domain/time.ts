/** Intervallo semiaperto [start, end) espresso in minuti dalla mezzanotte (0..1440). */
export interface Interval {
  start: number;
  end: number;
}

/** "HH:MM" -> minuti dalla mezzanotte. */
export function hm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** minuti dalla mezzanotte -> "HH:MM" con zero-padding. */
export function toHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
