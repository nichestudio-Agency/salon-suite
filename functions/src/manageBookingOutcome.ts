import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

type BookingOutcome = "completata" | "no_show";

interface ManageBookingOutcomeData {
  salonId: string;
  bookingId: string;
  outcome: BookingOutcome;
  performedByOperatorId?: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value.trim();
}

export const manageBookingOutcome = onCall<ManageBookingOutcomeData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const bookingId = requireId(request.data?.bookingId, "bookingId");
  const outcome = request.data?.outcome;
  if (outcome !== "completata" && outcome !== "no_show") {
    throw new HttpsError("invalid-argument", "Esito appuntamento non valido.");
  }

  const db = getFirestore();
  const actorSnap = await db.doc(`users/${uid}`).get();
  const actor = actorSnap.data();
  if (!actorSnap.exists || actor?.salonId !== salonId || !["owner", "staff"].includes(actor?.ruolo)) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone può chiudere un appuntamento.");
  }

  const bookingRef = db.doc(`salons/${salonId}/bookings/${bookingId}`);
  const saleRef = db.doc(`salons/${salonId}/sales/booking_${bookingId}`);

  return db.runTransaction(async (transaction) => {
    const bookingSnap = await transaction.get(bookingRef);
    if (!bookingSnap.exists) throw new HttpsError("not-found", "Appuntamento non trovato.");
    const booking = bookingSnap.data()!;

    if (booking.stato === outcome) {
      return { bookingId, stato: outcome, saleId: outcome === "completata" ? saleRef.id : null, alreadyProcessed: true };
    }
    if (booking.stato !== "confermata") {
      throw new HttpsError("failed-precondition", "Puoi chiudere soltanto un appuntamento confermato.");
    }

    if (outcome === "no_show") {
      transaction.update(bookingRef, {
        stato: "no_show",
        completedAt: FieldValue.serverTimestamp(),
        updatedByUserId: uid,
      });
      return { bookingId, stato: outcome, saleId: null, alreadyProcessed: false };
    }

    const operatorId = request.data.performedByOperatorId
      ? requireId(request.data.performedByOperatorId, "performedByOperatorId")
      : requireId(booking.operatorId, "operatorId");
    const snapshotItems = Array.isArray(booking.serviceItems)
      ? booking.serviceItems.filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      : [];
    const serviceIds = snapshotItems.length
      ? snapshotItems.map((item) => requireId(item.serviceId, "serviceId"))
      : [requireId(booking.serviceId, "serviceId")];
    const [operatorSnap, existingSale, ...serviceSnaps] = await Promise.all([
      transaction.get(db.doc(`salons/${salonId}/operators/${operatorId}`)),
      transaction.get(saleRef),
      ...serviceIds.map((serviceId) => transaction.get(db.doc(`salons/${salonId}/services/${serviceId}`))),
    ]);
    if (serviceSnaps.some((snap) => !snap.exists)) throw new HttpsError("failed-precondition", "Uno dei servizi dell'appuntamento non esiste più.");
    if (!operatorSnap.exists) throw new HttpsError("failed-precondition", "L'operatore selezionato non esiste.");
    if (existingSale.exists) throw new HttpsError("already-exists", "La vendita di questo appuntamento è già stata registrata.");

    const sourceItems = serviceIds.map((serviceId, index) => {
      const snapshotItem = snapshotItems[index];
      const service = serviceSnaps[index].data()!;
      return {
        serviceId,
        titolo: typeof snapshotItem?.titolo === "string" ? snapshotItem.titolo : service.titolo ?? "Servizio",
        prezzo: Number.isInteger(snapshotItem?.prezzo) ? Number(snapshotItem.prezzo) : Number(service.prezzo) || 0,
      };
    });
    const itemSubtotal = sourceItems.reduce((sum, item) => sum + item.prezzo, 0);
    const prezzoOriginale = Number.isInteger(booking.prezzoOriginale)
      ? Number(booking.prezzoOriginale)
      : itemSubtotal;
    const sconto = Number.isInteger(booking.sconto) ? Math.min(prezzoOriginale, Math.max(0, Number(booking.sconto))) : 0;
    const totale = Number.isInteger(booking.prezzoFinale)
      ? Math.max(0, Number(booking.prezzoFinale))
      : Math.max(0, prezzoOriginale - sconto);

    let remainingDiscount = sconto;
    let remainingSubtotal = itemSubtotal;
    const items = sourceItems.map((item, index) => {
      const lineDiscount = index === sourceItems.length - 1
        ? Math.min(item.prezzo, remainingDiscount)
        : Math.min(item.prezzo, remainingSubtotal > 0 ? Math.round(remainingDiscount * item.prezzo / remainingSubtotal) : 0);
      remainingDiscount -= lineDiscount;
      remainingSubtotal -= item.prezzo;
      return { tipo: "servizio", referenceId: item.serviceId, titolo: item.titolo, qta: 1, prezzoUnitario: item.prezzo, totale: item.prezzo - lineDiscount, performedByOperatorId: operatorId };
    });

    transaction.create(saleRef, {
      clientId: booking.clientId,
      clientNome: booking.clientNome ?? "Cliente",
      bookingId,
      date: booking.date,
      stato: "pagata",
      items,
      subtotale: prezzoOriginale,
      sconto,
      totale,
      paymentMethod: "in_salone",
      performedByOperatorId: operatorId,
      createdByUserId: uid,
      createdAt: FieldValue.serverTimestamp(),
      paidAt: FieldValue.serverTimestamp(),
    });
    transaction.update(bookingRef, {
      stato: "completata",
      performedByOperatorId: operatorId,
      saleId: saleRef.id,
      completedAt: FieldValue.serverTimestamp(),
      updatedByUserId: uid,
    });

    return { bookingId, stato: outcome, saleId: saleRef.id, alreadyProcessed: false };
  });
});
