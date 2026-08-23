import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { getDoc, doc, updateDoc } from "firebase/firestore";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("notifyOrderStatus", () => {
  it("crea una notifica quando l'ordine diventa 'pronto'", async () => {
    // salone + prodotto
    const email = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "S", timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true });
    await signOut(auth);

    // cliente crea l'ordine
    const cliEmail = `cli_${Date.now()}@ex.com`;
    await registerClient({ email: cliEmail, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-01-01" });
    const call = httpsCallable<{ salonId: string; items: { productId: string; qta: number }[] }, { orderId: string }>(functions, "createOrder");
    const res = await call({ salonId, items: [{ productId: p, qta: 1 }] });
    const orderId = res.data.orderId;
    await signOut(auth);

    // lo staff (owner) marca 'pronto' — consentito dalle regole ordini (Task 4)
    await signInWithEmailAndPassword(auth, email, "password123");
    await updateDoc(doc(db, "salons", salonId, "orders", orderId), { stato: "pronto" });

    // il trigger crea salons/{salonId}/notifications/{orderId}_pronto (con attesa)
    const notifId = `${orderId}_pronto`;
    const notifRef = doc(db, "salons", salonId, "notifications", notifId);
    await expect
      .poll(async () => (await getDoc(notifRef)).exists(), { timeout: 8000, interval: 300 })
      .toBe(true);
    const data = (await getDoc(notifRef)).data();
    expect(data?.stato).toBe("pronto");
  });
});
