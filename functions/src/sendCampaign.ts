import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

interface CampaignFilters {
  sesso?: "maschile" | "femminile";
  natoDa?: string;
  natoA?: string;
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

  // Clientela: clientId distinti da prenotazioni + ordini del salone.
  const [bookings, orders] = await Promise.all([
    db.collection(`salons/${salonId}/bookings`).get(),
    db.collection(`salons/${salonId}/orders`).get(),
  ]);
  const clientIds = new Set<string>();
  for (const d of bookings.docs) {
    const c = d.data().clientId;
    if (typeof c === "string") clientIds.add(c);
  }
  for (const d of orders.docs) {
    const c = d.data().clientId;
    if (typeof c === "string") clientIds.add(c);
  }

  // Coupon opzionale → suffisso nel messaggio.
  let couponSuffix = "";
  const couponId = request.data?.couponId;
  if (typeof couponId === "string" && couponId) {
    const couponSnap = await db.doc(`salons/${salonId}/coupons/${couponId}`).get();
    const coupon = couponSnap.data();
    if (couponSnap.exists && coupon) {
      const sconto =
        coupon.tipo === "percentuale"
          ? `-${coupon.valore}%`
          : `-€${(Number(coupon.valore) / 100).toFixed(2)}`;
      couponSuffix = ` Usa il codice ${coupon.codice} (${sconto}).`;
    }
  }
  const body = testo + couponSuffix;

  // Filtra i profili lato server e raccogli token/email.
  const tokens: string[] = [];
  const emails: string[] = [];
  let recipientCount = 0;
  for (const clientId of clientIds) {
    const profile = (await db.doc(`users/${clientId}`).get()).data();
    if (!profile) continue;
    if (filtri.sesso && profile.sesso !== filtri.sesso) continue;
    const nascita = typeof profile.dataNascita === "string" ? profile.dataNascita : null;
    if (filtri.natoDa && (!nascita || nascita < filtri.natoDa)) continue;
    if (filtri.natoA && (!nascita || nascita > filtri.natoA)) continue;
    recipientCount++;
    if (Array.isArray(profile.fcmTokens)) {
      for (const t of profile.fcmTokens) {
        if (typeof t === "string" && t.length > 0) tokens.push(t);
      }
    }
    if (typeof profile.email === "string" && profile.email) emails.push(profile.email);
  }

  const campaignRef = db.collection(`salons/${salonId}/campaigns`).doc();
  await campaignRef.set({
    filtri,
    titolo,
    testo,
    couponId: couponId ?? null,
    recipientCount,
    sentAt: FieldValue.serverTimestamp(),
  });

  // Email via estensione mail (batch; per lotti oltre 500 servirà chunking, non necessario ora).
  if (emails.length > 0) {
    const batch = db.batch();
    emails.forEach((email, i) => {
      batch.set(db.doc(`mail/${campaignRef.id}_${i}`), {
        to: email,
        message: { subject: titolo, text: body },
        salonId,
        campaignId: campaignRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  // Push (best effort).
  if (tokens.length > 0) {
    try {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: titolo, body },
        data: { salonId, campaignId: campaignRef.id },
      });
    } catch {
      // best effort: l'email resta il canale di riserva
    }
  }

  return { campaignId: campaignRef.id, recipientCount };
});
