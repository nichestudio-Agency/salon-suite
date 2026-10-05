import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { WaitlistEntry } from "../domain/models";
import { auth, db, functions } from "./app";
import { createBooking, type CreateBookingResult } from "./booking";

export type WaitlistEntryWithId = WaitlistEntry & { id: string };

interface JoinWaitlistInput {
  action: "join";
  salonId: string;
  operatorId: string;
  serviceId: string;
  serviceIds?: string[];
  date: string;
  startMin: number;
}

interface CancelWaitlistInput {
  action: "cancel" | "accept";
  salonId: string;
  entryId: string;
  bookingId?: string;
}

export async function joinWaitlist(input: Omit<JoinWaitlistInput, "action">): Promise<{ entryId: string; status: "active" }> {
  const callable = httpsCallable<JoinWaitlistInput, { entryId: string; status: "active" }>(functions, "manageWaitlist");
  return (await callable({ action: "join", ...input })).data;
}

export async function cancelWaitlist(salonId: string, entryId: string): Promise<void> {
  const callable = httpsCallable<CancelWaitlistInput, { entryId: string; status: "cancelled" }>(functions, "manageWaitlist");
  await callable({ action: "cancel", salonId, entryId });
}

/** Conferma lo slot proposto. La creazione della prenotazione resta transazionale e anti-concorrenza. */
export async function acceptWaitlistOffer(salonId: string, entryId: string): Promise<CreateBookingResult> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utente non autenticato.");
  const entrySnap = await getDoc(doc(db, "salons", salonId, "waitlist", entryId));
  if (!entrySnap.exists()) throw new Error("La disponibilità non è più attiva.");
  const entry = entrySnap.data() as WaitlistEntry;
  if (entry.clientId !== uid || entry.status !== "notified") throw new Error("La disponibilità non è più attiva.");
  const created = await createBooking({
    salonId,
    operatorId: entry.operatorId,
    serviceId: entry.serviceIds[0],
    ...(entry.serviceIds.length > 1 ? { serviceIds: entry.serviceIds } : {}),
    date: entry.date,
    startMin: entry.startMin,
  });
  const callable = httpsCallable<CancelWaitlistInput, { entryId: string; status: "accepted" }>(functions, "manageWaitlist");
  await callable({ action: "accept", salonId, entryId, bookingId: created.bookingId });
  return created;
}

export async function listMyWaitlist(salonId: string): Promise<WaitlistEntryWithId[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utente non autenticato.");
  const snap = await getDocs(query(collection(db, "salons", salonId, "waitlist"), where("clientId", "==", uid)));
  return snap.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as WaitlistEntry) }))
    .filter((entry) => entry.status === "active" || entry.status === "notified")
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
}
