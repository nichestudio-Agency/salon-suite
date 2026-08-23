export interface BirthdayCandidate {
  clientId: string;
  /** "YYYY-MM-DD" */
  dataNascita: string;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Restituisce gli id dei candidati che compiono gli anni in `today` ("YYYY-MM-DD"),
 * confrontando mese-giorno. Regola 29/2: nei giorni non bisestili, i nati il 29/2
 * festeggiano il 28/2.
 */
export function birthdaysToday(
  candidates: BirthdayCandidate[],
  today: string
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  const md = today.slice(5); // "MM-DD"
  const feb28NonLeap = md === "02-28" && !isLeapYear(Number(today.slice(0, 4)));
  return candidates
    .filter(
      (c) => typeof c.dataNascita === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.dataNascita)
    )
    .filter((c) => {
      const bmd = c.dataNascita.slice(5);
      return bmd === md || (feb28NonLeap && bmd === "02-29");
    })
    .map((c) => c.clientId);
}
