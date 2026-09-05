import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

const STATUSES = ["trial", "attiva", "scaduta", "sospesa"] as const;
const PLANS = ["start", "studio", "pro"] as const;

interface UpdateLicenseData {
  salonId: string;
  stato: typeof STATUSES[number];
  piano: typeof PLANS[number];
  scadenza: string;
  prezzoMensile: number;
}

export const updateSalonLicense = onCall<UpdateLicenseData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const db = getFirestore();
  const caller = await db.doc(`users/${uid}`).get();
  if (!caller.exists || caller.data()?.ruolo !== "superadmin") {
    throw new HttpsError("permission-denied", "Accesso riservato all'amministratore della piattaforma.");
  }

  const data = request.data;
  if (!data || typeof data.salonId !== "string" || !data.salonId || data.salonId.includes("/")
    || !STATUSES.includes(data.stato) || !PLANS.includes(data.piano)
    || !/^\d{4}-\d{2}-\d{2}$/.test(data.scadenza)
    || !Number.isInteger(data.prezzoMensile) || data.prezzoMensile < 0) {
    throw new HttpsError("invalid-argument", "Dati della licenza non validi.");
  }

  const salonRef = db.doc(`salons/${data.salonId}`);
  if (!(await salonRef.get()).exists) throw new HttpsError("not-found", "Salone non trovato.");
  await salonRef.update({
    licenza: {
      stato: data.stato,
      piano: data.piano,
      scadenza: data.scadenza,
      prezzoMensile: data.prezzoMensile,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
  });
  return { success: true };
});
