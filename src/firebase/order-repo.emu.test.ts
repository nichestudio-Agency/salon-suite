import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";
import { createOrder, listMyOrders } from "./order";
import { listSalonOrders, updateOrderStatus } from "./order-repo";

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
});
