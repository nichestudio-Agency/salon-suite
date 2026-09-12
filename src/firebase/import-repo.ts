import { collection, doc, getDocs, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./app";

export type ImportEntity = "clienti" | "servizi" | "operatori" | "prodotti";
export interface ImportResult { imported: number; skipped: number; errors: string[] }

const pick = (row: Record<string, string>, ...keys: string[]) => keys.map((key) => row[key]).find(Boolean)?.trim() ?? "";
const normalized = (value: string) => value.trim().toLocaleLowerCase("it").replace(/\s+/g, " ");
const euroCents = (value: string) => {
  const clean = value.replace(/[^0-9,.-]/g, "");
  const decimal = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const number = Number(decimal);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
};
const positiveInt = (value: string, fallback: number) => {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

function target(entity: ImportEntity) {
  return entity === "clienti" ? "clients" : entity === "servizi" ? "services" : entity === "operatori" ? "operators" : "products";
}

function existingKey(entity: ImportEntity, data: Record<string, unknown>) {
  if (entity === "clienti") return normalized(String(data.email || data.telefono || data.nome || ""));
  return normalized(String(entity === "servizi" ? data.titolo : entity === "operatori" ? data.nome : data.titolo));
}

function mapRow(entity: ImportEntity, row: Record<string, string>) {
  if (entity === "clienti") {
    const nome = pick(row, "nome", "nome_e_cognome", "cliente");
    const email = pick(row, "email", "e_mail").toLowerCase();
    const telefono = pick(row, "telefono", "cellulare", "phone");
    if (!nome) return { error: "nome mancante" };
    const rawGender = normalized(pick(row, "sesso", "genere"));
    const sesso = rawGender === "maschile" || rawGender === "m" ? "maschile" : rawGender === "femminile" || rawGender === "f" ? "femminile" : "altro";
    return { key: normalized(email || telefono || nome), data: { nome, email, telefono, sesso, dataNascita: pick(row, "data_nascita", "nascita"), importSource: "csv", createdAt: serverTimestamp(), updatedAt: serverTimestamp() } };
  }
  if (entity === "operatori") {
    const nome = pick(row, "nome", "operatore");
    if (!nome) return { error: "nome mancante" };
    return { key: normalized(nome), data: { nome, attivo: true, importSource: "csv" } };
  }
  const titolo = pick(row, "titolo", "nome", entity === "servizi" ? "servizio" : "prodotto");
  const prezzo = euroCents(pick(row, "prezzo", "prezzo_euro", "costo"));
  if (!titolo) return { error: "nome mancante" };
  if (!Number.isInteger(prezzo) || prezzo < 0) return { error: `prezzo non valido per ${titolo}` };
  if (entity === "servizi") return { key: normalized(titolo), data: { titolo, descrizione: pick(row, "descrizione"), prezzo, durataMin: positiveInt(pick(row, "durata", "durata_min", "minuti"), 30), attivo: true, importSource: "csv" } };
  return { key: normalized(titolo), data: { titolo, descrizione: pick(row, "descrizione"), prezzo, attivo: true, importSource: "csv" } };
}

export async function importCsvRecords(salonId: string, entity: ImportEntity, rows: Array<Record<string, string>>): Promise<ImportResult> {
  const destination = collection(db, "salons", salonId, target(entity));
  const existing = await getDocs(destination);
  const keys = new Set(existing.docs.map((item) => existingKey(entity, item.data())));
  const valid: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  let skipped = 0;
  rows.forEach((row, index) => {
    const mapped = mapRow(entity, row);
    if ("error" in mapped) { errors.push(`Riga ${index + 2}: ${mapped.error}`); return; }
    if (keys.has(mapped.key)) { skipped++; return; }
    keys.add(mapped.key); valid.push(mapped.data);
  });
  for (let index = 0; index < valid.length; index += 400) {
    const batch = writeBatch(db);
    for (const data of valid.slice(index, index + 400)) batch.set(doc(destination), data);
    await batch.commit();
  }
  return { imported: valid.length, skipped, errors };
}
