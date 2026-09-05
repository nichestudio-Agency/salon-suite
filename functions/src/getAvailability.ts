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
  date: string;
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
  const serviceId = requireId(request.data?.serviceId, "serviceId");
  const date = request.data?.date;
  if (typeof date !== "string" || !isValidDateKey(date)) {
    throw new HttpsError("invalid-argument", "Data non valida.");
  }

  const db = getFirestore();
  const [salonSnap, operatorSnap, serviceSnap] = await db.getAll(
    db.doc(`salons/${salonId}`),
    db.doc(`salons/${salonId}/operators/${operatorId}`),
    db.doc(`salons/${salonId}/services/${serviceId}`),
  );

  if (!salonSnap.exists) {
    throw new HttpsError("not-found", "Salone non trovato.");
  }
  if (!operatorSnap.exists || operatorSnap.data()?.attivo !== true) {
    throw new HttpsError("failed-precondition", "Operatore non disponibile.");
  }
  if (!serviceSnap.exists || serviceSnap.data()?.attivo !== true) {
    throw new HttpsError("failed-precondition", "Servizio non disponibile.");
  }

  const salon = salonSnap.data() as {
    orariApertura?: WeeklyHours;
    impostazioni?: { passoMinuti?: number };
  };
  const operator = operatorSnap.data() as {
    orariPersonalizzati?: WeeklyHours;
    indisponibilita?: Array<{ dal?: string; al?: string }>;
  };
  const service = serviceSnap.data() as { durataMin?: number };
  const durationMin = service.durataMin;
  const stepMin = salon.impostazioni?.passoMinuti ?? 15;
  if (!Number.isInteger(durationMin) || !durationMin || durationMin <= 0) {
    throw new HttpsError("failed-precondition", "Durata del servizio non valida.");
  }
  if (!Number.isInteger(stepMin) || stepMin <= 0) {
    throw new HttpsError("failed-precondition", "Passo del calendario non valido.");
  }
  if (isUnavailableOn(date, operator.indisponibilita)) {
    return { date, durationMin, stepMin, starts: [] };
  }

  const bookingsSnap = await db
    .collection(`salons/${salonId}/bookings`)
    .where("operatorId", "==", operatorId)
    .where("date", "==", date)
    .get();
  const busy = bookingsSnap.docs
    .map((booking) => booking.data())
    .filter((booking) => ["in_attesa", "confermata"].includes(booking.stato))
    .map((booking) => ({ start: booking.startMin, end: booking.endMin }))
    .filter(
      (interval): interval is Interval =>
        Number.isInteger(interval.start) && Number.isInteger(interval.end),
    );

  return {
    date,
    durationMin,
    stepMin,
    starts: computeAvailableStartTimes({
      salonHours: salon.orariApertura ?? {},
      operatorHours: operator.orariPersonalizzati,
      day: weekdayOf(date),
      busy,
      durationMin,
      stepMin,
    }),
  };
});
