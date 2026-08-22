import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getDoc, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, connectEmulators } from "./app";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

async function newUser() {
  const email = `owner_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  const cred = await createUserWithEmailAndPassword(auth, email, "password123");
  return cred.user.uid;
}

const call = () =>
  httpsCallable<
    { nome: string; timezone: string; orariApertura: Record<string, { start: number; end: number }[]> },
    { salonId: string }
  >(functions, "createSalon");

describe("createSalon", () => {
  it("crea il salone ed eleva l'utente a owner", async () => {
    const uid = await newUser();
    const res = await call()({
      nome: "Salone Mario",
      timezone: "Europe/Rome",
      orariApertura: { lun: [{ start: 540, end: 1140 }] },
    });
    const salonId = res.data.salonId;
    expect(salonId).toBeTruthy();

    const salonSnap = await getDoc(doc(db, "salons", salonId));
    expect(salonSnap.exists()).toBe(true);
    expect(salonSnap.data()?.nome).toBe("Salone Mario");
    expect(salonSnap.data()?.impostazioni?.passoMinuti).toBe(15);

    const userSnap = await getDoc(doc(db, "users", uid));
    expect(userSnap.data()?.ruolo).toBe("owner");
    expect(userSnap.data()?.salonId).toBe(salonId);
  });

  it("rifiuta un utente già legato a un salone", async () => {
    await newUser();
    await call()({ nome: "Uno", timezone: "Europe/Rome", orariApertura: {} });
    await expect(
      call()({ nome: "Due", timezone: "Europe/Rome", orariApertura: {} })
    ).rejects.toThrow();
  });

  it("rifiuta un nome mancante", async () => {
    await newUser();
    await expect(
      call()({ nome: "", timezone: "Europe/Rome", orariApertura: {} })
    ).rejects.toThrow();
  });
});
