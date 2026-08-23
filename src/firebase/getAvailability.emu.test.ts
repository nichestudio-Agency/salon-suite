import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, connectEmulators, db } from "./app";
import { registerClient } from "./auth";
import { createBooking, getAvailability } from "./booking";
import { registerOwner } from "./onboarding";

beforeAll(() => connectEmulators());
afterEach(async () => {
  await signOut(auth);
});

async function setupBookableSalon() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const { salonId } = await registerOwner({
    email: `owner_slots_${suffix}@ex.com`,
    password: "password123",
    nomeSalone: "Barberia Slot",
    timezone: "Europe/Rome",
    orariApertura: { lun: [{ start: 540, end: 720 }] },
  });
  await setDoc(doc(db, `salons/${salonId}/operators/op1`), {
    nome: "Marco",
    attivo: true,
  });
  await setDoc(doc(db, `salons/${salonId}/services/svc1`), {
    titolo: "Taglio",
    descrizione: "",
    prezzo: 2000,
    durataMin: 30,
    attivo: true,
  });

  await signOut(auth);
  await registerClient({
    email: `client_slots_${suffix}@ex.com`,
    password: "password123",
    nome: "Cliente",
    sesso: "altro",
    dataNascita: "1990-01-01",
  });
  return salonId;
}

describe("getAvailability", () => {
  it("restituisce gli slot validi e rimuove quelli sovrapposti", async () => {
    const salonId = await setupBookableSalon();
    const input = {
      salonId,
      operatorId: "op1",
      serviceId: "svc1",
      date: "2026-08-24",
    };

    const initial = await getAvailability(input);
    expect(initial).toMatchObject({ durationMin: 30, stepMin: 15 });
    expect(initial.starts).toEqual([540, 555, 570, 585, 600, 615, 630, 645, 660, 675, 690]);

    await createBooking({ ...input, startMin: 600 });
    const updated = await getAvailability(input);
    expect(updated.starts).toContain(570);
    expect(updated.starts).toContain(630);
    expect(updated.starts).not.toContain(585);
    expect(updated.starts).not.toContain(600);
    expect(updated.starts).not.toContain(615);
  });
});
