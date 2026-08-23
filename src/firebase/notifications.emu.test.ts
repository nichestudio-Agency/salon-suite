import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, connectEmulators, db } from "./app";
import { registerClient, signIn } from "./auth";
import { createBooking } from "./booking";
import { updateBookingStatus } from "./booking-repo";
import { registerOwner } from "./onboarding";

beforeAll(() => connectEmulators());
afterEach(async () => {
  await signOut(auth);
});

async function waitForNotification(path: string) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const snap = await getDoc(doc(db, path));
    if (snap.exists()) return snap.data();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Notifica non creata entro il timeout");
}

describe("notifiche stato prenotazione", () => {
  it("accoda email e notifica quando il salone conferma", async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const ownerEmail = `owner_notify_${suffix}@ex.com`;
    const password = "password123";
    const { salonId } = await registerOwner({
      email: ownerEmail,
      password,
      nomeSalone: "Barberia Notify",
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
      email: `client_notify_${suffix}@ex.com`,
      password,
      nome: "Giulia",
      sesso: "femminile",
      dataNascita: "1990-01-01",
    });
    const booking = await createBooking({
      salonId,
      operatorId: "op1",
      serviceId: "svc1",
      date: "2026-08-24",
      startMin: 600,
    });

    await signOut(auth);
    await signIn(ownerEmail, password);
    await updateBookingStatus(salonId, booking.bookingId, "confermata");

    const notification = await waitForNotification(
      `salons/${salonId}/notifications/${booking.bookingId}_confermata`,
    );
    expect(notification).toMatchObject({
      bookingId: booking.bookingId,
      clientNome: "Giulia",
      stato: "confermata",
      channels: {
        email: { status: "queued" },
        push: { status: "unavailable" },
      },
    });
  });
});
