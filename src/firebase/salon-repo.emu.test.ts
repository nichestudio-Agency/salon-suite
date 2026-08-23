import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { getSalon, updateOpeningHours } from "./salon-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("salon-repo", () => {
  it("legge il salone e aggiorna gli orari di apertura", async () => {
    const email = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "Barberia X",
      timezone: "Europe/Rome", orariApertura: { lun: [{ start: 540, end: 1140 }] },
    });

    const salon = await getSalon(salonId);
    expect(salon?.nome).toBe("Barberia X");
    expect(salon?.orariApertura.lun).toEqual([{ start: 540, end: 1140 }]);

    await updateOpeningHours(salonId, { mar: [{ start: 600, end: 720 }] });
    const updated = await getSalon(salonId);
    expect(updated?.orariApertura.mar).toEqual([{ start: 600, end: 720 }]);
  });
});
