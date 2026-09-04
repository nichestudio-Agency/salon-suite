import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";
import { createOrder } from "./order";
import { createCoupon } from "./coupon-repo";
import type { Gender } from "../domain/models";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

const send = () =>
  httpsCallable<
    { salonId: string; filtri: { sesso?: string; natoDa?: string; natoA?: string; bookingInactiveDays?: number; productInactiveDays?: number }; titolo: string; testo: string; couponId?: string },
    { campaignId: string; recipientCount: number }
  >(functions, "sendCampaign");

async function clientWithOrder(salonId: string, productId: string, sesso: Gender, dataNascita: string) {
  const email = `cli_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  await registerClient({ email, password: "password123", nome: "Cli", sesso, dataNascita, salonId });
  await createOrder({ salonId, items: [{ productId, qta: 1 }] });
  await signOut(auth);
}

describe("sendCampaign", () => {
  it("conta i destinatari applicando i filtri sesso/età lato server", async () => {
    const ownerEmail = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1000, attivo: true });
    await signOut(auth);

    // clientela: 2 uomini (2000, 1980) + 1 donna (1995)
    await clientWithOrder(salonId, p, "maschile", "2000-05-10");
    await clientWithOrder(salonId, p, "maschile", "1980-03-01");
    await clientWithOrder(salonId, p, "femminile", "1995-07-20");
    await registerClient({ email: `cli_inattivo_${Date.now()}@ex.com`, password: "password123", nome: "Cliente inattivo", sesso: "altro", dataNascita: "1970-01-01", salonId });
    await signOut(auth);

    await signInWithEmailAndPassword(auth, ownerEmail, "password123");

    const tutti = await send()({ salonId, filtri: {}, titolo: "Promo", testo: "Sconti!" });
    expect(tutti.data.recipientCount).toBe(4);

    const soloUomini = await send()({ salonId, filtri: { sesso: "maschile" }, titolo: "Promo", testo: "Sconti!" });
    expect(soloUomini.data.recipientCount).toBe(2);

    const giovani = await send()({ salonId, filtri: { natoDa: "1990-01-01" }, titolo: "Promo", testo: "Sconti!" });
    expect(giovani.data.recipientCount).toBe(2); // nati nel 2000 e 1995

    const senzaAcquisti = await send()({ salonId, filtri: { productInactiveDays: 90 }, titolo: "Ritorna", testo: "Scopri i prodotti" });
    expect(senzaAcquisti.data.recipientCount).toBe(1);
  });

  it("rifiuta un chiamante che non è staff del salone", async () => {
    const ownerEmail = `own2_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S2",
      timezone: "Europe/Rome", orariApertura: {},
    });
    await signOut(auth);
    await registerClient({ email: `intruso_${Date.now()}@ex.com`, password: "password123", nome: "X", sesso: "altro", dataNascita: "1990-01-01" });
    await expect(send()({ salonId, filtri: {}, titolo: "T", testo: "B" })).rejects.toThrow();
  });

  it("rifiuta lo staff di un ALTRO salone", async () => {
    const ownerAEmail = `own3a_${Date.now()}@ex.com`;
    const { salonId: salonAId } = await registerOwner({
      email: ownerAEmail, password: "password123", nomeSalone: "S3A",
      timezone: "Europe/Rome", orariApertura: {},
    });
    await signOut(auth);

    const ownerBEmail = `own3b_${Date.now()}@ex.com`;
    await registerOwner({
      email: ownerBEmail, password: "password123", nomeSalone: "S3B",
      timezone: "Europe/Rome", orariApertura: {},
    });
    // già autenticato come owner B dopo la registrazione: prova a colpire il salone A.
    await expect(
      send()({ salonId: salonAId, filtri: {}, titolo: "T", testo: "B" })
    ).rejects.toThrow();
  });

  it("esclude la clientela di un altro salone dal conteggio (cross-tenant)", async () => {
    const ownerAEmail = `own4a_${Date.now()}@ex.com`;
    const { salonId: salonAId } = await registerOwner({
      email: ownerAEmail, password: "password123", nomeSalone: "S4A",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const pA = await createProduct(salonAId, { titolo: "Cera", descrizione: "", prezzo: 1000, attivo: true });
    await signOut(auth);

    const ownerBEmail = `own4b_${Date.now()}@ex.com`;
    const { salonId: salonBId } = await registerOwner({
      email: ownerBEmail, password: "password123", nomeSalone: "S4B",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const pB = await createProduct(salonBId, { titolo: "Cera", descrizione: "", prezzo: 1000, attivo: true });
    await signOut(auth);

    await clientWithOrder(salonAId, pA, "maschile", "1990-01-01");
    await clientWithOrder(salonBId, pB, "femminile", "1990-01-01");

    await signInWithEmailAndPassword(auth, ownerAEmail, "password123");
    const res = await send()({ salonId: salonAId, filtri: {}, titolo: "Promo", testo: "Sconti!" });
    expect(res.data.recipientCount).toBe(1);
  });

  it("rifiuta un coupon non attivo", async () => {
    const ownerEmail = `own5_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S5",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1000, attivo: true });
    const couponId = await createCoupon(salonId, {
      codice: "SCADUTO", tipo: "percentuale", valore: 10, attivo: false,
    });
    await signOut(auth);

    await clientWithOrder(salonId, p, "maschile", "1990-01-01");

    await signInWithEmailAndPassword(auth, ownerEmail, "password123");
    await expect(
      send()({ salonId, filtri: {}, titolo: "Promo", testo: "Sconti!", couponId })
    ).rejects.toThrow();
  });
});
