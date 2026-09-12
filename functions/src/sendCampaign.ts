import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface CampaignFilters {
  sesso?: "maschile" | "femminile";
  natoDa?: string;
  natoA?: string;
  bookingInactiveDays?: number;
  productInactiveDays?: number;
  recipientIds?: string[];
}
interface SendCampaignData {
  salonId: string;
  filtri?: CampaignFilters;
  titolo: string;
  testo: string;
  couponId?: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value;
}

export const sendCampaign = onCall<SendCampaignData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const titolo = (request.data?.titolo ?? "").trim();
  const testo = (request.data?.testo ?? "").trim();
  if (!titolo || !testo) {
    throw new HttpsError("invalid-argument", "Titolo e testo sono obbligatori.");
  }
  const filtri: CampaignFilters = request.data?.filtri ?? {};
  for (const value of [filtri.bookingInactiveDays, filtri.productInactiveDays]) {
    if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > 3650)) {
      throw new HttpsError("invalid-argument", "Il periodo di inattività deve essere compreso tra 1 e 3650 giorni.");
    }
  }

  const db = getFirestore();
  const callerSnap = await db.doc(`users/${uid}`).get();
  const caller = callerSnap.data();
  if (
    !callerSnap.exists ||
    caller?.salonId !== salonId ||
    !["owner", "staff"].includes(caller?.ruolo)
  ) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone può inviare campagne.");
  }

  const [bookings, orders, clientProfiles] = await Promise.all([
    db.collection(`salons/${salonId}/bookings`).get(),
    db.collection(`salons/${salonId}/orders`).get(),
    db.collection("users").where("salonId", "==", salonId).get(),
  ]);
  const lastBooking = new Map<string, string>();
  const lastOrder = new Map<string, string>();
  for (const d of bookings.docs) {
    const data = d.data();
    const clientId = data.clientId;
    const date = data.date;
    if (typeof clientId === "string" && typeof date === "string" && !["annullata", "rifiutata"].includes(data.stato)) {
      if (!lastBooking.has(clientId) || date > lastBooking.get(clientId)!) lastBooking.set(clientId, date);
    }
  }
  for (const d of orders.docs) {
    const data = d.data();
    const clientId = data.clientId;
    const date = data.createdAt?.toDate?.().toISOString().slice(0, 10);
    if (typeof clientId === "string" && typeof date === "string" && data.stato !== "annullato") {
      if (!lastOrder.has(clientId) || date > lastOrder.get(clientId)!) lastOrder.set(clientId, date);
    }
  }

  // Coupon opzionale → suffisso nel messaggio (rifiuta coupon non valido/scaduto).
  let couponSuffix = "";
  const couponId = request.data?.couponId;
  if (couponId !== undefined && couponId !== null && couponId !== "") {
    requireId(couponId, "couponId");
    const couponSnap = await db.doc(`salons/${salonId}/coupons/${couponId}`).get();
    const coupon = couponSnap.data();
    const today = new Date().toISOString().slice(0, 10);
    const valido = couponSnap.exists && coupon && coupon.attivo === true
      && (typeof coupon.scadenza !== "string" || coupon.scadenza >= today);
    if (!valido) {
      throw new HttpsError("failed-precondition", "Coupon non valido o scaduto.");
    }
    const sconto = coupon!.tipo === "percentuale"
      ? `-${coupon!.valore}%`
      : `-€${(Number(coupon!.valore) / 100).toFixed(2)}`;
    couponSuffix = ` Usa il codice ${coupon!.codice} (${sconto}).`;
  }
  const body = testo + couponSuffix;

  const campaignRef = db.collection(`salons/${salonId}/campaigns`).doc();

  // Filtra i profili lato server (lettura in blocco) e raccogli token/email.
  const profileSnaps = clientProfiles.docs.filter((snap) => snap.data().ruolo === "cliente");
  const tokens: string[] = [];
  const emails: string[] = [];
  const recipientIds: string[] = [];
  let recipientCount = 0;
  for (const snap of profileSnaps) {
    const profile = snap.data();
    if (!profile) continue;
    if (filtri.recipientIds?.length && !filtri.recipientIds.includes(snap.id)) continue;
    if (filtri.sesso && profile.sesso !== filtri.sesso) continue;
    const nascita = typeof profile.dataNascita === "string" ? profile.dataNascita : null;
    if (filtri.natoDa && (!nascita || nascita < filtri.natoDa)) continue;
    if (filtri.natoA && (!nascita || nascita > filtri.natoA)) continue;
    if (filtri.bookingInactiveDays) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - filtri.bookingInactiveDays);
      const cutoffDate = cutoff.toISOString().slice(0, 10);
      const last = lastBooking.get(snap.id);
      if (last && last > cutoffDate) continue;
    }
    if (filtri.productInactiveDays) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - filtri.productInactiveDays);
      const cutoffDate = cutoff.toISOString().slice(0, 10);
      const last = lastOrder.get(snap.id);
      if (last && last > cutoffDate) continue;
    }
    recipientCount++;
    recipientIds.push(snap.id);
    if (Array.isArray(profile.fcmTokens)) {
      for (const t of profile.fcmTokens) {
        if (typeof t === "string" && t.length > 0) tokens.push(t);
      }
    }
    if (typeof profile.email === "string" && profile.email) emails.push(profile.email);
  }

  // Email via estensione mail, in lotti (limite 500 scritture per batch Firestore).
  let mailIndex = 0;
  for (const group of chunk(emails, 450)) {
    const batch = db.batch();
    for (const email of group) {
      batch.set(db.doc(`mail/${campaignRef.id}_${mailIndex++}`), {
        to: email,
        message: { subject: titolo, text: body },
        salonId,
        campaignId: campaignRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  // Push (best effort), in lotti (limite 500 token per multicast FCM).
  for (const group of chunk(tokens, 450)) {
    try {
      await getMessaging().sendEachForMulticast({
        tokens: group,
        notification: { title: titolo, body },
        data: { salonId, campaignId: campaignRef.id },
      });
    } catch {
      // best effort: l'email resta il canale di riserva
    }
  }

  // Audit scritto DOPO gli invii, così riflette che l'invio è realmente avvenuto.
  await campaignRef.set({
    filtri,
    titolo,
    testo,
    couponId: couponId ?? null,
    recipientCount,
    recipientIds,
    sentAt: FieldValue.serverTimestamp(),
  });

  return { campaignId: campaignRef.id, recipientCount };
});
