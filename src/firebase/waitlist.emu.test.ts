import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, connectEmulators, db } from "./app";
import { registerClient } from "./auth";
import { cancelBooking, createBooking } from "./booking";
import { registerOwner } from "./onboarding";
import { cancelWaitlist, joinWaitlist, listMyWaitlist } from "./waitlist-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

async function setup() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const { salonId } = await registerOwner({
    email: `owner_wait_${suffix}@ex.com`, password: "password123", nomeSalone: "Test",
    timezone: "Europe/Rome", orariApertura: { lun: [{ start: 540, end: 720 }] },
  });
  await setDoc(doc(db, `salons/${salonId}/operators/op1`), { nome: "Marco", attivo: true });
  await setDoc(doc(db, `salons/${salonId}/services/svc1`), { titolo: "Taglio", descrizione: "", prezzo: 2500, durataMin: 30, attivo: true });
  await signOut(auth);
  await registerClient({ email: `client_wait_${suffix}@ex.com`, password: "password123", nome: "Cliente", sesso: "altro", dataNascita: "1990-01-01", salonId });
  return salonId;
}

async function waitForDocument(path: string) {
  for (let attempt = 0; attempt < 25; attempt++) {
    try {
      const snap = await getDoc(doc(db, path));
      if (snap.exists()) return snap;
    } catch {
      // Le rules non possono autorizzare un documento ancora inesistente.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Documento non creato: ${path}`);
}

describe("lista d'attesa", () => {
  it("iscrive in modo idempotente, permette di annullare e applica le rules", async () => {
    const salonId = await setup();
    const input = { salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24" };
    const first = await joinWaitlist(input);
    const second = await joinWaitlist(input);
    expect(second.entryId).toBe(first.entryId);
    expect(await listMyWaitlist(salonId)).toHaveLength(1);
    await cancelWaitlist(salonId, first.entryId);
    expect(await listMyWaitlist(salonId)).toHaveLength(0);
  });

  it("avvisa il cliente quando una prenotazione libera la fascia", async () => {
    const salonId = await setup();
    const entry = await joinWaitlist({ salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24" });
    const booking = await createBooking({ salonId, operatorId: "op1", serviceId: "svc1", date: "2026-08-24", startMin: 600 });
    await cancelBooking(salonId, booking.bookingId);
    const notification = await waitForDocument(`salons/${salonId}/notifications/waitlist_${entry.entryId}`);
    expect(notification.data()).toMatchObject({ clientId: auth.currentUser?.uid, waitlistEntryId: entry.entryId, title: "Si è liberato un posto" });
    expect((await getDoc(doc(db, `salons/${salonId}/waitlist/${entry.entryId}`))).data()?.status).toBe("notified");
  });
});
