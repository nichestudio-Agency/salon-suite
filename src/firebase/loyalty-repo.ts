import { httpsCallable } from "firebase/functions";
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, serverTimestamp, updateDoc, where, type Timestamp } from "firebase/firestore";
import type { FidelityConfig, FidelityReward, LoyaltyAccount, LoyaltyTransaction, RewardRedemption } from "../domain/models";
import { auth, db, functions } from "./app";

interface LoyaltyResponse {
  account?: LoyaltyAccount;
  accounts?: LoyaltyAccount[];
  config: FidelityConfig;
  transactions?: LoyaltyTransaction[];
  puntiAccreditati?: number;
}

type LoyaltyAction = "getMine" | "list" | "lookup" | "earn" | "redeem";

async function callLoyalty(data: {
  action: LoyaltyAction;
  salonId: string;
  codice?: string;
  clientId?: string;
  importo?: number;
  sourceId?: string;
  descrizione?: string;
}): Promise<LoyaltyResponse> {
  const callable = httpsCallable<typeof data, LoyaltyResponse>(functions, "loyaltyProgram");
  return (await callable(data)).data;
}

const DEFAULT_CONFIG: FidelityConfig = { attiva: true, puntiPerEuro: 1, sogliaPremio: 100, premioNome: "Buono da 10 €", premioValore: 1000 };

async function getConfig(salonId: string): Promise<FidelityConfig> {
  const salon = await getDoc(doc(db, "salons", salonId));
  return (salon.data()?.fidelity ?? DEFAULT_CONFIG) as FidelityConfig;
}

function accountFromDoc(item: { id: string; data(): Record<string, unknown> | undefined }): LoyaltyAccount {
  const data = item.data() ?? {};
  return {
    clientId: item.id,
    codice: String(data.codice ?? ""), nome: String(data.nome ?? "Cliente"), email: String(data.email ?? ""),
    punti: Number(data.punti) || 0, puntiTotali: Number(data.puntiTotali) || 0,
    puntiRiscattati: Number(data.puntiRiscattati) || 0, visite: Number(data.visite) || 0,
  };
}

export async function getMyLoyalty(salonId: string): Promise<LoyaltyResponse> {
  try { return await callLoyalty({ action: "getMine", salonId }); }
  catch {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("unauthenticated");
    const accountRef = doc(db, `salons/${salonId}/loyaltyAccounts/${uid}`);
    const [account, transactions, config] = await Promise.all([
      getDoc(accountRef),
      getDocs(query(collection(accountRef, "transactions"), orderBy("createdAt", "desc"), limit(20))),
      getConfig(salonId),
    ]);
    if (!account.exists()) return { config };
    return {
      account: accountFromDoc(account), config,
      transactions: transactions.docs.map((item) => {
        const data = item.data();
        return { id: item.id, tipo: data.tipo, punti: Number(data.punti) || 0, descrizione: String(data.descrizione ?? "Movimento"), ...(data.importo ? { importo: Number(data.importo) } : {}), createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.().toISOString() ?? new Date().toISOString() } as LoyaltyTransaction;
      }),
    };
  }
}

export async function listLoyaltyAccounts(salonId: string): Promise<LoyaltyResponse> {
  try { return await callLoyalty({ action: "list", salonId }); }
  catch {
    const [accounts, config] = await Promise.all([
      getDocs(query(collection(db, `salons/${salonId}/loyaltyAccounts`), orderBy("updatedAt", "desc"), limit(100))),
      getConfig(salonId),
    ]);
    return { accounts: accounts.docs.map(accountFromDoc), config };
  }
}

export async function lookupLoyaltyCard(salonId: string, codice: string): Promise<LoyaltyResponse> {
  try { return await callLoyalty({ action: "lookup", salonId, codice }); }
  catch {
    const [accounts, config] = await Promise.all([
      getDocs(query(collection(db, `salons/${salonId}/loyaltyAccounts`), where("codice", "==", codice.trim().toUpperCase()), limit(1))),
      getConfig(salonId),
    ]);
    return { account: accounts.empty ? undefined : accountFromDoc(accounts.docs[0]), config };
  }
}

export function creditLoyaltyPoints(salonId: string, clientId: string, importo: number, descrizione: string) {
  return callLoyalty({ action: "earn", salonId, clientId, importo, descrizione }).catch(async () => {
    const config = await getConfig(salonId); const points = Math.floor(importo / 100) * config.puntiPerEuro;
    const ref = doc(db, `salons/${salonId}/loyaltyAccounts/${clientId}`);
    await runTransaction(db, async (transaction) => { const snap = await transaction.get(ref); if (!snap.exists()) throw new Error("not-found"); const data = snap.data(); transaction.update(ref, { punti: (Number(data.punti) || 0) + points, puntiTotali: (Number(data.puntiTotali) || 0) + points, visite: (Number(data.visite) || 0) + 1, updatedAt: serverTimestamp() }); });
    await addDoc(collection(ref, "transactions"), { tipo: "accredito", punti: points, importo, descrizione, createdAt: serverTimestamp() });
    const snap = await getDoc(ref); return { account: accountFromDoc(snap), config, puntiAccreditati: points };
  });
}

export function redeemLoyaltyReward(salonId: string, clientId: string) {
  return callLoyalty({ action: "redeem", salonId, clientId });
}

export async function updateFidelityConfig(salonId: string, fidelity: FidelityConfig) {
  await updateDoc(doc(db, "salons", salonId), { fidelity });
}

function redemptionFromDoc(item: { id: string; data(): Record<string, unknown> | undefined }): RewardRedemption {
  const data = item.data() ?? {}; const stamp = data.createdAt as Timestamp | undefined; const used = data.usedAt as Timestamp | undefined;
  return { id: item.id, clientId: String(data.clientId), clientNome: String(data.clientNome ?? "Cliente"), rewardId: String(data.rewardId), rewardNome: String(data.rewardNome), punti: Number(data.punti), codice: String(data.codice), stato: data.stato as RewardRedemption["stato"], createdAt: stamp?.toDate?.().toISOString() ?? new Date().toISOString(), ...(used ? { usedAt: used.toDate().toISOString() } : {}) };
}

export async function requestRewardRedemption(salonId: string, reward: FidelityReward): Promise<RewardRedemption> {
  const uid = auth.currentUser?.uid; if (!uid) throw new Error("unauthenticated");
  const accountRef = doc(db, `salons/${salonId}/loyaltyAccounts/${uid}`); const account = await getDoc(accountRef);
  if (!account.exists() || Number(account.data().punti) < reward.punti) throw new Error("failed-precondition");
  const code = `PREMIO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const ref = await addDoc(collection(db, `salons/${salonId}/rewardRedemptions`), { clientId: uid, clientNome: String(account.data().nome ?? "Cliente"), rewardId: reward.id, rewardNome: reward.nome, punti: reward.punti, codice: code, stato: "emesso", createdAt: serverTimestamp() });
  return { id: ref.id, clientId: uid, clientNome: String(account.data().nome ?? "Cliente"), rewardId: reward.id, rewardNome: reward.nome, punti: reward.punti, codice: code, stato: "emesso", createdAt: new Date().toISOString() };
}

export async function listMyRewardRedemptions(salonId: string): Promise<RewardRedemption[]> {
  const uid = auth.currentUser?.uid; if (!uid) return [];
  const snap = await getDocs(query(collection(db, `salons/${salonId}/rewardRedemptions`), where("clientId", "==", uid)));
  return snap.docs.map(redemptionFromDoc).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function validateRewardRedemption(salonId: string, rawCode: string): Promise<RewardRedemption> {
  const code = rawCode.startsWith("salon-reward:") ? rawCode.split(":").at(-1)! : rawCode.trim().toUpperCase();
  const results = await getDocs(query(collection(db, `salons/${salonId}/rewardRedemptions`), where("codice", "==", code), limit(1)));
  if (results.empty) throw new Error("not-found"); const redemptionRef = results.docs[0].ref;
  await runTransaction(db, async (transaction) => { const redemption = await transaction.get(redemptionRef); const data = redemption.data()!; if (data.stato !== "emesso") throw new Error("already-exists"); const accountRef = doc(db, `salons/${salonId}/loyaltyAccounts/${data.clientId}`); const account = await transaction.get(accountRef); if (!account.exists() || Number(account.data().punti) < Number(data.punti)) throw new Error("failed-precondition"); transaction.update(accountRef, { punti: Number(account.data().punti) - Number(data.punti), puntiRiscattati: (Number(account.data().puntiRiscattati) || 0) + Number(data.punti), updatedAt: serverTimestamp() }); transaction.update(redemptionRef, { stato: "utilizzato", usedAt: serverTimestamp() }); });
  const updated = await getDoc(redemptionRef); return redemptionFromDoc(updated);
}
