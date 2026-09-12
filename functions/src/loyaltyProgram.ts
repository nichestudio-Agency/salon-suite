import { randomBytes } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentReference } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

if (getApps().length === 0) initializeApp();

const DEFAULT_CONFIG = {
  attiva: true,
  puntiPerEuro: 1,
  sogliaPremio: 100,
  premioNome: "Buono da 10 €",
  premioValore: 1000,
};

type LoyaltyAction = "getMine" | "list" | "lookup" | "earn" | "redeem";

interface LoyaltyRequest {
  action: LoyaltyAction;
  salonId: string;
  codice?: string;
  clientId?: string;
  importo?: number;
  sourceId?: string;
  descrizione?: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value.trim();
}

function normalizeConfig(value: unknown) {
  const data = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    attiva: data.attiva !== false,
    puntiPerEuro: Number.isInteger(data.puntiPerEuro) && Number(data.puntiPerEuro) > 0 ? Number(data.puntiPerEuro) : DEFAULT_CONFIG.puntiPerEuro,
    sogliaPremio: Number.isInteger(data.sogliaPremio) && Number(data.sogliaPremio) > 0 ? Number(data.sogliaPremio) : DEFAULT_CONFIG.sogliaPremio,
    premioNome: typeof data.premioNome === "string" && data.premioNome.trim() ? data.premioNome.trim() : DEFAULT_CONFIG.premioNome,
    premioValore: Number.isInteger(data.premioValore) && Number(data.premioValore) >= 0 ? Number(data.premioValore) : DEFAULT_CONFIG.premioValore,
  };
}

async function caller(uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const snap = await getFirestore().doc(`users/${uid}`).get();
  if (!snap.exists) throw new HttpsError("permission-denied", "Profilo non disponibile.");
  return { uid, ...snap.data() } as { uid: string; ruolo?: string; salonId?: string; nome?: string; email?: string };
}

async function createAccount(ref: DocumentReference, clientId: string, profile: Record<string, unknown>) {
  const db = getFirestore();
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) return;
    transaction.create(ref, {
      clientId,
      codice: `CARD-${randomBytes(4).toString("hex").toUpperCase()}`,
      nome: typeof profile.nome === "string" ? profile.nome : "Cliente",
      email: typeof profile.email === "string" ? profile.email : "",
      punti: 0,
      puntiTotali: 0,
      puntiRiscattati: 0,
      visite: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return ref.get();
}

function accountResult(snap: FirebaseFirestore.DocumentSnapshot) {
  const data = snap.data() ?? {};
  return {
    clientId: snap.id,
    codice: data.codice ?? "",
    nome: data.nome ?? "Cliente",
    email: data.email ?? "",
    punti: Number(data.punti) || 0,
    puntiTotali: Number(data.puntiTotali) || 0,
    puntiRiscattati: Number(data.puntiRiscattati) || 0,
    visite: Number(data.visite) || 0,
  };
}

export const createLoyaltyCardForNewClient = onDocumentCreated("users/{uid}", async (event) => {
  const profile = event.data?.data();
  const uid = event.params.uid;
  if (!profile || profile.ruolo !== "cliente" || typeof profile.salonId !== "string") return;
  const ref = getFirestore().doc(`salons/${profile.salonId}/loyaltyAccounts/${uid}`);
  await createAccount(ref, uid, profile);
});

export const loyaltyProgram = onCall<LoyaltyRequest>(async (request) => {
  const actor = await caller(request.auth?.uid);
  const salonId = requireId(request.data?.salonId, "salonId");
  if (actor.salonId !== salonId) throw new HttpsError("permission-denied", "Questo profilo appartiene a un altro salone.");

  const db = getFirestore();
  const salonSnap = await db.doc(`salons/${salonId}`).get();
  if (!salonSnap.exists) throw new HttpsError("not-found", "Salone non trovato.");
  const config = normalizeConfig(salonSnap.data()?.fidelity);
  const action = request.data?.action;

  if (action === "getMine") {
    if (actor.ruolo !== "cliente") throw new HttpsError("permission-denied", "Area riservata ai clienti.");
    const ref = db.doc(`salons/${salonId}/loyaltyAccounts/${actor.uid}`);
    const account = await createAccount(ref, actor.uid, actor);
    const transactions = await ref.collection("transactions").orderBy("createdAt", "desc").limit(20).get();
    return {
      account: accountResult(account),
      config,
      transactions: transactions.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        createdAt: item.data().createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
      })),
    };
  }

  if (!["owner", "staff"].includes(actor.ruolo ?? "")) {
    throw new HttpsError("permission-denied", "Area riservata allo staff.");
  }

  const accounts = db.collection(`salons/${salonId}/loyaltyAccounts`);
  if (action === "list") {
    const snap = await accounts.orderBy("updatedAt", "desc").limit(100).get();
    return { accounts: snap.docs.map(accountResult), config };
  }

  let accountSnap: FirebaseFirestore.DocumentSnapshot | null = null;
  if (request.data.clientId) accountSnap = await accounts.doc(requireId(request.data.clientId, "clientId")).get();
  else if (request.data.codice) {
    const result = await accounts.where("codice", "==", request.data.codice.trim().toUpperCase()).limit(1).get();
    accountSnap = result.empty ? null : result.docs[0];
  }
  if (!accountSnap?.exists) throw new HttpsError("not-found", "Card non trovata.");
  if (action === "lookup") return { account: accountResult(accountSnap), config };

  if (!config.attiva) throw new HttpsError("failed-precondition", "Il programma fidelity è disattivato.");
  const accountRef = accountSnap.ref;
  const sourceId = request.data.sourceId ? requireId(request.data.sourceId, "sourceId") : randomBytes(8).toString("hex");
  const transactionRef = accountRef.collection("transactions").doc(sourceId);

  if (action === "earn") {
    const importo = request.data.importo;
    if (!Number.isInteger(importo) || Number(importo) <= 0) throw new HttpsError("invalid-argument", "Importo non valido.");
    const punti = Math.floor(Number(importo) / 100) * config.puntiPerEuro;
    if (punti <= 0) throw new HttpsError("invalid-argument", "L'importo non genera punti.");
    await db.runTransaction(async (transaction) => {
      const [freshAccount, duplicate] = await Promise.all([transaction.get(accountRef), transaction.get(transactionRef)]);
      if (duplicate.exists) throw new HttpsError("already-exists", "Questa operazione è già stata registrata.");
      const current = Number(freshAccount.data()?.punti) || 0;
      transaction.update(accountRef, {
        punti: current + punti,
        puntiTotali: FieldValue.increment(punti),
        visite: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(transactionRef, {
        tipo: "accredito", punti, importo, descrizione: request.data.descrizione?.trim() || "Acquisto in salone",
        operatorId: actor.uid, createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { account: accountResult(await accountRef.get()), puntiAccreditati: punti, config };
  }

  if (action === "redeem") {
    await db.runTransaction(async (transaction) => {
      const freshAccount = await transaction.get(accountRef);
      const current = Number(freshAccount.data()?.punti) || 0;
      if (current < config.sogliaPremio) throw new HttpsError("failed-precondition", "Punti insufficienti per questo premio.");
      transaction.update(accountRef, {
        punti: current - config.sogliaPremio,
        puntiRiscattati: FieldValue.increment(config.sogliaPremio),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(transactionRef, {
        tipo: "riscatto", punti: -config.sogliaPremio, descrizione: config.premioNome,
        operatorId: actor.uid, createdAt: FieldValue.serverTimestamp(),
      });
    });
    return { account: accountResult(await accountRef.get()), config };
  }

  throw new HttpsError("invalid-argument", "Operazione fidelity non valida.");
});
