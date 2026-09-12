import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { birthdaysToday, type BirthdayCandidate } from "./birthday-core.js";

if (getApps().length === 0) initializeApp();

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

async function processSalon(db: Firestore, salonId: string, today: string): Promise<number> {
  const salon = (await db.doc(`salons/${salonId}`).get()).data();
  const compleanno = salon?.compleanno;
  if (!compleanno || compleanno.attivo !== true) return 0;

  const messaggio =
    typeof compleanno.messaggio === "string" && compleanno.messaggio.trim()
      ? compleanno.messaggio.trim()
      : "Tanti auguri di buon compleanno!";


  const [bookings, orders] = await Promise.all([
    db.collection(`salons/${salonId}/bookings`).get(),
    db.collection(`salons/${salonId}/orders`).get(),
  ]);
  const clientIds = new Set<string>();
  for (const d of bookings.docs) { const c = d.data().clientId; if (typeof c === "string") clientIds.add(c); }
  for (const d of orders.docs) { const c = d.data().clientId; if (typeof c === "string") clientIds.add(c); }
  const idArr = [...clientIds];
  if (idArr.length === 0) return 0;

  const snaps = await db.getAll(...idArr.map((id) => db.doc(`users/${id}`)));
  const candidates: BirthdayCandidate[] = snaps
    .filter((s) => typeof s.data()?.dataNascita === "string")
    .map((s) => ({ clientId: s.id, dataNascita: s.data()!.dataNascita as string }));
  const birthdayIds = new Set(birthdaysToday(candidates, today));
  if (birthdayIds.size === 0) return 0;

  let count = 0;
  for (const snap of snaps) {
    if (!birthdayIds.has(snap.id)) continue;
    const profile = snap.data()!;
    const email = typeof profile.email === "string" ? profile.email : null;
    const tokens = Array.isArray(profile.fcmTokens)
      ? profile.fcmTokens.filter((t: unknown): t is string => typeof t === "string" && t.length > 0)
      : [];
    const notifId = `bday_${snap.id}_${today}`;
    const notifRef = db.doc(`salons/${salonId}/notifications/${notifId}`);
    const couponRef = db.doc(`salons/${salonId}/coupons/${notifId}`);
    const validity = Math.max(1, Number(compleanno.validitaGiorni) || 14); const expiry = new Date(`${today}T12:00:00Z`); expiry.setUTCDate(expiry.getUTCDate() + validity);
    const discountType = compleanno.scontoTipo === "prodotto_omaggio" ? "prodotto_omaggio" : compleanno.scontoTipo === "fisso" ? "fisso" : "percentuale"; const discountValue = discountType === "prodotto_omaggio" ? 0 : Math.max(1, Number(compleanno.scontoValore) || 15);
    const personalCode = `AUGURI-${today.slice(0, 4)}-${snap.id.slice(0, 6).toUpperCase()}`;
    const discountLabel = discountType === "prodotto_omaggio" ? `${compleanno.giftProductTitle ?? "un prodotto"} in omaggio` : discountType === "percentuale" ? `-${discountValue}%` : `-€${(discountValue / 100).toFixed(2)}`;
    const body = `${messaggio} Usa il tuo codice personale ${personalCode} (${discountLabel}), valido ${validity} giorni.`;

    const created = await db.runTransaction(async (tx) => {
      if ((await tx.get(notifRef)).exists) return false;
      tx.create(notifRef, {
        tipo: "compleanno",
        clientId: snap.id,
        title: "Buon compleanno!",
        body,
        channels: {
          email: { status: email ? "queued" : "unavailable" },
          push: { status: tokens.length > 0 ? "queued" : "unavailable" },
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(couponRef, { codice: personalCode, tipo: discountType, valore: discountValue, ...(discountType === "prodotto_omaggio" && compleanno.giftProductId ? { giftProductId: compleanno.giftProductId, giftProductTitle: compleanno.giftProductTitle ?? "Prodotto omaggio" } : {}), scadenza: expiry.toISOString().slice(0, 10), attivo: true, clientId: snap.id, singleUse: true, origin: "compleanno" });
      if (email) {
        tx.set(db.doc(`mail/${salonId}_${notifId}`), {
          to: email,
          message: { subject: "Buon compleanno!", text: body },
          salonId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return true;
    });

    if (!created) continue;
    count++;
    if (tokens.length > 0) {
      try {
        await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: "Buon compleanno!", body },
          data: { salonId, tipo: "compleanno" },
        });
      } catch { /* best effort */ }
    }
  }
  return count;
}

/** Invio manuale/di test per il proprio salone (solo staff). */
export const runBirthdayGreetings = onCall<{ date?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const db = getFirestore();
  const caller = (await db.doc(`users/${uid}`).get()).data();
  const salonId = caller?.salonId;
  if (!salonId || !["owner", "staff"].includes(caller?.ruolo)) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone.");
  }
  const date = typeof request.data?.date === "string" ? request.data.date : todayYMD();
  const count = await processSalon(db, salonId, date);
  return { count };
});

/** Invio automatico giornaliero per tutti i saloni configurati. */
export const birthdayNotifications = onSchedule("every day 09:00", async () => {
  const db = getFirestore();
  const today = todayYMD();
  const salons = await db.collection("salons").get();
  for (const salon of salons.docs) {
    // Isolamento per salone: l'errore su un salone non deve bloccare gli altri.
    try {
      await processSalon(db, salon.id, today);
    } catch (error) {
      console.error(`birthdayNotifications: salone ${salon.id} fallito`, error);
    }
  }
});
