import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

export const listPlatformSalons = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const db = getFirestore();
  const caller = await db.doc(`users/${uid}`).get();
  if (!caller.exists || caller.data()?.ruolo !== "superadmin") {
    throw new HttpsError("permission-denied", "Accesso riservato all'amministratore della piattaforma.");
  }

  const [salonsSnap, usersSnap] = await Promise.all([
    db.collection("salons").get(),
    db.collection("users").get(),
  ]);
  const users: Array<{ id: string; salonId?: string; ruolo?: string; nome?: string; email?: string }> =
    usersSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }));
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const salons = await Promise.all(salonsSnap.docs.map(async (salonDoc) => {
    const salonId = salonDoc.id;
    const salon = salonDoc.data();
    const [operatorsSnap, bookingsSnap, servicesSnap] = await Promise.all([
      db.collection(`salons/${salonId}/operators`).get(),
      db.collection(`salons/${salonId}/bookings`).where("date", ">=", cutoffDate).get(),
      db.collection(`salons/${salonId}/services`).get(),
    ]);
    const servicePrices = new Map(servicesSnap.docs.map((doc) => [doc.id, Number(doc.data().prezzo) || 0]));
    const validBookings = bookingsSnap.docs
      .map((doc) => doc.data())
      .filter((booking) => !["annullata", "rifiutata"].includes(booking.stato));
    const owner = users.find((user) => user.salonId === salonId && user.ruolo === "owner");
    const clients = users.filter((user) => user.salonId === salonId && user.ruolo === "cliente");
    const activeOperators = operatorsSnap.docs.filter((doc) => doc.data().attivo === true).length;
    const revenue30d = validBookings
      .filter((booking) => booking.stato === "confermata")
      .reduce((sum, booking) => sum + (Number(booking.prezzoFinale) || servicePrices.get(booking.serviceId) || 0), 0);

    return {
      id: salonId,
      nome: salon.nome ?? "Salone senza nome",
      dominio: salon.dominio ?? `${salonId}.barberia.app`,
      timezone: salon.timezone ?? "Europe/Rome",
      licenza: salon.licenza ?? { stato: "trial", piano: "start", scadenza: "", prezzoMensile: 0 },
      owner: owner ? { nome: owner.nome ?? "Titolare", email: owner.email ?? "" } : null,
      clienti: clients.length,
      operatori: activeOperators,
      prenotazioni30g: validBookings.length,
      fatturato30g: revenue30d,
    };
  }));

  salons.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  return { salons };
});
