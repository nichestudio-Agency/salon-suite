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
    productId: string; titolo: string; prezzo: number; qta: number;
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

  const orderRef = db.collection(`salons/${salonId}/orders`).doc();
  await orderRef.set({
    clientId: uid,
    clientNome: user.nome?.trim() || "Cliente",
    clientEmail: user.email ?? null,
    items: snapshotItems,
    totale,
    stato: "in_attesa",
    createdAt: FieldValue.serverTimestamp(),
  });

  return { orderId: orderRef.id, totale, stato: "in_attesa" as const };
});
