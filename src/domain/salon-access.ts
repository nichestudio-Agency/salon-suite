export function normalizeSalonAccessCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

export function parseSalonAccessCode(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    const match = url.pathname.match(/\/salone\/([^/]+)/i);
    if (match) return normalizeSalonAccessCode(decodeURIComponent(match[1]));
  } catch {
    // Il QR può contenere direttamente il codice, senza essere un URL.
  }
  return normalizeSalonAccessCode(trimmed.replace(/^salon-access:/i, ""));
}
