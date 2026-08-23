import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listOperators, createOperator, updateOperator, deleteOperator,
} from "./operator-repo";

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

describe("operator-repo", () => {
  it("crea, elenca, aggiorna (attivo + orari) ed elimina un operatore", async () => {
    const salonId = await newSalon();

    const id = await createOperator(salonId, { nome: "Marco", attivo: true });
    let list = await listOperators(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, nome: "Marco", attivo: true });

    await updateOperator(salonId, id, {
      attivo: false,
      orariPersonalizzati: { lun: [{ start: 600, end: 780 }] },
    });
    list = await listOperators(salonId);
    expect(list[0].attivo).toBe(false);
    expect(list[0].orariPersonalizzati?.lun).toEqual([{ start: 600, end: 780 }]);

    await deleteOperator(salonId, id);
    expect(await listOperators(salonId)).toHaveLength(0);
  });
});
