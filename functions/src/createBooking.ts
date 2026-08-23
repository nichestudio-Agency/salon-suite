import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  computeAvailableStartTimes,
  isValidDateKey,
  weekdayOf,
  type Interval,
  type WeeklyHours,
} from "./booking-core.js";

if (getApps().length === 0) initializeApp();

interface CreateBookingData {
  salonId: string;
  operatorId: string;
  serviceId: string;
  date: string;
  startMin: number;
}

interface SalonData {
  orariApertura?: WeeklyHours;
  impostazioni?: { passoMinuti?: number };
}

interface OperatorData {
  attivo?: boolean;
  orariPersonalizzati?: WeeklyHours;
}

interface ServiceData {
  attivo?: boolean;
  durataMin?: number;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value;
}

function overlaps(start: number, end: number, interval: Interval): boolean {
  return start < interval.end && end > interval.start;
}

export const createBooking = onCall<CreateBookingData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const operatorId = requireId(request.data?.operatorId, "operatorId");
  const serviceId = requireId(request.data?.serviceId, "serviceId");
  const date = request.data?.date;
  const startMin = request.data?.startMin;

  if (typeof date !== "string" || !isValidDateKey(date)) {
    throw new HttpsError("invalid-argument", "Data non valida.");
  }
  if (!Number.isInteger(startMin) || startMin < 0 || startMin >= 24 * 60) {
    throw new HttpsError("invalid-argument", "Orario non valido.");
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const salonRef = db.doc(`salons/${salonId}`);
  const operatorRef = db.doc(`salons/${salonId}/operators/${operatorId}`);
  const serviceRef = db.doc(`salons/${salonId}/services/${serviceId}`);
  const bookingRef = db.collection(`salons/${salonId}/bookings`).doc();
  const dayMutexRef = db.doc(`salons/${salonId}/_bookingDays/${operatorId}_${date}`);

  const result = await db.runTransaction(async (transaction) => {
    const userSnap = await transaction.get(userRef);
    const salonSnap = await transaction.get(salonRef);
    const operatorSnap = await transaction.get(operatorRef);
    const serviceSnap = await transaction.get(serviceRef);
    await transaction.get(dayMutexRef);

    if (!userSnap.exists || userSnap.data()?.ruolo !== "cliente") {
      throw new HttpsError("permission-denied", "Solo un cliente può prenotare.");
    }
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Salone non trovato.");
    }
    if (!operatorSnap.exists || operatorSnap.data()?.attivo !== true) {
      throw new HttpsError("failed-precondition", "Operatore non disponibile.");
    }
    if (!serviceSnap.exists || serviceSnap.data()?.attivo !== true) {
      throw new HttpsError("failed-precondition", "Servizio non disponibile.");
    }

    const user = userSnap.data() as { nome?: string; email?: string };
    const salon = salonSnap.data() as SalonData;
    const operator = operatorSnap.data() as OperatorData;
    const service = serviceSnap.data() as ServiceData;
    const durationMin = service.durataMin;
    const stepMin = salon.impostazioni?.passoMinuti ?? 15;
    if (!Number.isInteger(durationMin) || !durationMin || durationMin <= 0) {
      throw new HttpsError("failed-precondition", "Durata del servizio non valida.");
    }
    if (!Number.isInteger(stepMin) || stepMin <= 0) {
      throw new HttpsError("failed-precondition", "Passo del calendario non valido.");
    }

    const bookingsQuery = db
      .collection(`salons/${salonId}/bookings`)
      .where("operatorId", "==", operatorId)
      .where("date", "==", date);
    const bookingsSnap = await transaction.get(bookingsQuery);
    const busy = bookingsSnap.docs
      .map((booking) => booking.data())
      .filter((booking) => ["in_attesa", "confermata"].includes(booking.stato))
      .map((booking) => ({ start: booking.startMin, end: booking.endMin }))
      .filter(
        (interval): interval is Interval =>
          Number.isInteger(interval.start) && Number.isInteger(interval.end),
      );

    const endMin = startMin + durationMin;
    const available = computeAvailableStartTimes({
      salonHours: salon.orariApertura ?? {},
      operatorHours: operator.orariPersonalizzati,
      day: weekdayOf(date),
      busy,
      durationMin,
      stepMin,
    });

    if (!available.includes(startMin)) {
      const occupied = busy.some((interval) => overlaps(startMin, endMin, interval));
      throw new HttpsError(
        occupied ? "already-exists" : "failed-precondition",
        occupied ? "Orario non più disponibile." : "Orario fuori disponibilità.",
      );
    }

    transaction.set(
      dayMutexRef,
      {
        revision: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    transaction.create(bookingRef, {
      clientId: uid,
      clientNome: user.nome?.trim() || "Cliente",
      clientEmail: user.email ?? null,
      operatorId,
      serviceId,
      date,
      startMin,
      endMin,
      stato: "in_attesa",
      createdAt: FieldValue.serverTimestamp(),
    });

    return { bookingId: bookingRef.id, endMin, stato: "in_attesa" as const };
  });

  return result;
});
