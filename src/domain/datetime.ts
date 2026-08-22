import type { Weekday } from "./availability";

const WEEKDAYS: Weekday[] = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/** Verifica che una stringa sia una data valida in formato "YYYY-MM-DD". */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Giorno della settimana (formato breve italiano) di una data "YYYY-MM-DD".
 * Usa UTC per evitare slittamenti dovuti al fuso della macchina: la data è già
 * intesa come data locale del salone, non un istante.
 */
export function weekdayOf(dateKey: string): Weekday {
  const [y, m, d] = dateKey.split("-").map(Number);
  const idx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS[idx];
}
