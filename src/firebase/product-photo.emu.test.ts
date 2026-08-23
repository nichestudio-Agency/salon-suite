// @vitest-environment node
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct, uploadProductPhoto } from "./product-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("uploadProductPhoto", () => {
  it("carica una foto e restituisce fotoUrl + fotoPath", async () => {
    const email = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const productId = await createProduct(salonId, {
      titolo: "Shampoo", descrizione: "", prezzo: 900, attivo: true,
    });

    const file = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const res = await uploadProductPhoto(salonId, productId, file, "foto.png");

    expect(res.fotoPath).toBe(`salons/${salonId}/products/${productId}/foto.png`);
    expect(res.fotoUrl).toContain(productId);
  });

  it("un cliente (non staff) NON può caricare foto prodotto", async () => {
    await registerClient({
      email: `cli_${Date.now()}@ex.com`, password: "password123",
      nome: "Cliente", sesso: "maschile", dataNascita: "1990-01-01",
    });
    const file = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    await expect(
      uploadProductPhoto("salonX", "prodX", file, "foto.png")
    ).rejects.toThrow();
  });
});
