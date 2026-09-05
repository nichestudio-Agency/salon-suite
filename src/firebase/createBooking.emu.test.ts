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

async function setupBookableSalon(options: {
  indisponibilita?: Array<{ id: string; dal: string; al: string }>;
  coupon?: { codice: string; tipo: "percentuale" | "fisso"; valore: number; scadenza?: string; dataAppuntamento?: string; attivo: boolean };
} = {}) {
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
    ...(options.indisponibilita ? { indisponibilita: options.indisponibilita } : {}),
  });
  await setDoc(doc(db, `salons/${salonId}/services/svc1`), {
    titolo: "Taglio",
    descrizione: "",
    prezzo: 2000,
    durataMin: 30,
    attivo: true,
  });
  if (options.coupon) {
    await setDoc(doc(db, `salons/${salonId}/coupons/test-coupon`), options.coupon);
  }

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

/**
 * Come setupBookableSalon, ma permette di creare operatore/servizio con
 * `attivo: false`. La scrittura avviene mentre l'owner è ancora autenticato
 * (le rules richiedono isStaffOf(salonId) per scrivere su operators/services).
 */
async function setupSalonWithFlags(opts: { operatorActive: boolean; serviceActive: boolean }) {
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
    attivo: opts.operatorActive,
  });
  await setDoc(doc(db, `salons/${salonId}/services/svc1`), {
    titolo: "Taglio",
    descrizione: "",
    prezzo: 2000,
    durataMin: 30,
    attivo: opts.serviceActive,
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

  it("rifiuta la prenotazione su un operatore non attivo", async () => {
    const salonId = await setupSalonWithFlags({ operatorActive: false, serviceActive: true });

    await expect(
      createBooking({
        salonId,
        operatorId: "op1",
        serviceId: "svc1",
        date: "2026-08-24",
        startMin: 600,
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/failed-precondition|permission-denied|invalid-argument/),
    });
  });

  it("rifiuta la prenotazione su un servizio non attivo", async () => {
    const salonId = await setupSalonWithFlags({ operatorActive: true, serviceActive: false });

    await expect(
      createBooking({
        salonId,
        operatorId: "op1",
        serviceId: "svc1",
        date: "2026-08-24",
        startMin: 600,
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/failed-precondition|permission-denied|invalid-argument/),
    });
  });

  it("rifiuta la chiamata da un account non-cliente (owner)", async () => {
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

    // owner è ancora autenticato (registerOwner non fa signOut): ruolo "owner" != "cliente".
    await expect(
      createBooking({
        salonId,
        operatorId: "op1",
        serviceId: "svc1",
        date: "2026-08-24",
        startMin: 600,
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/failed-precondition|permission-denied|invalid-argument/),
    });
  });

  it("rifiuta uno slot che si sovrappone (non identico) a una prenotazione attiva", async () => {
    const salonId = await setupBookableSalon();

    const first = await createBooking({
      salonId,
      operatorId: "op1",
      serviceId: "svc1",
      date: "2026-08-24",
      startMin: 600,
    });
    expect(first).toMatchObject({ endMin: 630, stato: "in_attesa" });

    // Nuova richiesta che inizia 15' dopo (durataMin=30): [615,645) si sovrappone a [600,630).
    // La production throw distingue esplicitamente questo caso con "already-exists"
    // (slot occupato) da "failed-precondition" (slot fuori disponibilità).
    await expect(
      createBooking({
        salonId,
        operatorId: "op1",
        serviceId: "svc1",
        date: "2026-08-24",
        startMin: 615,
      }),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/already-exists|failed-precondition/),
    });
  });

  it("blocca disponibilità e prenotazione durante un periodo programmato", async () => {
    const salonId = await setupBookableSalon({
      indisponibilita: [{ id: "ferie", dal: "2026-08-24", al: "2026-08-26" }],
    });
    const availability = await getAvailability({
      salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24",
    });
    expect(availability.starts).toEqual([]);
    await expect(createBooking({
      salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24", startMin: 600,
    })).rejects.toMatchObject({ code: expect.stringMatching(/failed-precondition/) });
  });

  it("applica il coupon una sola volta e registra lo sconto nella prenotazione", async () => {
    const salonId = await setupBookableSalon({
      coupon: { codice: "TEST20", tipo: "percentuale", valore: 20, scadenza: "2026-08-31", attivo: true },
    });
    const result = await createBooking({
      salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24", startMin: 600, couponCode: "test20",
    });
    expect(result).toMatchObject({ prezzoOriginale: 2000, sconto: 400, prezzoFinale: 1600 });
    expect((await listMyBookings(salonId))[0]).toMatchObject({
      couponCode: "TEST20", prezzoOriginale: 2000, sconto: 400, prezzoFinale: 1600,
    });
    await expect(createBooking({
      salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24", startMin: 660, couponCode: "TEST20",
    })).rejects.toMatchObject({ code: expect.stringMatching(/already-exists/) });
  });

  it("rifiuta un coupon lampo su una data diversa", async () => {
    const salonId = await setupBookableSalon({
      coupon: { codice: "OGGI25", tipo: "percentuale", valore: 25, scadenza: "2026-08-25", dataAppuntamento: "2026-08-25", attivo: true },
    });
    await expect(createBooking({
      salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24", startMin: 600, couponCode: "OGGI25",
    })).rejects.toMatchObject({ code: expect.stringMatching(/failed-precondition/) });
  });
});
