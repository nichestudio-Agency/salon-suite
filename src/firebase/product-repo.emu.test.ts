import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listProducts, createProduct, updateProduct, deleteProduct,
} from "./product-repo";
import type { Product } from "../domain/models";

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

const sample: Product = {
  titolo: "Cera modellante", descrizione: "Tenuta forte", prezzo: 1500, attivo: true,
};

describe("product-repo", () => {
  it("crea, elenca, aggiorna ed elimina un prodotto", async () => {
    const salonId = await newSalon();

    const id = await createProduct(salonId, sample);
    expect(id).toBeTruthy();

    let list = await listProducts(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, titolo: "Cera modellante", prezzo: 1500 });

    await updateProduct(salonId, id, { prezzo: 1800, attivo: false });
    list = await listProducts(salonId);
    expect(list[0].prezzo).toBe(1800);
    expect(list[0].attivo).toBe(false);

    await deleteProduct(salonId, id);
    expect(await listProducts(salonId)).toHaveLength(0);
  });
});
