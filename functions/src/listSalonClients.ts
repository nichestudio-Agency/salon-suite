import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value;
}

export const listSalonClients = onCall<{ salonId: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const salonId = requireId(request.data?.salonId, "salonId");
  const db = getFirestore();
  const caller = (await db.doc(`users/${uid}`).get()).data();
  if (caller?.salonId !== salonId || !["owner", "staff"].includes(caller?.ruolo)) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone può vedere i clienti.");
  }

  const [profiles, bookings, orders] = await Promise.all([
    db.collection("users").where("salonId", "==", salonId).get(),
    db.collection(`salons/${salonId}/bookings`).get(),
    db.collection(`salons/${salonId}/orders`).get(),
  ]);

  const activity = new Map<string, { bookingCount: number; lastBookingDate: string | null; orderCount: number; lastOrderDate: string | null; totalSpent: number }>();
  const stats = (clientId: string) => {
    const current = activity.get(clientId) ?? { bookingCount: 0, lastBookingDate: null, orderCount: 0, lastOrderDate: null, totalSpent: 0 };
    activity.set(clientId, current);
    return current;
  };

  for (const document of bookings.docs) {
    const booking = document.data();
    if (typeof booking.clientId !== "string" || ["annullata", "rifiutata"].includes(booking.stato)) continue;
    const current = stats(booking.clientId);
    current.bookingCount++;
    if (typeof booking.date === "string" && (!current.lastBookingDate || booking.date > current.lastBookingDate)) current.lastBookingDate = booking.date;
  }
  for (const document of orders.docs) {
    const order = document.data();
    if (typeof order.clientId !== "string" || order.stato === "annullato") continue;
    const current = stats(order.clientId);
    current.orderCount++;
    current.totalSpent += Number.isFinite(order.totale) ? Number(order.totale) : 0;
    const createdAt = order.createdAt as Timestamp | undefined;
    const orderDate = createdAt?.toDate?.().toISOString().slice(0, 10) ?? null;
    if (orderDate && (!current.lastOrderDate || orderDate > current.lastOrderDate)) current.lastOrderDate = orderDate;
  }

  const clients = profiles.docs
    .filter((document) => document.data().ruolo === "cliente")
    .map((document) => {
      const profile = document.data();
      return {
        id: document.id,
        nome: typeof profile.nome === "string" ? profile.nome : "Cliente",
        email: typeof profile.email === "string" ? profile.email : "",
        sesso: profile.sesso ?? "altro",
        dataNascita: typeof profile.dataNascita === "string" ? profile.dataNascita : "",
        hasPush: Array.isArray(profile.fcmTokens) && profile.fcmTokens.length > 0,
        ...stats(document.id),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "it"));

  return { clients };
});
