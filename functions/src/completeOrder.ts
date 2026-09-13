import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

interface CompleteOrderData {
  salonId: string;
  orderId: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value.trim();
}

export const completeOrder = onCall<CompleteOrderData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const orderId = requireId(request.data?.orderId, "orderId");
  const db = getFirestore();
  const actor = (await db.doc(`users/${uid}`).get()).data();
  if (actor?.salonId !== salonId || !["owner", "staff"].includes(actor?.ruolo)) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone può chiudere un ordine.");
  }

  const orderRef = db.doc(`salons/${salonId}/orders/${orderId}`);
  const saleRef = db.doc(`salons/${salonId}/sales/order_${orderId}`);
  const salonRef = db.doc(`salons/${salonId}`);

  return db.runTransaction(async (transaction) => {
    const [orderSnap, saleSnap, salonSnap] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(saleRef),
      transaction.get(salonRef),
    ]);
    if (!orderSnap.exists) throw new HttpsError("not-found", "Ordine non trovato.");
    const order = orderSnap.data()!;
    if (order.stato === "ritirato") {
      return {
        orderId,
        saleId: saleRef.id,
        alreadyProcessed: true,
        puntiAccreditati: Number(order.pointsEarned) || 0,
      };
    }
    if (order.stato !== "pronto") {
      throw new HttpsError("failed-precondition", "Puoi chiudere soltanto un ordine pronto al ritiro.");
    }
    if (saleSnap.exists) throw new HttpsError("already-exists", "La vendita di questo ordine è già stata registrata.");

    const items = Array.isArray(order.items) ? order.items.map((item: Record<string, unknown>) => ({
      tipo: "prodotto",
      referenceId: requireId(item.productId, "productId"),
      titolo: typeof item.titolo === "string" ? item.titolo : "Prodotto",
      qta: Number.isInteger(item.qta) && Number(item.qta) > 0 ? Number(item.qta) : 1,
      prezzoUnitario: Number.isInteger(item.prezzo) && Number(item.prezzo) >= 0 ? Number(item.prezzo) : 0,
      totale: (Number.isInteger(item.prezzo) && Number(item.prezzo) >= 0 ? Number(item.prezzo) : 0)
        * (Number.isInteger(item.qta) && Number(item.qta) > 0 ? Number(item.qta) : 1),
    })) : [];
    if (!items.length) throw new HttpsError("failed-precondition", "L'ordine non contiene prodotti validi.");
    const subtotale = items.reduce((sum: number, item: { totale: number }) => sum + item.totale, 0);
    const totale = Number.isInteger(order.totale) && Number(order.totale) >= 0 ? Number(order.totale) : subtotale;

    const salon = salonSnap.data() ?? {};
    const cashIntegration = salon.cashIntegration && typeof salon.cashIntegration === "object"
      ? salon.cashIntegration as Record<string, unknown>
      : {};
    const fidelity = salon.fidelity && typeof salon.fidelity === "object"
      ? salon.fidelity as Record<string, unknown>
      : {};
    const clientId = typeof order.clientId === "string" && order.clientId.trim()
      ? requireId(order.clientId, "clientId")
      : null;
    const shouldCredit = Boolean(clientId && cashIntegration.creditLoyaltyFromReceipts === true && fidelity.attiva !== false);
    const pointsPerEuro = Number.isInteger(fidelity.puntiPerEuro) && Number(fidelity.puntiPerEuro) > 0
      ? Number(fidelity.puntiPerEuro)
      : 1;
    const calculatedPoints = shouldCredit ? Math.floor(totale / 100) * pointsPerEuro : 0;
    const accountRef = clientId ? db.doc(`salons/${salonId}/loyaltyAccounts/${clientId}`) : null;
    const loyaltyTransactionRef = accountRef ? accountRef.collection("transactions").doc(saleRef.id) : null;
    const [accountSnap, loyaltyTransactionSnap] = shouldCredit && accountRef && loyaltyTransactionRef
      ? await Promise.all([transaction.get(accountRef), transaction.get(loyaltyTransactionRef)])
      : [null, null];
    const creditedPoints = calculatedPoints > 0 && accountSnap?.exists && !loyaltyTransactionSnap?.exists
      ? calculatedPoints
      : 0;

    transaction.create(saleRef, {
      clientId,
      clientNome: order.clientNome ?? "Cliente",
      orderId,
      date: new Date().toISOString().slice(0, 10),
      stato: "pagata",
      items,
      subtotale,
      sconto: Math.max(0, subtotale - totale),
      totale,
      paymentMethod: "in_salone",
      createdByUserId: uid,
      createdAt: FieldValue.serverTimestamp(),
      paidAt: FieldValue.serverTimestamp(),
      cashRegister: { source: "salon_suite", syncedAt: FieldValue.serverTimestamp() },
      loyaltyPointsCredited: creditedPoints,
    });
    if (creditedPoints > 0 && accountRef && loyaltyTransactionRef && accountSnap) {
      transaction.update(accountRef, {
        punti: (Number(accountSnap.data()?.punti) || 0) + creditedPoints,
        puntiTotali: FieldValue.increment(creditedPoints),
        visite: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(loyaltyTransactionRef, {
        tipo: "accredito",
        punti: creditedPoints,
        importo: totale,
        descrizione: "Ordine prodotti ritirato",
        operatorId: uid,
        saleId: saleRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.update(orderRef, {
      stato: "ritirato",
      paymentMethod: "in_salone",
      pointsEarned: creditedPoints,
      saleId: saleRef.id,
      paidAt: FieldValue.serverTimestamp(),
    });
    return { orderId, saleId: saleRef.id, alreadyProcessed: false, puntiAccreditati: creditedPoints };
  });
});
