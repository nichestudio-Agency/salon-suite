export interface Interval {
  start: number;
  end: number;
}

export type Weekday = "lun" | "mar" | "mer" | "gio" | "ven" | "sab" | "dom";
export type WeeklyHours = Partial<Record<Weekday, Interval[]>>;

const WEEKDAYS: Weekday[] = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function weekdayOf(dateKey: string): Weekday {
  const [year, month, day] = dateKey.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function subtractIntervals(base: Interval[], busy: Interval[]): Interval[] {
  const occupied = mergeIntervals(busy.filter((interval) => interval.end > interval.start));
  const free: Interval[] = [];

  for (const work of base) {
    let cursor = work.start;
    for (const interval of occupied) {
      if (interval.end <= cursor || interval.start >= work.end) continue;
      if (interval.start > cursor) free.push({ start: cursor, end: interval.start });
      cursor = Math.max(cursor, interval.end);
      if (cursor >= work.end) break;
    }
    if (cursor < work.end) free.push({ start: cursor, end: work.end });
  }

  return free;
}

export function computeAvailableStartTimes(input: {
  salonHours: WeeklyHours;
  operatorHours?: WeeklyHours;
  day: Weekday;
  busy: Interval[];
  durationMin: number;
  stepMin: number;
}): number[] {
  const hasOverride =
    input.operatorHours &&
    Object.prototype.hasOwnProperty.call(input.operatorHours, input.day);
  const working = hasOverride
    ? input.operatorHours?.[input.day] ?? []
    : input.salonHours[input.day] ?? [];
  const free = subtractIntervals(working, input.busy);
  const starts: number[] = [];

  for (const interval of free) {
    let start = Math.ceil(interval.start / input.stepMin) * input.stepMin;
    while (start + input.durationMin <= interval.end) {
      starts.push(start);
      start += input.stepMin;
    }
  }

  return starts;
}
