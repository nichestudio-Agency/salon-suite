import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

interface RecordManualSaleData {
  salonId: string;
  sourceId: string;
  clientId?: string;
  clientSource?: "account" | "manual";
  amount: number;
  description: string;
  itemType: "servizio" | "prodotto";
  date: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value.trim();
}

export const recordManualSale = onCall<RecordManualSaleData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const salonId = requireId(request.data?.salonId, "salonId");
  const sourceId = requireId(request.data?.sourceId, "sourceId");
  const amount = request.data?.amount;
  const description = typeof request.data?.description === "string" ? request.data.description.trim() : "";
  const itemType = request.data?.itemType;
  const date = request.data?.date;
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpsError("invalid-argument", "Importo non valido.");
  if (!description) throw new HttpsError("invalid-argument", "Descrizione obbligatoria.");
  if (itemType !== "servizio" && itemType !== "prodotto") throw new HttpsError("invalid-argument", "Tipo di incasso non valido.");
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpsError("invalid-argument", "Data non valida.");

  const db = getFirestore();
  const actor = (await db.doc(`users/${uid}`).get()).data();
  if (actor?.salonId !== salonId || !["owner", "staff"].includes(actor?.ruolo)) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone può registrare un incasso.");
  }

  const clientId = request.data.clientId ? requireId(request.data.clientId, "clientId") : null;
  const clientSource = clientId ? request.data.clientSource : undefined;
  if (clientId && clientSource !== "account" && clientSource !== "manual") {
    throw new HttpsError("invalid-argument", "Origine cliente non valida.");
  }
  const clientRef = clientId
    ? db.doc(clientSource === "manual" ? `salons/${salonId}/clients/${clientId}` : `users/${clientId}`)
    : null;
  const salonRef = db.doc(`salons/${salonId}`);
  const saleRef = db.doc(`salons/${salonId}/sales/manual_${sourceId}`);
  const visitRef = clientId ? db.doc(`salons/${salonId}/clientVisits/manual_${sourceId}`) : null;

  return db.runTransaction(async (transaction) => {
    const [salonSnap, existingSale, clientSnap] = await Promise.all([
      transaction.get(salonRef),
      transaction.get(saleRef),
      clientRef ? transaction.get(clientRef) : Promise.resolve(null),
    ]);
    if (existingSale.exists) {
      return {
        saleId: saleRef.id,
        alreadyProcessed: true,
        puntiAccreditati: Number(existingSale.data()?.loyaltyPointsCredited) || 0,
      };
    }
    if (clientId && (!clientSnap?.exists || (clientSource === "account" && clientSnap.data()?.salonId !== salonId))) {
      throw new HttpsError("not-found", "Cliente non trovato in questo salone.");
    }

    const salon = salonSnap.data() ?? {};
    const cashIntegration = salon.cashIntegration && typeof salon.cashIntegration === "object"
      ? salon.cashIntegration as Record<string, unknown>
      : {};
    const fidelity = salon.fidelity && typeof salon.fidelity === "object"
      ? salon.fidelity as Record<string, unknown>
      : {};
    const shouldCredit = Boolean(clientId && clientSource === "account" && cashIntegration.creditLoyaltyFromReceipts === true && fidelity.attiva !== false);
    const pointsPerEuro = Number.isInteger(fidelity.puntiPerEuro) && Number(fidelity.puntiPerEuro) > 0 ? Number(fidelity.puntiPerEuro) : 1;
    const calculatedPoints = shouldCredit ? Math.floor(amount / 100) * pointsPerEuro : 0;
    const accountRef = shouldCredit && clientId ? db.doc(`salons/${salonId}/loyaltyAccounts/${clientId}`) : null;
    const loyaltyTransactionRef = accountRef ? accountRef.collection("transactions").doc(saleRef.id) : null;
    const [accountSnap, loyaltyTransactionSnap] = accountRef && loyaltyTransactionRef
      ? await Promise.all([transaction.get(accountRef), transaction.get(loyaltyTransactionRef)])
      : [null, null];
    const creditedPoints = calculatedPoints > 0 && accountSnap?.exists && !loyaltyTransactionSnap?.exists ? calculatedPoints : 0;
    const clientName = typeof clientSnap?.data()?.nome === "string" ? clientSnap.data()!.nome : "Cliente di passaggio";

    transaction.create(saleRef, {
      clientId,
      clientNome: clientName,
      date,
      stato: "pagata",
      items: [{ tipo: itemType, titolo: description, qta: 1, prezzoUnitario: amount, totale: amount }],
      subtotale: amount,
      sconto: 0,
      totale: amount,
      paymentMethod: "in_salone",
      createdByUserId: uid,
      createdAt: FieldValue.serverTimestamp(),
      paidAt: FieldValue.serverTimestamp(),
      cashRegister: { source: "salon_suite", syncedAt: FieldValue.serverTimestamp() },
      loyaltyPointsCredited: creditedPoints,
    });
    if (visitRef && clientId) {
      transaction.create(visitRef, {
        clientId,
        serviceId: itemType === "servizio" ? "incasso-manuale" : "acquisto-prodotto",
        serviceTitle: description,
        date,
        importo: amount,
        note: "Registrato dalla cassa manuale",
        saleId: saleRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
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
        importo: amount,
        descrizione: description,
        operatorId: uid,
        saleId: saleRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return { saleId: saleRef.id, alreadyProcessed: false, puntiAccreditati: creditedPoints };
  });
});
