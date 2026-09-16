import { httpsCallable } from "firebase/functions";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where, type Timestamp } from "firebase/firestore";
import { db, functions } from "./app";
import type { ClientVisit, Gender, ManualClient } from "../domain/models";

export interface SalonClient {
  id: string;
  nome: string;
  email: string;
  sesso: Gender;
  dataNascita: string;
  hasPush: boolean;
  bookingCount: number;
  lastBookingDate: string | null;
  orderCount: number;
  lastOrderDate: string | null;
  visitCount?: number;
  lastVisitDate?: string | null;
  totalSpent: number;
  source?: "account" | "manual";
  telefono?: string;
}

export type ClientHistoryKind = "prenotazione" | "acquisto" | "ordine" | "visita" | "coupon" | "fidelity";
export interface ClientHistoryEntry {
  id: string;
  kind: ClientHistoryKind;
  date: string;
  title: string;
  detail?: string;
  amount?: number;
  operatorId?: string;
  couponCode?: string;
  points?: number;
  status?: string;
}

function timestampDate(value: unknown) {
  const raw = value as { toDate?: () => Date } | string | undefined;
  if (typeof raw === "string") return raw.slice(0, 10);
  return raw?.toDate?.().toISOString().slice(0, 10) ?? "";
}

export async function getClientHistory(salonId: string, clientId: string): Promise<ClientHistoryEntry[]> {
  const [bookings, sales, orders, visits, coupons, loyalty] = await Promise.all([
    getDocs(collection(db, `salons/${salonId}/bookings`)),
    getDocs(collection(db, `salons/${salonId}/sales`)),
    getDocs(collection(db, `salons/${salonId}/orders`)),
    getDocs(collection(db, `salons/${salonId}/clientVisits`)),
    getDocs(collection(db, `salons/${salonId}/couponRedemptions`)),
    getDocs(collection(db, `salons/${salonId}/loyaltyAccounts/${clientId}/transactions`)),
  ]);
  const rows: ClientHistoryEntry[] = [];
  for (const item of bookings.docs) { const value = item.data(); if (value.clientId !== clientId) continue; rows.push({ id: `booking-${item.id}`, kind: "prenotazione", date: String(value.date ?? ""), title: (value.serviceItems as Array<{ titolo?: string }> | undefined)?.map((entry) => entry.titolo).filter(Boolean).join(", ") || "Prenotazione", detail: `${String(value.startMin ? `${String(Math.floor(Number(value.startMin) / 60)).padStart(2, "0")}:${String(Number(value.startMin) % 60).padStart(2, "0")}` : "Orario non indicato")} · ${String(value.stato ?? "")}`, amount: Number(value.prezzoFinale) || undefined, operatorId: String(value.performedByOperatorId ?? value.operatorId ?? ""), couponCode: value.couponCode ? String(value.couponCode) : undefined, status: String(value.stato ?? "") }); }
  for (const item of sales.docs) { const value = item.data(); if (value.clientId !== clientId || value.stato === "annullata") continue; const saleItems = value.items as Array<{ titolo?: string; qta?: number; tipo?: string }> | undefined; rows.push({ id: `sale-${item.id}`, kind: "acquisto", date: String(value.date ?? timestampDate(value.createdAt)), title: saleItems?.map((entry) => `${entry.titolo ?? "Articolo"}${Number(entry.qta) > 1 ? ` ×${entry.qta}` : ""}`).join(", ") || "Vendita in salone", detail: saleItems?.some((entry) => entry.tipo === "prodotto") ? "Servizi e/o prodotti acquistati" : "Servizio saldato", amount: Number(value.totale) || 0, operatorId: String(value.performedByOperatorId ?? ""), points: Number(value.loyaltyPointsCredited) || undefined, status: String(value.stato ?? "") }); }
  for (const item of orders.docs) { const value = item.data(); if (value.clientId !== clientId || value.stato === "annullato") continue; const orderItems = value.items as Array<{ titolo?: string; qta?: number }> | undefined; rows.push({ id: `order-${item.id}`, kind: "ordine", date: timestampDate(value.createdAt), title: orderItems?.map((entry) => `${entry.titolo ?? "Prodotto"}${Number(entry.qta) > 1 ? ` ×${entry.qta}` : ""}`).join(", ") || "Ordine prodotti", detail: `Stato: ${String(value.stato ?? "")}`, amount: Number(value.totale) || 0, couponCode: value.couponCode ? String(value.couponCode) : undefined, points: Number(value.pointsEarned) || undefined, status: String(value.stato ?? "") }); }
  for (const item of visits.docs) { const value = item.data(); if (value.clientId !== clientId) continue; rows.push({ id: `visit-${item.id}`, kind: "visita", date: String(value.date ?? timestampDate(value.createdAt)), title: String(value.serviceTitle ?? "Passaggio in salone"), detail: value.note ? String(value.note) : "Inserita manualmente", amount: Number(value.importo) || 0 }); }
  for (const item of coupons.docs) { const value = item.data(); if (value.clientId !== clientId) continue; rows.push({ id: `coupon-${item.id}`, kind: "coupon", date: String(value.appointmentDate ?? timestampDate(value.redeemedAt)), title: `Coupon ${String(value.couponCode ?? "utilizzato")}`, detail: "Coupon riscattato", amount: Number(value.discountAmount) || undefined, couponCode: String(value.couponCode ?? "") }); }
  for (const item of loyalty.docs) { const value = item.data(); rows.push({ id: `loyalty-${item.id}`, kind: "fidelity", date: timestampDate(value.createdAt), title: String(value.descrizione ?? "Movimento fidelity"), detail: String(value.tipo ?? "Movimento punti"), amount: Number(value.importo) || undefined, operatorId: value.operatorId ? String(value.operatorId) : undefined, points: Number(value.punti) || 0 }); }
  return rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export async function listSalonClients(salonId: string): Promise<SalonClient[]> {
  try { return await listSalonClientsDirect(salonId); }
  catch {
    const callable = httpsCallable<{ salonId: string }, { clients: SalonClient[] }>(functions, "listSalonClients");
    return (await callable({ salonId })).data.clients;
  }
}

async function listSalonClientsDirect(salonId: string): Promise<SalonClient[]> {
  const [profiles, manualClients, bookings, orders, visits] = await Promise.all([
    getDocs(query(collection(db, "users"), where("salonId", "==", salonId))),
    getDocs(collection(db, `salons/${salonId}/clients`)),
    getDocs(collection(db, `salons/${salonId}/bookings`)),
    getDocs(collection(db, `salons/${salonId}/orders`)),
    getDocs(collection(db, `salons/${salonId}/clientVisits`)),
  ]);
  const activity = new Map<string, Pick<SalonClient, "bookingCount" | "lastBookingDate" | "orderCount" | "lastOrderDate" | "visitCount" | "lastVisitDate" | "totalSpent">>();
  const stats = (clientId: string) => {
    const current = activity.get(clientId) ?? { bookingCount: 0, lastBookingDate: null, orderCount: 0, lastOrderDate: null, visitCount: 0, lastVisitDate: null, totalSpent: 0 };
    activity.set(clientId, current);
    return current;
  };
  for (const item of bookings.docs) {
    const booking = item.data();
    if (typeof booking.clientId !== "string" || ["annullata", "rifiutata"].includes(String(booking.stato))) continue;
    const current = stats(booking.clientId);
    current.bookingCount++;
    if (typeof booking.date === "string" && (!current.lastBookingDate || booking.date > current.lastBookingDate)) current.lastBookingDate = booking.date;
    if (typeof booking.date === "string" && (!current.lastVisitDate || booking.date > current.lastVisitDate)) current.lastVisitDate = booking.date;
  }
  for (const item of orders.docs) {
    const order = item.data();
    if (typeof order.clientId !== "string" || order.stato === "annullato") continue;
    const current = stats(order.clientId);
    current.orderCount++;
    current.totalSpent += Number(order.totale) || 0;
    const orderDate = (order.createdAt as Timestamp | undefined)?.toDate?.().toISOString().slice(0, 10) ?? null;
    if (orderDate && (!current.lastOrderDate || orderDate > current.lastOrderDate)) current.lastOrderDate = orderDate;
  }
  for (const item of visits.docs) {
    const visit = item.data();
    if (typeof visit.clientId !== "string") continue;
    const current = stats(visit.clientId);
    current.visitCount = (current.visitCount ?? 0) + 1;
    current.totalSpent += Number(visit.importo) || 0;
    if (typeof visit.date === "string" && (!current.lastVisitDate || visit.date > current.lastVisitDate)) current.lastVisitDate = visit.date;
  }
  const registered = profiles.docs.filter((item) => item.data().ruolo === "cliente").map((item) => {
    const profile = item.data();
    return {
      id: item.id,
      nome: typeof profile.nome === "string" ? profile.nome : "Cliente",
      email: typeof profile.email === "string" ? profile.email : "",
      sesso: profile.sesso ?? "altro",
      dataNascita: typeof profile.dataNascita === "string" ? profile.dataNascita : "",
      hasPush: Array.isArray(profile.fcmTokens) && profile.fcmTokens.length > 0,
      source: "account",
      ...stats(item.id),
    } as SalonClient;
  });
  const manual = manualClients.docs.map((item) => {
    const profile = item.data();
    return {
      id: item.id,
      nome: typeof profile.nome === "string" ? profile.nome : "Cliente",
      email: typeof profile.email === "string" ? profile.email : "",
      sesso: profile.sesso ?? "altro",
      dataNascita: typeof profile.dataNascita === "string" ? profile.dataNascita : "",
      hasPush: false,
      source: "manual",
      ...stats(item.id),
    } as SalonClient;
  });
  return [...registered, ...manual].sort((a, b) => a.nome.localeCompare(b.nome, "it"));
}

export async function createManualClient(salonId: string, data: ManualClient): Promise<string> {
  const ref = await addDoc(collection(db, `salons/${salonId}/clients`), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return ref.id;
}

export async function updateManualClient(salonId: string, clientId: string, data: Partial<ManualClient>): Promise<void> {
  await updateDoc(doc(db, `salons/${salonId}/clients/${clientId}`), { ...data, updatedAt: serverTimestamp() });
}

export async function recordClientVisit(salonId: string, visit: ClientVisit): Promise<void> {
  await addDoc(collection(db, `salons/${salonId}/clientVisits`), { ...visit, createdAt: serverTimestamp() });
}
