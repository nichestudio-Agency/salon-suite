import { createHash, timingSafeEqual } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

type ReceiptItem = {
  type: "servizio" | "prodotto";
  title: string;
  quantity: number;
  unitAmount: number;
};

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const first = Buffer.from(left);
  const second = Buffer.from(right);
  return first.length === second.length && timingSafeEqual(first, second);
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseItems(value: unknown, total: number): ReceiptItem[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [{ type: "servizio", title: "Incasso da cassa esterna", quantity: 1, unitAmount: total }];
  }
  if (value.length > 50) throw new Error("too-many-items");
  return value.map((raw) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const type = item.type === "prodotto" ? "prodotto" : "servizio";
    const title = text(item.title, 120);
    const quantity = Number(item.quantity);
    const unitAmount = Number(item.unitAmount);
    if (!title || !Number.isInteger(quantity) || quantity < 1 || quantity > 100 || !Number.isInteger(unitAmount) || unitAmount < 0) {
      throw new Error("invalid-item");
    }
    return { type, title, quantity, unitAmount };
  });
}

export const cashReceiptWebhook = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.set("Allow", "POST").status(405).json({ error: "method_not_allowed" });
    return;
  }
  const body = request.body && typeof request.body === "object"
    ? request.body as Record<string, unknown>
    : {};
  const salonId = text(body.salonId, 120);
  const receiptId = text(body.receiptId, 160);
  const total = Number(body.total);
  const date = text(body.date, 10);
  const authorization = request.get("authorization") ?? "";
  const secret = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!salonId || salonId.includes("/") || !receiptId || !Number.isInteger(total) || total <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    response.status(400).json({ error: "invalid_receipt" });
    return;
  }
  if (!secret) {
    response.status(401).json({ error: "missing_credentials" });
    return;
  }

  const db = getFirestore();
  const connectorRef = db.doc(`salons/${salonId}/privateIntegrations/cash`);
  const salonRef = db.doc(`salons/${salonId}`);
  const [connectorSnap, salonSnap] = await Promise.all([connectorRef.get(), salonRef.get()]);
  const connector = connectorSnap.data();
  const storedHash = typeof connector?.secretHash === "string" ? connector.secretHash : "";
  if (!connectorSnap.exists || connector?.enabled !== true || !storedHash || !safeEqual(hash(secret), storedHash)) {
    response.status(401).json({ error: "invalid_credentials" });
    return;
  }
  if (!salonSnap.exists) {
    response.status(404).json({ error: "salon_not_found" });
    return;
  }

  let items: ReceiptItem[];
  try {
    items = parseItems(body.items, total);
  } catch {
    response.status(400).json({ error: "invalid_items" });
    return;
  }
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitAmount, 0);
  if (subtotal < total) {
    response.status(400).json({ error: "total_exceeds_items" });
    return;
  }
  const receiptHash = hash(receiptId).slice(0, 40);
  const saleRef = db.doc(`salons/${salonId}/sales/external_${receiptHash}`);
  const fidelityCode = text(body.fidelityCode, 80).toUpperCase();
  const accountQuery = fidelityCode
    ? await db.collection(`salons/${salonId}/loyaltyAccounts`).where("codice", "==", fidelityCode).limit(1).get()
    : null;
  const accountRef = accountQuery && !accountQuery.empty ? accountQuery.docs[0].ref : null;
  const visitRef = accountRef ? db.doc(`salons/${salonId}/clientVisits/external_${receiptHash}`) : null;
  const loyaltyTransactionRef = accountRef ? accountRef.collection("transactions").doc(saleRef.id) : null;
  const salon = salonSnap.data() ?? {};
  const cashConfig = salon.cashIntegration && typeof salon.cashIntegration === "object"
    ? salon.cashIntegration as Record<string, unknown>
    : {};
  if (cashConfig.mode !== "api_webhook" || cashConfig.status !== "operativa") {
    response.status(409).json({ error: "connector_not_active" });
    return;
  }
  const fidelity = salon.fidelity && typeof salon.fidelity === "object"
    ? salon.fidelity as Record<string, unknown>
    : {};

  try {
    const result = await db.runTransaction(async (transaction) => {
      const [freshConnectorSnap, existingSale, accountSnap, loyaltyTransactionSnap] = await Promise.all([
        transaction.get(connectorRef),
        transaction.get(saleRef),
        accountRef ? transaction.get(accountRef) : Promise.resolve(null),
        loyaltyTransactionRef ? transaction.get(loyaltyTransactionRef) : Promise.resolve(null),
      ]);
      const freshConnector = freshConnectorSnap.data();
      const freshHash = typeof freshConnector?.secretHash === "string" ? freshConnector.secretHash : "";
      if (!freshConnectorSnap.exists || freshConnector?.enabled !== true || !freshHash || !safeEqual(hash(secret), freshHash)) {
        throw new Error("connector-revoked");
      }
      if (existingSale.exists) {
        return {
          alreadyProcessed: true,
          pointsCredited: Number(existingSale.data()?.loyaltyPointsCredited) || 0,
        };
      }
      const shouldCredit = Boolean(accountSnap?.exists && cashConfig.creditLoyaltyFromReceipts === true && fidelity.attiva !== false);
      const pointsPerEuro = Number.isInteger(fidelity.puntiPerEuro) && Number(fidelity.puntiPerEuro) > 0
        ? Number(fidelity.puntiPerEuro)
        : 1;
      const points = shouldCredit && !loyaltyTransactionSnap?.exists
        ? Math.floor(total / 100) * pointsPerEuro
        : 0;
      const clientName = accountSnap?.exists ? text(accountSnap.data()?.nome, 120) || "Cliente" : "Cliente di passaggio";
      transaction.create(saleRef, {
        clientId: accountRef?.id ?? null,
        clientNome: clientName,
        date,
        stato: "pagata",
        items: items.map((item) => ({
          tipo: item.type,
          titolo: item.title,
          qta: item.quantity,
          prezzoUnitario: item.unitAmount,
          totale: item.quantity * item.unitAmount,
        })),
        subtotale: subtotal,
        sconto: subtotal - total,
        totale: total,
        paymentMethod: text(body.paymentMethod, 40) || "cassa_esterna",
        createdAt: FieldValue.serverTimestamp(),
        paidAt: FieldValue.serverTimestamp(),
        cashRegister: {
          source: "external",
          provider: text(cashConfig.providerName, 120) || "Webhook",
          externalReceiptId: receiptId,
          syncedAt: FieldValue.serverTimestamp(),
        },
        loyaltyPointsCredited: points,
      });
      if (visitRef && accountRef) {
        transaction.create(visitRef, {
          clientId: accountRef.id,
          serviceId: "incasso-esterno",
          serviceTitle: items.map((item) => item.title).join(", ").slice(0, 240),
          date,
          importo: total,
          note: "Registrato da cassa collegata",
          saleId: saleRef.id,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      if (points > 0 && accountRef && accountSnap && loyaltyTransactionRef) {
        transaction.update(accountRef, {
          punti: (Number(accountSnap.data()?.punti) || 0) + points,
          puntiTotali: FieldValue.increment(points),
          visite: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(loyaltyTransactionRef, {
          tipo: "accredito",
          punti: points,
          importo: total,
          descrizione: "Incasso da cassa collegata",
          saleId: saleRef.id,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.update(connectorRef, {
        lastReceiptAt: FieldValue.serverTimestamp(),
        lastReceiptId: receiptId,
      });
      return { alreadyProcessed: false, pointsCredited: points };
    });
    response.status(result.alreadyProcessed ? 200 : 201).json({
      ok: true,
      saleId: saleRef.id,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "connector-revoked") {
      response.status(401).json({ error: "invalid_credentials" });
      return;
    }
    console.error("cashReceiptWebhook", error);
    response.status(500).json({ error: "receipt_processing_failed" });
  }
});
