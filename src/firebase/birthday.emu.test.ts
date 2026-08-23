import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { getDoc, doc, updateDoc } from "firebase/firestore";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";
import { createOrder } from "./order";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("runBirthdayGreetings", () => {
  it("invia gli auguri ai clienti che compiono gli anni nella data indicata", async () => {
    const ownerEmail = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1000, attivo: true });
    // configura gli auguri
    await updateDoc(doc(db, "salons", salonId), {
      compleanno: { attivo: true, messaggio: "Auguri dal salone!", couponId: null },
    });
    await signOut(auth);

    // cliente che compie gli anni il 15 giugno
    await registerClient({ email: `cli_${Date.now()}@ex.com`, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-06-15" });
    await createOrder({ salonId, items: [{ productId: p, qta: 1 }] });
    const clientUid = auth.currentUser!.uid;
    await signOut(auth);

    // owner lancia gli auguri per il 2026-06-15
    await signInWithEmailAndPassword(auth, ownerEmail, "password123");
    const run = httpsCallable<{ date?: string }, { count: number }>(functions, "runBirthdayGreetings");
    const res = await run({ date: "2026-06-15" });
    expect(res.data.count).toBe(1);

    const notif = await getDoc(doc(db, "salons", salonId, "notifications", `bday_${clientUid}_2026-06-15`));
    expect(notif.exists()).toBe(true);
    expect(notif.data()?.tipo).toBe("compleanno");
  });

  it("rifiuta un chiamante non staff", async () => {
    await registerClient({ email: `x_${Date.now()}@ex.com`, password: "password123", nome: "X", sesso: "altro", dataNascita: "1990-01-01" });
    const run = httpsCallable<{ date?: string }, { count: number }>(functions, "runBirthdayGreetings");
    await expect(run({ date: "2026-06-15" })).rejects.toThrow();
  });
});
