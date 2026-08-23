import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listServices, createService, updateService, deleteService,
} from "./service-repo";
import type { Service } from "../domain/models";

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

const sample: Service = {
  titolo: "Taglio", descrizione: "Taglio uomo", prezzo: 2000, durataMin: 30, attivo: true,
};

describe("service-repo", () => {
  it("crea, elenca, aggiorna ed elimina un servizio", async () => {
    const salonId = await newSalon();

    const id = await createService(salonId, sample);
    expect(id).toBeTruthy();

    let list = await listServices(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, titolo: "Taglio", prezzo: 2000, durataMin: 30 });

    await updateService(salonId, id, { prezzo: 2500, attivo: false });
    list = await listServices(salonId);
    expect(list[0].prezzo).toBe(2500);
    expect(list[0].attivo).toBe(false);

    await deleteService(salonId, id);
    expect(await listServices(salonId)).toHaveLength(0);
  });
});
