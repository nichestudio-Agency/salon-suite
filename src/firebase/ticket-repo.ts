import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "./app";
import type { Ticket, TicketAttachment, TicketChannel, TicketMessage, TicketPriority, TicketStatus } from "../domain/models";

export type TicketWithId = Ticket & { id: string };
export type TicketMessageWithId = TicketMessage & { id: string };

export async function createTicket(input: { salonId: string; channel: TicketChannel; oggetto: string; categoria: string; priorita: TicketPriority; requesterName: string; testo: string; allegati: TicketAttachment[] }): Promise<string> {
  const user = auth.currentUser; if (!user) throw new Error("Devi essere autenticato.");
  const now = Date.now(); const ticketRef = doc(collection(db, "tickets")); const messageRef = doc(collection(ticketRef, "messages")); const batch = writeBatch(db);
  batch.set(ticketRef, { salonId: input.salonId, channel: input.channel, oggetto: input.oggetto.trim(), categoria: input.categoria, priorita: input.priorita, stato: "aperto", requesterId: user.uid, requesterName: input.requesterName.trim() || user.email || "Utente", requesterRole: input.channel === "cliente_salone" ? "cliente" : "owner", createdAtMs: now, updatedAtMs: now, lastMessage: input.testo.trim(), messageCount: 1, lastSenderRole: input.channel === "cliente_salone" ? "cliente" : "salone", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  batch.set(messageRef, { senderId: user.uid, senderName: input.requesterName.trim() || user.email || "Utente", senderRole: input.channel === "cliente_salone" ? "cliente" : "salone", testo: input.testo.trim(), allegati: input.allegati, createdAtMs: now, createdAt: serverTimestamp() });
  await batch.commit(); return ticketRef.id;
}

export async function listMyTickets(channel: TicketChannel, salonId?: string): Promise<TicketWithId[]> {
  const user = auth.currentUser; if (!user) throw new Error("Devi essere autenticato.");
  const snap = await getDocs(query(collection(db, "tickets"), where("requesterId", "==", user.uid)));
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Ticket) })).filter((item) => item.channel === channel && (!salonId || item.salonId === salonId)).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export async function listSalonTickets(salonId: string, channel: TicketChannel): Promise<TicketWithId[]> {
  const snap = await getDocs(query(collection(db, "tickets"), where("salonId", "==", salonId)));
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Ticket) })).filter((item) => item.channel === channel).sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export async function listPlatformTickets(): Promise<TicketWithId[]> {
  const snap = await getDocs(collection(db, "tickets"));
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Ticket) })).filter((item) => item.channel === "salone_piattaforma").sort((a, b) => b.updatedAtMs - a.updatedAtMs);
}

export async function listTicketMessages(ticketId: string): Promise<TicketMessageWithId[]> {
  const snap = await getDocs(collection(db, "tickets", ticketId, "messages"));
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as TicketMessage) })).sort((a, b) => a.createdAtMs - b.createdAtMs);
}

export async function sendTicketMessage(input: { ticket: TicketWithId; senderName: string; senderRole: TicketMessage["senderRole"]; testo: string; allegati: TicketAttachment[] }): Promise<void> {
  const user = auth.currentUser; if (!user) throw new Error("Devi essere autenticato."); const now = Date.now();
  await addDoc(collection(db, "tickets", input.ticket.id, "messages"), { senderId: user.uid, senderName: input.senderName.trim() || user.email || "Utente", senderRole: input.senderRole, testo: input.testo.trim(), allegati: input.allegati, createdAtMs: now, createdAt: serverTimestamp() });
  await updateDoc(doc(db, "tickets", input.ticket.id), { lastMessage: input.testo.trim() || "Allegato", lastSenderRole: input.senderRole, updatedAtMs: now, updatedAt: serverTimestamp(), messageCount: input.ticket.messageCount + 1, ...(input.ticket.stato === "risolto" || input.ticket.stato === "chiuso" ? { stato: "aperto" } : {}) });
}

export async function updateTicketStatus(ticketId: string, stato: TicketStatus): Promise<void> {
  await updateDoc(doc(db, "tickets", ticketId), { stato, updatedAtMs: Date.now(), updatedAt: serverTimestamp() });
}
