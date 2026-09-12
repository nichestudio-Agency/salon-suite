import {
  getFirestore,
  type Firestore,
  type Transaction,
} from "firebase-admin/firestore";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function normalizeSalonAccessCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateSalonAccessCode(name: string): string {
  const prefix = normalizeSalonAccessCode(name).slice(0, 5).padEnd(5, "X");
  let suffix = "";
  for (let index = 0; index < 5; index += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}${suffix}`;
}

export async function findAvailableSalonAccessCode(
  db: Firestore,
  name: string,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateSalonAccessCode(name);
    if (!(await db.doc(`salonAccessCodes/${code}`).get()).exists) return code;
  }
  throw new Error("access-code-unavailable");
}

export function writeSalonAccessCode(
  tx: Transaction,
  salonId: string,
  code: string,
  previousCode?: string,
) {
  const db = getFirestore();
  if (previousCode && previousCode !== code)
    tx.delete(db.doc(`salonAccessCodes/${previousCode}`));
  tx.set(db.doc(`salonAccessCodes/${code}`), {
    salonId,
    attivo: true,
    createdAt: new Date().toISOString(),
  });
}
