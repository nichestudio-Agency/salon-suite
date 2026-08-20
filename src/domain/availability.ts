import type { Interval } from "./time";

/** Ordina per inizio e fonde gli intervalli che si sovrappongono o si toccano. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}

/** Restituisce le porzioni libere di `base` dopo aver tolto gli intervalli `busy`. */
export function subtractIntervals(base: Interval[], busy: Interval[]): Interval[] {
  const mergedBusy = mergeIntervals(busy);
  const result: Interval[] = [];
  for (const b of base) {
    let cursor = b.start;
    for (const x of mergedBusy) {
      if (x.end <= cursor || x.start >= b.end) continue; // nessuna sovrapposizione utile
      if (x.start > cursor) result.push({ start: cursor, end: x.start });
      cursor = Math.max(cursor, x.end);
      if (cursor >= b.end) break;
    }
    if (cursor < b.end) result.push({ start: cursor, end: b.end });
  }
  return result;
}

/**
 * Enumera gli orari di inizio (minuti dalla mezzanotte) allineati alla griglia
 * del passo `stepMin`, tenendo solo quelli in cui [inizio, inizio+durataMin]
 * rientra interamente in un intervallo libero.
 */
export function generateStartTimes(
  free: Interval[],
  durationMin: number,
  stepMin: number
): number[] {
  const starts: number[] = [];
  for (const iv of free) {
    let start = Math.ceil(iv.start / stepMin) * stepMin;
    while (start + durationMin <= iv.end) {
      starts.push(start);
      start += stepMin;
    }
  }
  return starts;
}

export type Weekday = "lun" | "mar" | "mer" | "gio" | "ven" | "sab" | "dom";

/** Orari settimanali: per ogni giorno, zero o più fasce di lavoro. */
export type WeeklyHours = Partial<Record<Weekday, Interval[]>>;

/**
 * Risolve gli orari di lavoro effettivi per un giorno, con logica ibrida:
 * se l'operatore ha un override per quel giorno (anche array vuoto = libero)
 * vince quello, altrimenti valgono gli orari del salone.
 */
export function resolveWorkingHours(
  salon: WeeklyHours,
  operator: WeeklyHours | undefined,
  day: Weekday
): Interval[] {
  if (operator && Object.prototype.hasOwnProperty.call(operator, day)) {
    return operator[day] ?? [];
  }
  return salon[day] ?? [];
}
