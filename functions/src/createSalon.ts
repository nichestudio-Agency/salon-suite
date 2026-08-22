import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

interface CreateSalonData {
  nome: string;
  timezone: string;
  orariApertura: Record<string, { start: number; end: number }[]>;
}

export const createSalon = onCall<CreateSalonData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const { nome, timezone, orariApertura } = request.data ?? ({} as CreateSalonData);
  if (!nome || !timezone) {
    throw new HttpsError("invalid-argument", "Nome del salone e fuso orario sono obbligatori.");
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (userSnap.exists && userSnap.data()?.salonId) {
    throw new HttpsError("failed-precondition", "Questo utente è già legato a un salone.");
  }

  const salonRef = db.collection("salons").doc();
  await db.runTransaction(async (tx) => {
    tx.set(salonRef, {
      nome,
      timezone,
      orariApertura: orariApertura ?? {},
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
    });
    tx.set(
      userRef,
      { ruolo: "owner", salonId: salonRef.id, email: request.auth?.token.email ?? null },
      { merge: true }
    );
  });

  return { salonId: salonRef.id };
});
