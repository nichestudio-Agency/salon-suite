import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  computeAvailableStartTimes,
  isUnavailableOn,
  isValidDateKey,
  weekdayOf,
  type Interval,
  type WeeklyHours,
} from "./booking-core.js";

if (getApps().length === 0) initializeApp();

interface GetAvailabilityData {
  salonId: string;
  operatorId: string;
  serviceId: string;
  serviceIds?: string[];
  date: string;
  recurrenceCount?: number;
}

function addWeeks(date: string, weeks: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + weeks * 7);
  return value.toISOString().slice(0, 10);
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value;
}

export const getAvailability = onCall<GetAvailabilityData>(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  }

  const salonId = requireId(request.data?.salonId, "salonId");
  const operatorId = requireId(request.data?.operatorId, "operatorId");
  const rawServiceIds = Array.isArray(request.data?.serviceIds) && request.data.serviceIds.length
    ? request.data.serviceIds
    : [request.data?.serviceId];
  const serviceIds = [...new Set(rawServiceIds.map((value) => requireId(value, "serviceId")))];
  if (serviceIds.length < 1 || serviceIds.length > 5) throw new HttpsError("invalid-argument", "Puoi selezionare da 1 a 5 servizi.");
  const recurrenceCount = request.data?.recurrenceCount ?? 1;
  const date = request.data?.date;
  if (typeof date !== "string" || !isValidDateKey(date)) {
    throw new HttpsError("invalid-argument", "Data non valida.");
  }
  if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 8) throw new HttpsError("invalid-argument", "Ricorrenza non valida.");
  const dates = Array.from({ length: recurrenceCount }, (_, index) => addWeeks(date, index));

  const db = getFirestore();
  const [salonSnap, operatorSnap, ...serviceSnaps] = await db.getAll(
    db.doc(`salons/${salonId}`),
    db.doc(`salons/${salonId}/operators/${operatorId}`),
    ...serviceIds.map((serviceId) => db.doc(`salons/${salonId}/services/${serviceId}`)),
  );

  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Salone non trovato.");
  }
  if (!operatorSnap.exists || operatorSnap.data()?.attivo !== true) {
    throw new HttpsError("failed-precondition", "Operatore non disponibile.");
  }
  if (serviceSnaps.some((snap) => !snap.exists || snap.data()?.attivo !== true)) throw new HttpsError("failed-precondition", "Uno dei servizi non è disponibile.");

  const salon = salonSnap.data() as {
    orariApertura?: WeeklyHours;
    impostazioni?: { passoMinuti?: number };
  };
  const operator = operatorSnap.data() as {
    orariPersonalizzati?: WeeklyHours;
    indisponibilita?: Array<{ dal?: string; al?: string }>;
  };
  const services = serviceSnaps.map((snap) => snap.data() as { durataMin?: number });
  const durationMin = services.reduce((sum, service) => sum + (Number(service.durataMin) || 0), 0);
  const stepMin = salon.impostazioni?.passoMinuti ?? 15;
  if (!Number.isInteger(durationMin) || !durationMin || durationMin <= 0
    || services.some((service) => !Number.isInteger(service.durataMin) || Number(service.durataMin) <= 0)) {
    throw new HttpsError("failed-precondition", "Durata del servizio non valida.");
  }
  if (!Number.isInteger(stepMin) || stepMin <= 0) {
    throw new HttpsError("failed-precondition", "Passo del calendario non valido.");
  }
  if (dates.some((item) => isUnavailableOn(item, operator.indisponibilita))) {
    return { date, dates, durationMin, stepMin, starts: [] };
  }

  const bookingSnaps = await Promise.all(dates.map((item) => db.collection(`salons/${salonId}/bookings`).where("operatorId", "==", operatorId).where("date", "==", item).get()));
  const startsByDate = bookingSnaps.map((bookingsSnap, index) => {
    const busy = bookingsSnap.docs.map((booking) => booking.data()).filter((booking) => ["in_attesa", "confermata"].includes(booking.stato)).map((booking) => ({ start: booking.startMin, end: booking.endMin })).filter((interval): interval is Interval => Number.isInteger(interval.start) && Number.isInteger(interval.end));
    return computeAvailableStartTimes({ salonHours: salon.orariApertura ?? {}, operatorHours: operator.orariPersonalizzati, day: weekdayOf(dates[index]), busy, durationMin, stepMin });
  });
  const starts = startsByDate[0]?.filter((start) => startsByDate.every((items) => items.includes(start))) ?? [];

  return {
    date,
    dates,
    durationMin,
    stepMin,
    starts,
  };
});
