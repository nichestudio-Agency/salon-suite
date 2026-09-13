import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, connectEmulators, db } from "./app";
import { manageCashConnector } from "./cash-integration-repo";
import { registerOwner } from "./onboarding";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("cashReceiptWebhook", () => {
  it("autentica, registra e rende idempotente una ricevuta esterna", async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ownerEmail = `owner_webhook_${suffix}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail,
      password: "password123",
      nomeSalone: "Webhook Test",
      timezone: "Europe/Rome",
      orariApertura: {},
    });
    await setDoc(doc(db, `salons/${salonId}`), {
      cashIntegration: { creditLoyaltyFromReceipts: true },
      fidelity: { attiva: true, puntiPerEuro: 2 },
    }, { merge: true });
    const clientId = `client-${suffix}`;
    await setDoc(doc(db, `salons/${salonId}/loyaltyAccounts/${clientId}`), {
      clientId,
      codice: "CARD-WEBHOOK",
      nome: "Cliente Webhook",
      email: "client@example.com",
      punti: 0,
      puntiTotali: 0,
      puntiRiscattati: 0,
      visite: 0,
    });

    const credential = await manageCashConnector(salonId, "issue");
    expect(credential.secret).toMatch(/^ss_live_/);
    const url = "http://127.0.0.1:5001/demo-barbershop/us-central1/cashReceiptWebhook";
    const payload = {
      salonId,
      receiptId: `receipt-${suffix}`,
      date: "2026-09-13",
      total: 2400,
      fidelityCode: "CARD-WEBHOOK",
      items: [{ type: "servizio", title: "Taglio", quantity: 1, unitAmount: 2400 }],
    };
    const send = (secret: string) => fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect((await send("ss_live_wrong")).status).toBe(401);
    const first = await send(credential.secret!);
    const firstBody = await first.json() as { saleId: string; pointsCredited: number; alreadyProcessed: boolean };
    expect(first.status).toBe(201);
    expect(firstBody).toMatchObject({ pointsCredited: 48, alreadyProcessed: false });

    const repeated = await send(credential.secret!);
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ saleId: firstBody.saleId, pointsCredited: 48, alreadyProcessed: true });
    expect((await getDoc(doc(db, `salons/${salonId}/sales/${firstBody.saleId}`))).data()).toMatchObject({
      totale: 2400,
      loyaltyPointsCredited: 48,
      cashRegister: { source: "external", externalReceiptId: payload.receiptId },
    });
    expect((await getDoc(doc(db, `salons/${salonId}/loyaltyAccounts/${clientId}`))).data()).toMatchObject({
      punti: 48,
      puntiTotali: 48,
      visite: 1,
    });
    await manageCashConnector(salonId, "revoke");
    expect((await send(credential.secret!)).status).toBe(401);
  });
});
