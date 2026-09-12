import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerClient, signIn } from "./auth";
import { registerOwner } from "./onboarding";
import { creditLoyaltyPoints, getMyLoyalty, lookupLoyaltyCard, redeemLoyaltyReward } from "./loyalty-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("loyalty program", () => {
  it("crea la card, accredita solo dallo staff e riscatta alla soglia", async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ownerEmail = `owner_fidelity_${suffix}@example.com`;
    const password = "password123";
    const { salonId } = await registerOwner({ email: ownerEmail, password, nomeSalone: "Club Test", timezone: "Europe/Rome", orariApertura: {} });
    await signOut(auth);

    const client = await registerClient({ email: `client_fidelity_${suffix}@example.com`, password, nome: "Marta Test", sesso: "femminile", dataNascita: "1992-06-11", salonId });
    const mine = await getMyLoyalty(salonId);
    expect(mine.account).toMatchObject({ clientId: client.uid, punti: 0, visite: 0 });
    expect(mine.account?.codice).toMatch(/^CARD-[A-F0-9]{8}$/);
    await expect(creditLoyaltyPoints(salonId, client.uid, 3200, "Tentativo cliente")).rejects.toThrow();

    await signOut(auth);
    await signIn(ownerEmail, password);
    const first = await creditLoyaltyPoints(salonId, client.uid, 3250, "Taglio");
    expect(first.account).toMatchObject({ punti: 32, visite: 1 });
    await expect(redeemLoyaltyReward(salonId, client.uid)).rejects.toThrow();
    const second = await creditLoyaltyPoints(salonId, client.uid, 6800, "Prodotti");
    expect(second.account?.punti).toBe(100);
    const redeemed = await redeemLoyaltyReward(salonId, client.uid);
    expect(redeemed.account).toMatchObject({ punti: 0, puntiRiscattati: 100, visite: 2 });

    const found = await lookupLoyaltyCard(salonId, mine.account!.codice);
    expect(found.account?.nome).toBe("Marta Test");
  });
});
