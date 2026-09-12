import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

interface CreateOrderItem {
  productId: string;
  qta: number;
}
interface CreateOrderData {
  salonId: string;
  items: CreateOrderItem[];
  couponCode?: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value;
}

export const createOrder = onCall<CreateOrderData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const items = request.data?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Il carrello è vuoto.");
  }
  for (const item of items) {
    requireId(item?.productId, "productId");
    if (!Number.isInteger(item?.qta) || item.qta <= 0) {
      throw new HttpsError("invalid-argument", "Quantità non valida.");
    }
  }

  const db = getFirestore();
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists || userSnap.data()?.ruolo !== "cliente") {
    throw new HttpsError("permission-denied", "Solo un cliente può ordinare.");
  }
  const user = userSnap.data() as { nome?: string; email?: string };

  const snapshotItems: {
    productId: string; titolo: string; prezzo: number; qta: number; isGift?: boolean;
  }[] = [];
  let totale = 0;
  for (const item of items) {
    const prodSnap = await db.doc(`salons/${salonId}/products/${item.productId}`).get();
    const prod = prodSnap.data() as { titolo?: string; prezzo?: number; attivo?: boolean } | undefined;
    if (!prodSnap.exists || prod?.attivo !== true) {
      throw new HttpsError("failed-precondition", "Prodotto non disponibile.");
    }
    if (!Number.isInteger(prod.prezzo) || (prod.prezzo as number) < 0) {
      throw new HttpsError("failed-precondition", "Prezzo prodotto non valido.");
    }
    snapshotItems.push({
      productId: item.productId,
      titolo: prod.titolo ?? "Prodotto",
      prezzo: prod.prezzo as number,
      qta: item.qta,
    });
    totale += (prod.prezzo as number) * item.qta;
  }

  let coupon: { id: string; codice: string; giftProductId?: string; giftProductTitle?: string } | null = null;
  const requestedCode = typeof request.data?.couponCode === "string" ? request.data.couponCode.trim().toUpperCase() : "";
  if (requestedCode) {
    const couponQuery = await db.collection(`salons/${salonId}/coupons`).where("codice", "==", requestedCode).limit(1).get();
    if (couponQuery.empty) throw new HttpsError("not-found", "Codice coupon non valido.");
    const couponDoc = couponQuery.docs[0]; const data = couponDoc.data();
    if (data.attivo !== true || data.tipo !== "prodotto_omaggio") throw new HttpsError("failed-precondition", "Questo coupon non è utilizzabile per un ordine prodotto.");
    if (typeof data.scadenza === "string" && data.scadenza < new Date().toISOString().slice(0, 10)) throw new HttpsError("failed-precondition", "Il coupon è scaduto.");
    if (typeof data.clientId === "string" && data.clientId !== uid) throw new HttpsError("permission-denied", "Il coupon appartiene a un altro cliente.");
    if (Number.isInteger(data.spesaMinima) && totale < data.spesaMinima) throw new HttpsError("failed-precondition", `Spesa minima richiesta: € ${(data.spesaMinima / 100).toFixed(2)}.`);
    if (typeof data.giftProductId !== "string") throw new HttpsError("failed-precondition", "Prodotto omaggio non configurato.");
    const giftSnap = await db.doc(`salons/${salonId}/products/${data.giftProductId}`).get(); const gift = giftSnap.data();
    if (!giftSnap.exists || gift?.attivo !== true) throw new HttpsError("failed-precondition", "Il prodotto omaggio non è disponibile.");
    snapshotItems.push({ productId: data.giftProductId, titolo: typeof gift.titolo === "string" ? gift.titolo : data.giftProductTitle ?? "Prodotto omaggio", prezzo: 0, qta: 1, isGift: true });
    coupon = { id: couponDoc.id, codice: requestedCode, giftProductId: data.giftProductId, giftProductTitle: data.giftProductTitle };
  }

  const orderRef = db.collection(`salons/${salonId}/orders`).doc();
  if (coupon) {
    const redemptionRef = db.doc(`salons/${salonId}/couponRedemptions/${coupon.id}_${uid}`);
    await db.runTransaction(async (tx) => {
      if ((await tx.get(redemptionRef)).exists) throw new HttpsError("already-exists", "Coupon già utilizzato.");
      tx.create(orderRef, { clientId: uid, clientNome: user.nome?.trim() || "Cliente", clientEmail: user.email ?? null, items: snapshotItems, totale, stato: "in_attesa", couponId: coupon!.id, couponCode: coupon!.codice, createdAt: FieldValue.serverTimestamp() });
      tx.create(redemptionRef, { couponId: coupon!.id, clientId: uid, orderId: orderRef.id, createdAt: FieldValue.serverTimestamp() });
    });
  } else {
    await orderRef.set({ clientId: uid, clientNome: user.nome?.trim() || "Cliente", clientEmail: user.email ?? null, items: snapshotItems, totale, stato: "in_attesa", createdAt: FieldValue.serverTimestamp() });
  }

  return { orderId: orderRef.id, totale, stato: "in_attesa" as const, ...(coupon?.giftProductTitle ? { giftProductTitle: coupon.giftProductTitle } : {}) };
});
