import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { computeAvailableStartTimes, isUnavailableOn, weekdayOf, type Interval, type WeeklyHours } from "./booking-core.js";

if (getApps().length === 0) initializeApp();

const busyStatuses = ["in_attesa", "confermata"];

export const notifyWaitlistSlot = onDocumentUpdated(
  "salons/{salonId}/bookings/{bookingId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.stato === after.stato
      || !busyStatuses.includes(before.stato) || busyStatuses.includes(after.stato)) return;

    const salonId = event.params.salonId;
    const db = getFirestore();
    const [candidates, salonSnap, operatorSnap, bookingsSnap] = await Promise.all([
      db.collection(`salons/${salonId}/waitlist`).where("date", "==", after.date).get(),
      db.doc(`salons/${salonId}`).get(),
      db.doc(`salons/${salonId}/operators/${after.operatorId}`).get(),
      db.collection(`salons/${salonId}/bookings`).where("date", "==", after.date).get(),
    ]);
    const salon = salonSnap.data() as { orariApertura?: WeeklyHours; impostazioni?: { passoMinuti?: number } } | undefined;
    const operator = operatorSnap.data() as { orariPersonalizzati?: WeeklyHours; indisponibilita?: Array<{ dal?: string; al?: string }> } | undefined;
    if (!salon || !operator || isUnavailableOn(after.date, operator.indisponibilita)) return;
    const busy = bookingsSnap.docs.map((doc) => doc.data())
      .filter((booking) => booking.operatorId === after.operatorId && busyStatuses.includes(booking.stato))
      .map((booking) => ({ start: booking.startMin, end: booking.endMin }))
      .filter((interval): interval is Interval => Number.isInteger(interval.start) && Number.isInteger(interval.end));
    const matches = candidates.docs.filter((doc) => {
      const entry = doc.data();
      if (entry.status !== "active" || entry.operatorId !== after.operatorId || !Array.isArray(entry.serviceItems)) return false;
      const durationMin = entry.serviceItems.reduce((sum: number, item: { durataMin?: unknown }) => sum + (Number(item.durataMin) || 0), 0);
      if (!Number.isInteger(durationMin) || durationMin <= 0) return false;
      return computeAvailableStartTimes({
        salonHours: salon.orariApertura ?? {}, operatorHours: operator.orariPersonalizzati,
        day: weekdayOf(after.date), busy, durationMin, stepMin: salon.impostazioni?.passoMinuti ?? 15,
      }).length > 0;
    }).slice(0, 10);

    await Promise.all(matches.map(async (entrySnap) => {
      const entry = entrySnap.data();
      const notificationId = `waitlist_${entrySnap.id}`;
      const notificationRef = db.doc(`salons/${salonId}/notifications/${notificationId}`);
      const title = "Si è liberato un posto";
      const body = `È tornata disponibile una fascia per il ${entry.date}. Prenota ora: lo slot resta disponibile fino alla conferma.`;
      await db.runTransaction(async (transaction) => {
        const [freshEntry, existingNotification] = await Promise.all([
          transaction.get(entrySnap.ref),
          transaction.get(notificationRef),
        ]);
        if (freshEntry.data()?.status !== "active" || existingNotification.exists) return;
        transaction.update(entrySnap.ref, { status: "notified", notifiedAt: FieldValue.serverTimestamp() });
        transaction.create(notificationRef, {
          clientId: entry.clientId,
          clientNome: entry.clientNome ?? "Cliente",
          waitlistEntryId: entrySnap.id,
          title,
          body,
          channels: { email: { status: entry.clientEmail ? "queued" : "unavailable" } },
          createdAt: FieldValue.serverTimestamp(),
        });
        if (entry.clientEmail) {
          transaction.set(db.doc(`mail/${salonId}_${notificationId}`), {
            to: entry.clientEmail,
            message: { subject: title, text: body },
            salonId,
            waitlistEntryId: entrySnap.id,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      });
    }));
  },
);
