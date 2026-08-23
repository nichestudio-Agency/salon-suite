import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getDoc, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { auth, db, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

const call = () =>
  httpsCallable<
    { salonId: string; items: { productId: string; qta: number }[] },
    { orderId: string; totale: number; stato: string }
  >(functions, "createOrder");

async function salonWithProducts() {
  const email = `own_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  const { salonId } = await registerOwner({
    email, password: "password123", nomeSalone: "S",
    timezone: "Europe/Rome", orariApertura: {},
  });
  const p1 = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true });
  const p2 = await createProduct(salonId, { titolo: "Shampoo", descrizione: "", prezzo: 900, attivo: true });
  const pOff = await createProduct(salonId, { titolo: "Vecchio", descrizione: "", prezzo: 500, attivo: false });
  await signOut(auth);
  return { salonId, p1, p2, pOff };
}

async function asClient() {
  const email = `cli_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  await registerClient({ email, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-01-01" });
}

describe("createOrder", () => {
  it("crea l'ordine col totale calcolato dai prezzi autorevoli", async () => {
    const { salonId, p1, p2 } = await salonWithProducts();
    await asClient();
    const res = await call()({ salonId, items: [{ productId: p1, qta: 2 }, { productId: p2, qta: 1 }] });
    expect(res.data.totale).toBe(1500 * 2 + 900); // 3900
    expect(res.data.stato).toBe("in_attesa");

    const snap = await getDoc(doc(db, "salons", salonId, "orders", res.data.orderId));
    expect(snap.data()?.items).toHaveLength(2);
    expect(snap.data()?.clientId).toBe(auth.currentUser!.uid);
  });

  it("rifiuta un carrello vuoto", async () => {
    const { salonId } = await salonWithProducts();
    await asClient();
    await expect(call()({ salonId, items: [] })).rejects.toThrow();
  });

  it("rifiuta un prodotto inattivo", async () => {
    const { salonId, pOff } = await salonWithProducts();
    await asClient();
    await expect(call()({ salonId, items: [{ productId: pOff, qta: 1 }] })).rejects.toThrow();
  });

  it("rifiuta un non-cliente (owner)", async () => {
    const email = `own2_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "S2", timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "X", descrizione: "", prezzo: 100, attivo: true });
    // ancora loggato come owner
    await expect(call()({ salonId, items: [{ productId: p, qta: 1 }] })).rejects.toThrow();
  });
});
