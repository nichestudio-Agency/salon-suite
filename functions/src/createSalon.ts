import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

interface CreateSalonData {
  nome: string;
  tipo?: "barberia" | "parrucchieria";
  timezone: string;
  orariApertura: Record<string, { start: number; end: number }[]>;
}

export const createSalon = onCall<CreateSalonData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const { nome, tipo = "barberia", timezone, orariApertura } = request.data ?? ({} as CreateSalonData);
  if (!nome || !nome.trim() || !timezone) {
    throw new HttpsError("invalid-argument", "Nome del salone e fuso orario sono obbligatori.");
  }
  if (!(["barberia", "parrucchieria"] as const).includes(tipo)) {
    throw new HttpsError("invalid-argument", "Tipo di attività non valido.");
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const salonRef = db.collection("salons").doc();

  await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (userSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Questo utente è già registrato e non può creare un salone."
      );
    }
    tx.set(salonRef, {
      nome: nome.trim(),
      tipo,
      timezone,
      orariApertura: orariApertura ?? {},
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
      licenza: {
        stato: "trial",
        piano: "start",
        scadenza: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
        prezzoMensile: 4900,
      },
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(userRef, {
      ruolo: "owner",
      salonId: salonRef.id,
      email: request.auth?.token.email ?? null,
    });
  });

  return { salonId: salonRef.id };
});
