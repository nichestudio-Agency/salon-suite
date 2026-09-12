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
