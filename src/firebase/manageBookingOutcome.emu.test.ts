import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, connectEmulators, db } from "./app";
import { registerClient } from "./auth";
import { createBooking } from "./booking";
import { updateBookingStatus } from "./booking-repo";
import { registerOwner } from "./onboarding";
import { manageBookingOutcome } from "./sales-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

async function confirmedBooking(multiService = false) {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const ownerEmail = `owner_outcome_${suffix}@ex.com`;
  const { salonId } = await registerOwner({
    email: ownerEmail, password: "password123", nomeSalone: "Test",
    timezone: "Europe/Rome", orariApertura: { lun: [{ start: 540, end: 720 }] },
  });
  await setDoc(doc(db, `salons/${salonId}/operators/op1`), { nome: "Marco", attivo: true });
  await setDoc(doc(db, `salons/${salonId}/services/svc1`), { titolo: "Taglio", descrizione: "", prezzo: 2500, durataMin: 30, attivo: true });
  await setDoc(doc(db, `salons/${salonId}/services/svc2`), { titolo: "Barba", descrizione: "", prezzo: 1000, durataMin: 15, attivo: true });
  await signOut(auth);
  const client = await registerClient({ email: `client_${suffix}@ex.com`, password: "password123", nome: "Cliente", sesso: "altro", dataNascita: "1990-01-01", salonId });
  const created = await createBooking({ salonId, operatorId: "op1", serviceId: "svc1", ...(multiService ? { serviceIds: ["svc1", "svc2"] } : {}), date: "2026-08-24", startMin: 600 });
  await signOut(auth);
  await signInWithEmailAndPassword(auth, ownerEmail, "password123");
  await updateBookingStatus(salonId, created.bookingId, "confermata");
  return { salonId, bookingId: created.bookingId, clientId: client.uid };
}

describe("manageBookingOutcome", () => {
  it("chiude la prenotazione e crea una sola vendita autorevole", async () => {
    const { salonId, bookingId } = await confirmedBooking();
    const first = await manageBookingOutcome({ salonId, bookingId, outcome: "completata", performedByOperatorId: "op1" });
    const second = await manageBookingOutcome({ salonId, bookingId, outcome: "completata", performedByOperatorId: "op1" });

    expect(first).toMatchObject({ stato: "completata", saleId: `booking_${bookingId}`, alreadyProcessed: false });
    expect(second.alreadyProcessed).toBe(true);
    expect((await getDoc(doc(db, `salons/${salonId}/bookings/${bookingId}`))).data()).toMatchObject({ stato: "completata", performedByOperatorId: "op1", saleId: `booking_${bookingId}` });
    expect((await getDoc(doc(db, `salons/${salonId}/sales/booking_${bookingId}`))).data()).toMatchObject({ stato: "pagata", totale: 2500, performedByOperatorId: "op1" });
  });

  it("registra il no-show senza creare ricavi", async () => {
    const { salonId, bookingId } = await confirmedBooking();
    const result = await manageBookingOutcome({ salonId, bookingId, outcome: "no_show" });
    expect(result).toMatchObject({ stato: "no_show", saleId: null });
    expect((await getDoc(doc(db, `salons/${salonId}/sales/booking_${bookingId}`))).exists()).toBe(false);
  });

  it("registra ogni servizio della prenotazione nella vendita", async () => {
    const { salonId, bookingId } = await confirmedBooking(true);
    await manageBookingOutcome({ salonId, bookingId, outcome: "completata", performedByOperatorId: "op1" });
    const sale = (await getDoc(doc(db, `salons/${salonId}/sales/booking_${bookingId}`))).data();
    expect(sale).toMatchObject({ subtotale: 3500, totale: 3500 });
    expect(sale?.items).toHaveLength(2);
    expect(sale?.items.map((item: { referenceId: string }) => item.referenceId)).toEqual(["svc1", "svc2"]);
  });

  it("accredita la fidelity insieme alla vendita quando l'automazione è attiva", async () => {
    const { salonId, bookingId, clientId } = await confirmedBooking();
    await setDoc(doc(db, `salons/${salonId}`), {
      cashIntegration: { creditLoyaltyFromReceipts: true },
      fidelity: { attiva: true, puntiPerEuro: 2 },
    }, { merge: true });

    const result = await manageBookingOutcome({ salonId, bookingId, outcome: "completata", performedByOperatorId: "op1" });
    expect(result.puntiAccreditati).toBe(50);
    expect((await getDoc(doc(db, `salons/${salonId}/loyaltyAccounts/${clientId}`))).data()).toMatchObject({ punti: 50, puntiTotali: 50, visite: 1 });
    expect((await getDoc(doc(db, `salons/${salonId}/loyaltyAccounts/${clientId}/transactions/booking_${bookingId}`))).data()).toMatchObject({ tipo: "accredito", punti: 50, importo: 2500 });
  });
});
