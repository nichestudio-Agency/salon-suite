import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, connectEmulators, db } from "./app";
import { registerClient } from "./auth";
import { recordManualSale } from "./cash-integration-repo";
import { registerOwner } from "./onboarding";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("recordManualSale", () => {
  it("registra incasso, passaggio cliente e punti una sola volta", async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ownerEmail = `owner_manual_sale_${suffix}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail,
      password: "password123",
      nomeSalone: "Test",
      timezone: "Europe/Rome",
      orariApertura: {},
    });
    await signOut(auth);
    const client = await registerClient({
      email: `client_manual_sale_${suffix}@ex.com`,
      password: "password123",
      nome: "Anna Test",
      sesso: "femminile",
      dataNascita: "1990-02-03",
      salonId,
    });
    await signOut(auth);
    await signInWithEmailAndPassword(auth, ownerEmail, "password123");
    await setDoc(doc(db, `salons/${salonId}`), {
      cashIntegration: { creditLoyaltyFromReceipts: true },
      fidelity: { attiva: true, puntiPerEuro: 2 },
    }, { merge: true });

    const input = {
      salonId,
      sourceId: `test-${suffix}`,
      clientId: client.uid,
      clientSource: "account" as const,
      amount: 2400,
      description: "Taglio diretto",
      itemType: "servizio" as const,
      date: "2026-09-13",
    };
    const first = await recordManualSale(input);
    const second = await recordManualSale(input);

    expect(first).toMatchObject({ puntiAccreditati: 48, alreadyProcessed: false });
    expect(second).toMatchObject({ saleId: first.saleId, puntiAccreditati: 48, alreadyProcessed: true });
    expect((await getDoc(doc(db, `salons/${salonId}/sales/${first.saleId}`))).data()).toMatchObject({ totale: 2400, loyaltyPointsCredited: 48 });
    expect((await getDoc(doc(db, `salons/${salonId}/clientVisits/${first.saleId}`))).data()).toMatchObject({ clientId: client.uid, importo: 2400 });
    expect((await getDoc(doc(db, `salons/${salonId}/loyaltyAccounts/${client.uid}`))).data()).toMatchObject({ punti: 48, puntiTotali: 48, visite: 1 });
  });
});
