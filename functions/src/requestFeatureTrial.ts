import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

const FEATURES = ["agenda", "clienti", "servizi_team", "prodotti_ordini", "marketing", "fidelity", "statistiche", "integrazioni", "importazione", "app_cliente"] as const;
type Feature = typeof FEATURES[number];
const DEFAULT_PLAN_FEATURES: Record<string, Feature[]> = {
  start: ["agenda", "clienti", "servizi_team", "app_cliente"],
  studio: ["agenda", "clienti", "servizi_team", "prodotti_ordini", "marketing", "fidelity", "app_cliente"],
  pro: [...FEATURES],
};

export const requestFeatureTrial = onCall<{ feature: Feature }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const feature = request.data?.feature;
  if (!feature || !FEATURES.includes(feature)) throw new HttpsError("invalid-argument", "Funzionalità non valida.");

  const db = getFirestore();
  const user = await db.doc(`users/${uid}`).get();
  const profile = user.data();
  if (!user.exists || !["owner", "staff"].includes(String(profile?.ruolo)) || !profile?.salonId) {
    throw new HttpsError("permission-denied", "Solo il titolare può attivare una prova.");
  }

  const salonId = String(profile.salonId);
  const salonRef = db.doc(`salons/${salonId}`);
  const configRef = db.doc("platformConfig/subscriptions");
  const start = new Date();
  const expiry = new Date(start.getTime() + 14 * 86_400_000).toISOString().slice(0, 10);

  await db.runTransaction(async (tx) => {
    const [salonSnap, configSnap] = await Promise.all([tx.get(salonRef), tx.get(configRef)]);
    if (!salonSnap.exists) throw new HttpsError("not-found", "Attività non trovata.");
    const salon = salonSnap.data()!;
    const license = salon.licenza && typeof salon.licenza === "object" ? salon.licenza as Record<string, unknown> : {};
    const plan = String(license.piano ?? "start");
    const config = configSnap.data()?.piani?.[plan] as { funzionalita?: string[] } | undefined;
    const overrides = license.funzionalitaPersonalizzate && typeof license.funzionalitaPersonalizzate === "object"
      ? license.funzionalitaPersonalizzate as Record<string, boolean>
      : {};
    const temporary = Array.isArray(license.funzionalitaTemporanee)
      ? license.funzionalitaTemporanee as Array<{ funzione?: string; scadeIl?: string }>
      : [];
    const used = license.proveUtilizzate && typeof license.proveUtilizzate === "object"
      ? license.proveUtilizzate as Record<string, string>
      : {};
    const currentTrial = temporary.find((item) => item.funzione === feature && String(item.scadeIl) >= start.toISOString().slice(0, 10));
    const planFeatures = config?.funzionalita ?? DEFAULT_PLAN_FEATURES[plan] ?? [];
    const included = overrides[feature] === true || (overrides[feature] !== false && planFeatures.includes(feature));
    if (included || currentTrial) throw new HttpsError("already-exists", "Questa funzionalità è già attiva.");
    if (used[feature]) throw new HttpsError("failed-precondition", "La prova gratuita per questa funzionalità è già stata utilizzata.");

    tx.update(salonRef, {
      licenza: {
        ...license,
        funzionalitaTemporanee: [
          ...temporary.filter((item) => item.funzione !== feature),
          { funzione: feature, scadeIl: expiry },
        ],
        proveUtilizzate: { ...used, [feature]: start.toISOString() },
      },
    });
  });

  return { success: true, salonId, scadeIl: expiry, giorni: 14 };
});
