import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
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

interface CreateBookingData {
  salonId: string;
  operatorId: string;
  serviceId: string;
  serviceIds?: string[];
  date: string;
  startMin: number;
  couponCode?: string;
  recurrenceCount?: number;
}

interface SalonData {
  orariApertura?: WeeklyHours;
  impostazioni?: { passoMinuti?: number };
}

interface OperatorData {
  attivo?: boolean;
  orariPersonalizzati?: WeeklyHours;
  indisponibilita?: Array<{ dal?: string; al?: string }>;
}

interface ServiceData {
  attivo?: boolean;
  durataMin?: number;
  prezzo?: number;
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

function addWeeks(date: string, weeks: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + weeks * 7);
  return value.toISOString().slice(0, 10);
}

export const createBooking = onCall<CreateBookingData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const operatorId = requireId(request.data?.operatorId, "operatorId");
  const rawServiceIds = Array.isArray(request.data?.serviceIds) && request.data.serviceIds.length
    ? request.data.serviceIds
    : [request.data?.serviceId];
  const serviceIds = [...new Set(rawServiceIds.map((value) => requireId(value, "serviceId")))];
  if (serviceIds.length < 1 || serviceIds.length > 5) throw new HttpsError("invalid-argument", "Puoi prenotare da 1 a 5 servizi insieme.");
  const serviceId = serviceIds[0];
  const date = request.data?.date;
  const startMin = request.data?.startMin;
  const recurrenceCount = request.data?.recurrenceCount ?? 1;
  const couponCode = typeof request.data?.couponCode === "string"
    ? request.data.couponCode.trim().toUpperCase()
    : "";

  if (typeof date !== "string" || !isValidDateKey(date)) {
    throw new HttpsError("invalid-argument", "Data non valida.");
  }
  if (!Number.isInteger(startMin) || startMin < 0 || startMin >= 24 * 60) {
    throw new HttpsError("invalid-argument", "Orario non valido.");
  }
  if (!Number.isInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 8) {
    throw new HttpsError("invalid-argument", "Il numero di appuntamenti periodici deve essere compreso tra 1 e 8.");
  }
  const dates = Array.from({ length: recurrenceCount }, (_, index) => addWeeks(date, index));

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const salonRef = db.doc(`salons/${salonId}`);
  const operatorRef = db.doc(`salons/${salonId}/operators/${operatorId}`);
  const serviceRefs = serviceIds.map((id) => db.doc(`salons/${salonId}/services/${id}`));
  const bookingRefs = dates.map(() => db.collection(`salons/${salonId}/bookings`).doc());
  const dayMutexRefs = dates.map((item) => db.doc(`salons/${salonId}/_bookingDays/${operatorId}_${item}`));
  const seriesId = recurrenceCount > 1 ? db.collection(`salons/${salonId}/bookingSeries`).doc().id : null;
  const couponMatch = couponCode
    ? await db.collection(`salons/${salonId}/coupons`).where("codice", "==", couponCode).limit(1).get()
    : null;
  if (couponCode && couponMatch?.empty) {
    throw new HttpsError("failed-precondition", "Coupon non valido.");
  }
  const couponRef = couponMatch?.docs[0]?.ref;
  const redemptionRef = couponRef
    ? db.doc(`salons/${salonId}/couponRedemptions/${couponRef.id}_${uid}`)
    : null;

  const result = await db.runTransaction(async (transaction) => {
    const [userSnap, salonSnap, operatorSnap, ...serviceSnaps] = await Promise.all([
      transaction.get(userRef), transaction.get(salonRef), transaction.get(operatorRef),
      ...serviceRefs.map((ref) => transaction.get(ref)),
    ]);
    const extraReads = await Promise.all([
      ...dayMutexRefs.map((ref) => transaction.get(ref)),
      ...(couponRef ? [transaction.get(couponRef)] : []),
      ...(redemptionRef ? [transaction.get(redemptionRef)] : []),
      ...dates.map((item) => transaction.get(db.collection(`salons/${salonId}/bookings`).where("operatorId", "==", operatorId).where("date", "==", item))),
    ]);
    const couponSnap = couponRef ? extraReads[dayMutexRefs.length] as FirebaseFirestore.DocumentSnapshot : null;
    const redemptionSnap = redemptionRef ? extraReads[dayMutexRefs.length + (couponRef ? 1 : 0)] as FirebaseFirestore.DocumentSnapshot : null;
    const queryOffset = dayMutexRefs.length + (couponRef ? 1 : 0) + (redemptionRef ? 1 : 0);
    const bookingsSnaps = extraReads.slice(queryOffset) as FirebaseFirestore.QuerySnapshot[];

    if (!userSnap.exists || userSnap.data()?.ruolo !== "cliente") {
      throw new HttpsError("permission-denied", "Solo un cliente può prenotare.");
    }
    if (!salonSnap.exists) {
      throw new HttpsError("not-found", "Salone non trovato.");
    }
    if (!operatorSnap.exists || operatorSnap.data()?.attivo !== true) {
      throw new HttpsError("failed-precondition", "Operatore non disponibile.");
    }
    if (serviceSnaps.some((snap) => !snap.exists || snap.data()?.attivo !== true)) throw new HttpsError("failed-precondition", "Uno dei servizi non è disponibile.");

    const user = userSnap.data() as { nome?: string; email?: string };
    const salon = salonSnap.data() as SalonData;
    const operator = operatorSnap.data() as OperatorData;
    const services = serviceSnaps.map((snap) => snap.data() as ServiceData & { titolo?: string });
    const durationMin = services.reduce((sum, service) => sum + (Number(service.durataMin) || 0), 0);
    const stepMin = salon.impostazioni?.passoMinuti ?? 15;
    if (!Number.isInteger(durationMin) || !durationMin || durationMin <= 0 || services.some((service) => !Number.isInteger(service.durataMin) || Number(service.durataMin) <= 0)) {
      throw new HttpsError("failed-precondition", "Durata del servizio non valida.");
    }
    if (!Number.isInteger(stepMin) || stepMin <= 0) {
      throw new HttpsError("failed-precondition", "Passo del calendario non valido.");
    }
    if (dates.some((item) => isUnavailableOn(item, operator.indisponibilita))) {
      throw new HttpsError("failed-precondition", "Operatore non disponibile nel periodo scelto.");
    }

    let discountAmount = 0;
    const originalPrice = services.reduce((sum, service) => sum + (Number.isInteger(service.prezzo) ? Number(service.prezzo) : 0), 0);
    if (couponSnap) {
      const coupon = couponSnap.data() ?? {};
      const expiry = coupon.scadenza;
      const appointmentDate = coupon.dataAppuntamento;
      const slotFrom = typeof coupon.fasciaDa === "string" ? Number(coupon.fasciaDa.slice(0, 2)) * 60 + Number(coupon.fasciaDa.slice(3, 5)) : null;
      const slotTo = typeof coupon.fasciaA === "string" ? Number(coupon.fasciaA.slice(0, 2)) * 60 + Number(coupon.fasciaA.slice(3, 5)) : null;
      if (coupon.attivo !== true
        || (typeof expiry === "string" && expiry < date)
        || (typeof appointmentDate === "string" && appointmentDate !== date)
        || (typeof coupon.clientId === "string" && coupon.clientId !== uid)
        || (typeof coupon.serviceId === "string" && !serviceIds.includes(coupon.serviceId))
        || (slotFrom !== null && startMin < slotFrom)
        || (slotTo !== null && startMin >= slotTo)) {
        throw new HttpsError("failed-precondition", "Coupon non valido per questa prenotazione.");
      }
      if (redemptionSnap?.exists) {
        throw new HttpsError("already-exists", "Hai già utilizzato questo coupon.");
      }
      const value = Number(coupon.valore);
      discountAmount = coupon.tipo === "percentuale"
        ? Math.round(originalPrice * Math.min(Math.max(value, 0), 100) / 100)
        : Math.min(Math.max(Math.round(value), 0), originalPrice);
    }

    const endMin = startMin + durationMin;
    bookingsSnaps.forEach((bookingsSnap, index) => {
      const busy = bookingsSnap.docs.map((booking) => booking.data()).filter((booking) => ["in_attesa", "confermata"].includes(booking.stato)).map((booking) => ({ start: booking.startMin, end: booking.endMin })).filter((interval): interval is Interval => Number.isInteger(interval.start) && Number.isInteger(interval.end));
      const available = computeAvailableStartTimes({ salonHours: salon.orariApertura ?? {}, operatorHours: operator.orariPersonalizzati, day: weekdayOf(dates[index]), busy, durationMin, stepMin });
      if (!available.includes(startMin)) {
        const occupied = busy.some((interval) => overlaps(startMin, endMin, interval));
        throw new HttpsError(occupied ? "already-exists" : "failed-precondition", occupied ? `L'orario del ${dates[index]} non è più disponibile.` : `L'orario del ${dates[index]} è fuori disponibilità.`);
      }
    });

    const serviceItems = services.map((service, index) => {
      const offsetStartMin = services.slice(0, index).reduce((sum, item) => sum + Number(item.durataMin), 0);
      return { serviceId: serviceIds[index], titolo: service.titolo ?? "Servizio", durataMin: Number(service.durataMin), prezzo: Number(service.prezzo) || 0, offsetStartMin, offsetEndMin: offsetStartMin + Number(service.durataMin) };
    });
    dates.forEach((occurrenceDate, index) => {
      transaction.set(dayMutexRefs[index], { revision: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const occurrenceDiscount = index === 0 ? discountAmount : 0;
      transaction.create(bookingRefs[index], {
        clientId: uid, clientNome: user.nome?.trim() || "Cliente", clientEmail: user.email ?? null,
        operatorId, serviceId, serviceIds, serviceItems, date: occurrenceDate, startMin, endMin,
        stato: "in_attesa", prezzoOriginale: originalPrice, sconto: occurrenceDiscount,
        prezzoFinale: Math.max(originalPrice - occurrenceDiscount, 0),
        ...(seriesId ? { seriesId, occurrenceIndex: index, occurrenceCount: recurrenceCount } : {}),
        ...(couponRef && index === 0 ? { couponId: couponRef.id, couponCode } : {}),
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    if (couponRef && redemptionRef) {
      transaction.create(redemptionRef, {
        couponId: couponRef.id,
        couponCode,
        clientId: uid,
        bookingId: bookingRefs[0].id,
        appointmentDate: date,
        discountAmount,
        redeemedAt: FieldValue.serverTimestamp(),
      });
    }

    return {
      bookingId: bookingRefs[0].id,
      bookingIds: bookingRefs.map((ref) => ref.id),
      occurrenceCount: recurrenceCount,
      endMin,
      stato: "in_attesa" as const,
      prezzoOriginale: originalPrice,
      sconto: discountAmount,
      prezzoFinale: Math.max(originalPrice - discountAmount, 0),
    };
  });

  return result;
});
