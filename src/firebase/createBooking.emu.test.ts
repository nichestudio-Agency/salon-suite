import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signOut } from "firebase/auth";
import { collection, doc, getDocs, query, setDoc, where } from "firebase/firestore";
import { auth, connectEmulators, db } from "./app";
import { registerClient } from "./auth";
import { registerOwner } from "./onboarding";
import { cancelBooking, createBooking, getAvailability, listMyBookings } from "./booking";

beforeAll(() => connectEmulators());
afterEach(async () => {
  await signOut(auth);
});

async function setupBookableSalon() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const { salonId } = await registerOwner({
    email: `owner_${suffix}@ex.com`,
    password: "password123",
    nomeSalone: "Barberia Test",
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
    email: `client_${suffix}@ex.com`,
    password: "password123",
    nome: "Cliente",
    sesso: "altro",
    dataNascita: "1990-01-01",
  });

  return salonId;
}

describe("createBooking", () => {
  it("crea una richiesta usando la durata autorevole del servizio", async () => {
    const salonId = await setupBookableSalon();

    const result = await createBooking({
      salonId,
      operatorId: "op1",
      serviceId: "svc1",
      date: "2026-08-24",
      startMin: 600,
    });

    expect(result).toMatchObject({ endMin: 630, stato: "in_attesa" });
    const bookings = await getDocs(
      query(
        collection(db, `salons/${salonId}/bookings`),
        where("clientId", "==", auth.currentUser?.uid),
      ),
    );
    expect(bookings.docs).toHaveLength(1);
    expect(bookings.docs[0].data()).toMatchObject({
      clientId: auth.currentUser?.uid,
      operatorId: "op1",
      serviceId: "svc1",
      date: "2026-08-24",
      startMin: 600,
      endMin: 630,
      stato: "in_attesa",
    });

    expect(await listMyBookings(salonId)).toHaveLength(1);
    await cancelBooking(salonId, result.bookingId);
    expect((await listMyBookings(salonId))[0].stato).toBe("annullata");
    const availability = await getAvailability({
      salonId,
      operatorId: "op1",
      serviceId: "svc1",
      date: "2026-08-24",
    });
    expect(availability.starts).toContain(600);
  });

  it("fa vincere una sola di due richieste concorrenti sullo stesso slot", async () => {
    const salonId = await setupBookableSalon();
    const input = {
      salonId,
      operatorId: "op1",
      serviceId: "svc1",
      date: "2026-08-24",
      startMin: 660,
    };

    const results = await Promise.allSettled([
      createBooking(input),
      createBooking(input),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const bookings = await getDocs(
      query(
        collection(db, `salons/${salonId}/bookings`),
        where("clientId", "==", auth.currentUser?.uid),
      ),
    );
    expect(bookings.docs).toHaveLength(1);
  });

  it("rifiuta uno slot fuori dagli orari di lavoro", async () => {
    const salonId = await setupBookableSalon();

    await expect(
      createBooking({
        salonId,
        operatorId: "op1",
        serviceId: "svc1",
        date: "2026-08-24",
        startMin: 480,
      }),
    ).rejects.toThrow();
  });
});
