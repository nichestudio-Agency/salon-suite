import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { isValidDateKey } from "./booking-core.js";

if (getApps().length === 0) initializeApp();

interface ManageWaitlistData {
  action: "join" | "cancel" | "accept";
  salonId: string;
  entryId?: string;
  operatorId?: string;
  serviceIds?: string[];
  serviceId?: string;
  date?: string;
  startMin?: number;
  bookingId?: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value.trim();
}

export const manageWaitlist = onCall<ManageWaitlistData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const db = getFirestore();
  const profileSnap = await db.doc(`users/${uid}`).get();
  const profile = profileSnap.data();
  if (!profileSnap.exists || profile?.ruolo !== "cliente") {
    throw new HttpsError("permission-denied", "Solo un cliente può usare la lista d'attesa.");
  }

  if (request.data?.action === "cancel" || request.data?.action === "accept") {
    const entryId = requireId(request.data.entryId, "entryId");
    const accepted = request.data.action === "accept";
    const bookingId = accepted ? requireId(request.data.bookingId, "bookingId") : null;
    const entryRef = db.doc(`salons/${salonId}/waitlist/${entryId}`);
    await db.runTransaction(async (transaction) => {
      const entrySnap = await transaction.get(entryRef);
      if (!entrySnap.exists) throw new HttpsError("not-found", "Richiesta non trovata.");
      if (entrySnap.data()?.clientId !== uid) throw new HttpsError("permission-denied", "Richiesta non autorizzata.");
      if (["active", "notified"].includes(entrySnap.data()?.status)) {
        transaction.update(entryRef, accepted
          ? { status: "accepted", bookingId, acceptedAt: FieldValue.serverTimestamp() }
          : { status: "cancelled", cancelledAt: FieldValue.serverTimestamp() });
      }
    });
    return { entryId, status: accepted ? "accepted" as const : "cancelled" as const };
  }

  if (request.data?.action !== "join") throw new HttpsError("invalid-argument", "Azione non valida.");
  const operatorId = requireId(request.data.operatorId, "operatorId");
  const rawServiceIds = Array.isArray(request.data.serviceIds) && request.data.serviceIds.length
    ? request.data.serviceIds
    : [request.data.serviceId];
  const serviceIds = [...new Set(rawServiceIds.map((value) => requireId(value, "serviceId")))];
  if (serviceIds.length < 1 || serviceIds.length > 5) throw new HttpsError("invalid-argument", "Puoi selezionare da 1 a 5 servizi.");
  const date = request.data.date;
  if (typeof date !== "string" || !isValidDateKey(date)) throw new HttpsError("invalid-argument", "Data non valida.");
  const startMin = request.data.startMin;
  if (!Number.isInteger(startMin) || Number(startMin) < 0 || Number(startMin) >= 24 * 60) throw new HttpsError("invalid-argument", "Orario non valido.");

  const [operatorSnap, ...serviceSnaps] = await db.getAll(
    db.doc(`salons/${salonId}/operators/${operatorId}`),
    ...serviceIds.map((id) => db.doc(`salons/${salonId}/services/${id}`)),
  );
  if (!operatorSnap.exists || operatorSnap.data()?.attivo !== true) throw new HttpsError("failed-precondition", "Operatore non disponibile.");
  if (serviceSnaps.some((snap) => !snap.exists || snap.data()?.attivo !== true)) throw new HttpsError("failed-precondition", "Uno dei servizi non è disponibile.");

  const key = createHash("sha256").update(`${uid}|${operatorId}|${date}|${startMin}|${serviceIds.join(",")}`).digest("hex").slice(0, 24);
  const entryRef = db.doc(`salons/${salonId}/waitlist/${key}`);
  const serviceItems = serviceSnaps.map((snap, index) => ({
    serviceId: serviceIds[index],
    titolo: snap.data()?.titolo ?? "Servizio",
    durataMin: Number(snap.data()?.durataMin) || 0,
    prezzo: Number(snap.data()?.prezzo) || 0,
  }));
  const durationMin = serviceItems.reduce((sum, item) => sum + item.durataMin, 0);
  if (!Number.isInteger(durationMin) || durationMin <= 0) throw new HttpsError("failed-precondition", "Durata del servizio non valida.");
  await entryRef.set({
    clientId: uid,
    clientNome: typeof profile.nome === "string" && profile.nome.trim() ? profile.nome.trim() : "Cliente",
    clientEmail: typeof profile.email === "string" ? profile.email : null,
    operatorId,
    serviceIds,
    serviceItems,
    date,
    startMin,
    endMin: Number(startMin) + durationMin,
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    notifiedAt: FieldValue.delete(),
    cancelledAt: FieldValue.delete(),
  }, { merge: true });
  return { entryId: entryRef.id, status: "active" as const };
});
