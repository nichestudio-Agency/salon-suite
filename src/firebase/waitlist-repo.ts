import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { WaitlistEntry } from "../domain/models";
import { auth, db, functions } from "./app";

export type WaitlistEntryWithId = WaitlistEntry & { id: string };

interface JoinWaitlistInput {
  action: "join";
  salonId: string;
  operatorId: string;
  serviceId: string;
  serviceIds?: string[];
  date: string;
}

interface CancelWaitlistInput {
  action: "cancel";
  salonId: string;
  entryId: string;
}

export async function joinWaitlist(input: Omit<JoinWaitlistInput, "action">): Promise<{ entryId: string; status: "active" }> {
  const callable = httpsCallable<JoinWaitlistInput, { entryId: string; status: "active" }>(functions, "manageWaitlist");
  return (await callable({ action: "join", ...input })).data;
}

export async function cancelWaitlist(salonId: string, entryId: string): Promise<void> {
  const callable = httpsCallable<CancelWaitlistInput, { entryId: string; status: "cancelled" }>(functions, "manageWaitlist");
  await callable({ action: "cancel", salonId, entryId });
}

export async function listMyWaitlist(salonId: string): Promise<WaitlistEntryWithId[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utente non autenticato.");
  const snap = await getDocs(query(collection(db, "salons", salonId, "waitlist"), where("clientId", "==", uid)));
  return snap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as WaitlistEntry) }))
    .filter((entry) => entry.status === "active")
    .sort((a, b) => a.date.localeCompare(b.date));
}
