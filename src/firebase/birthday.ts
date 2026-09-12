import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "./app";
import { listSalonClients } from "./client-repo";
import { getSalon } from "./salon-repo";

const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
export async function runBirthdayGreetings(salonId: string, date = localDate()): Promise<{ count: number }> {
  const salon = await getSalon(salonId); const config = salon?.compleanno; if (!config?.attivo) return { count: 0 };
  const clients = (await listSalonClients(salonId)).filter((client) => client.dataNascita.slice(5) === date.slice(5) && client.source !== "manual"); let count = 0;
  for (const client of clients) {
    const notificationRef = doc(db, `salons/${salonId}/notifications/bday_${client.id}_${date}`); if ((await getDoc(notificationRef)).exists()) continue;
    const validity = Math.max(1, config.validitaGiorni ?? 14); const expiry = new Date(`${date}T12:00:00`); expiry.setDate(expiry.getDate() + validity); const type = config.scontoTipo === "prodotto_omaggio" ? "prodotto_omaggio" : "percentuale"; const value = type === "percentuale" ? Math.max(1, config.scontoValore ?? 15) : 0; const code = `AUGURI-${date.slice(0, 4)}-${client.id.slice(0, 6).toUpperCase()}`; const message = config.messaggio?.trim() || "Tanti auguri di buon compleanno!";
    const gift = type === "prodotto_omaggio" && config.giftProductId ? { giftProductId: config.giftProductId, giftProductTitle: config.giftProductTitle ?? "Prodotto omaggio" } : {};
    const batch = writeBatch(db); batch.set(doc(db, `salons/${salonId}/coupons/bday_${client.id}_${date}`), { codice: code, tipo: type, valore: value, ...gift, scadenza: expiry.toISOString().slice(0, 10), clientId: client.id, singleUse: true, origin: "compleanno", attivo: true }); batch.set(notificationRef, { clientId: client.id, titolo: "Buon compleanno!", testo: `${message} Il tuo codice personale è ${code}.`, tipo: "compleanno", read: false, createdAt: serverTimestamp() }); await batch.commit(); count++;
  }
  return { count };
}
