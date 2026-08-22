import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getDoc, doc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("registerOwner", () => {
  it("registra l'owner, crea il salone e restituisce salonId", async () => {
    const email = `titolare_${Date.now()}@ex.com`;
    const res = await registerOwner({
      email,
      password: "password123",
      nomeSalone: "Barberia Centrale",
      timezone: "Europe/Rome",
      orariApertura: { lun: [{ start: 540, end: 1140 }] },
    });
    expect(res.salonId).toBeTruthy();
    expect(auth.currentUser).not.toBeNull();

    const userSnap = await getDoc(doc(db, "users", auth.currentUser!.uid));
    expect(userSnap.data()?.ruolo).toBe("owner");
    expect(userSnap.data()?.salonId).toBe(res.salonId);
  });
});
