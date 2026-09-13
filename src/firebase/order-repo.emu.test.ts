import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, connectEmulators, db } from "./app";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";
import { createOrder, listMyOrders } from "./order";
import { completeOrder, listSalonOrders, updateOrderStatus } from "./order-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("order repos", () => {
  it("cliente crea e vede il proprio ordine; salone lo elenca e ne cambia stato", async () => {
    const ownerEmail = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true });
    await signOut(auth);

    // cliente
    const cliEmail = `cli_${Date.now()}@ex.com`;
    await registerClient({ email: cliEmail, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-01-01" });
    const { orderId } = await createOrder({ salonId, items: [{ productId: p, qta: 2 }] });
    const mine = await listMyOrders(salonId);
    expect(mine).toHaveLength(1);
    expect(mine[0].totale).toBe(3000);
    await signOut(auth);

    // salone
    await signInWithEmailAndPassword(auth, ownerEmail, "password123");
    const salonOrders = await listSalonOrders(salonId);
    expect(salonOrders.some((o) => o.id === orderId)).toBe(true);
    await updateOrderStatus(salonId, orderId, "pronto");
    const after = await listSalonOrders(salonId);
    expect(after.find((o) => o.id === orderId)?.stato).toBe("pronto");
  });

  it("registra vendita e fidelity quando il cliente ritira l'ordine", async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ownerEmail = `own_checkout_${suffix}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const productId = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true });
    await signOut(auth);
    const client = await registerClient({ email: `cli_checkout_${suffix}@ex.com`, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-01-01", salonId });
    const { orderId } = await createOrder({ salonId, items: [{ productId, qta: 2 }] });
    await signOut(auth);
    await signInWithEmailAndPassword(auth, ownerEmail, "password123");
    await setDoc(doc(db, `salons/${salonId}`), {
      cashIntegration: { creditLoyaltyFromReceipts: true }, fidelity: { attiva: true, puntiPerEuro: 2 },
    }, { merge: true });
    await updateOrderStatus(salonId, orderId, "pronto");

    const result = await completeOrder(salonId, orderId);
    expect(result).toMatchObject({ saleId: `order_${orderId}`, puntiAccreditati: 60, alreadyProcessed: false });
    expect((await getDoc(doc(db, `salons/${salonId}/orders/${orderId}`))).data()).toMatchObject({ stato: "ritirato", pointsEarned: 60, saleId: `order_${orderId}` });
    expect((await getDoc(doc(db, `salons/${salonId}/sales/order_${orderId}`))).data()).toMatchObject({ stato: "pagata", totale: 3000, loyaltyPointsCredited: 60 });
    expect((await getDoc(doc(db, `salons/${salonId}/loyaltyAccounts/${client.uid}`))).data()).toMatchObject({ punti: 60, puntiTotali: 60, visite: 1 });
  });
});
