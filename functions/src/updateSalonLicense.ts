import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

const STATUSES = ["trial", "attiva", "scaduta", "sospesa"] as const;
const PLANS = ["start", "studio", "pro"] as const;
const BILLING_CYCLES = ["mensile", "annuale"] as const;
const PAYMENT_STATUSES = ["pagato", "in_scadenza", "insoluto"] as const;
const FEATURES = ["agenda", "clienti", "servizi_team", "prodotti_ordini", "marketing", "fidelity", "statistiche", "integrazioni", "importazione", "app_cliente"] as const;

interface UpdateLicenseData {
  salonId: string;
  stato: typeof STATUSES[number];
  piano: typeof PLANS[number];
  scadenza: string;
  prezzoMensile: number;
  ciclo?: typeof BILLING_CYCLES[number];
  statoPagamento?: typeof PAYMENT_STATUSES[number];
  rinnovoAutomatico?: boolean;
  note?: string;
  funzionalitaPersonalizzate?: Partial<Record<typeof FEATURES[number], boolean>>;
  funzionalitaTemporanee?: Array<{ funzione: typeof FEATURES[number]; scadeIl: string }>;
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
  if ((data.ciclo !== undefined && !BILLING_CYCLES.includes(data.ciclo))
    || (data.statoPagamento !== undefined && !PAYMENT_STATUSES.includes(data.statoPagamento))
    || (data.rinnovoAutomatico !== undefined && typeof data.rinnovoAutomatico !== "boolean")
    || (data.note !== undefined && (typeof data.note !== "string" || data.note.length > 500))) {
    throw new HttpsError("invalid-argument", "Dati di fatturazione non validi.");
  }
  const overrides = data.funzionalitaPersonalizzate ?? {};
  const temporary = data.funzionalitaTemporanee ?? [];
  if (Object.entries(overrides).some(([feature, enabled]) => !FEATURES.includes(feature as typeof FEATURES[number]) || typeof enabled !== "boolean")
    || !Array.isArray(temporary)
    || temporary.some((item) => !item || !FEATURES.includes(item.funzione) || !/^\d{4}-\d{2}-\d{2}$/.test(item.scadeIl))) {
    throw new HttpsError("invalid-argument", "Personalizzazione delle funzionalità non valida.");
  }

  const salonRef = db.doc(`salons/${data.salonId}`);
  const salonSnap = await salonRef.get();
  if (!salonSnap.exists) throw new HttpsError("not-found", "Salone non trovato.");
  await salonRef.update({
    licenza: {
      stato: data.stato,
      piano: data.piano,
      scadenza: data.scadenza,
      prezzoMensile: data.prezzoMensile,
      ciclo: data.ciclo ?? "mensile",
      statoPagamento: data.statoPagamento ?? "pagato",
      rinnovoAutomatico: data.rinnovoAutomatico ?? true,
      note: data.note?.trim() ?? "",
      funzionalitaPersonalizzate: overrides,
      funzionalitaTemporanee: temporary,
      proveUtilizzate: salonSnap.data()?.licenza?.proveUtilizzate ?? {},
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    },
  });
  return { success: true };
});
