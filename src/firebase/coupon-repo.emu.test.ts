import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listCoupons, createCoupon, updateCoupon, deleteCoupon,
} from "./coupon-repo";
import type { Coupon } from "../domain/models";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

async function newSalon(): Promise<string> {
  const email = `own_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  const { salonId } = await registerOwner({
    email, password: "password123", nomeSalone: "S",
    timezone: "Europe/Rome", orariApertura: {},
  });
  return salonId;
}

const sample: Coupon = {
  codice: "ESTATE20", tipo: "percentuale", valore: 20, attivo: true,
};

describe("coupon-repo", () => {
  it("crea, elenca, aggiorna ed elimina un coupon", async () => {
    const salonId = await newSalon();

    const id = await createCoupon(salonId, sample);
    expect(id).toBeTruthy();

    let list = await listCoupons(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, codice: "ESTATE20", tipo: "percentuale", valore: 20 });

    await updateCoupon(salonId, id, { attivo: false });
    list = await listCoupons(salonId);
    expect(list[0].attivo).toBe(false);

    await deleteCoupon(salonId, id);
    expect(await listCoupons(salonId)).toHaveLength(0);
  });
});
