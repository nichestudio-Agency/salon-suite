import { listBookings } from "./booking-repo";
import { listSalonOrders } from "./order-repo";
import { listMyTickets, listSalonTickets } from "./ticket-repo";
import { listPlatformAnnouncements } from "./platform-announcement-repo";

export interface DashboardActivityItem { id: string; tipo: "prenotazione" | "ordine" | "ticket" | "piattaforma"; titolo: string; testo: string; timestamp: number; to: string; }
const millis = (value: unknown) => typeof value === "object" && value !== null && "toMillis" in value && typeof (value as { toMillis: () => number }).toMillis === "function" ? (value as { toMillis: () => number }).toMillis() : 0;

export async function listDashboardActivity(salonId: string): Promise<DashboardActivityItem[]> {
  const results = await Promise.allSettled([
    listBookings(salonId),
    listSalonOrders(salonId),
    listSalonTickets(salonId, "cliente_salone"),
    listMyTickets("salone_piattaforma", salonId),
    listPlatformAnnouncements(salonId),
  ]);
  const bookings = results[0].status === "fulfilled" ? results[0].value : [];
  const orders = results[1].status === "fulfilled" ? results[1].value : [];
  const customerTickets = results[2].status === "fulfilled" ? results[2].value : [];
  const supportTickets = results[3].status === "fulfilled" ? results[3].value : [];
  const announcements = results[4].status === "fulfilled" ? results[4].value : [];
  return [
    ...bookings.filter((item) => item.stato === "in_attesa" && millis(item.createdAt)).map((item) => ({ id: `booking-${item.id}`, tipo: "prenotazione" as const, titolo: "Nuova prenotazione", testo: `${item.clientNome ?? "Cliente"} · ${item.date}`, timestamp: millis(item.createdAt), to: "/dashboard/prenotazioni" })),
    ...orders.filter((item) => item.stato === "in_attesa" && millis(item.createdAt)).map((item) => ({ id: `order-${item.id}`, tipo: "ordine" as const, titolo: "Nuovo ordine", testo: `${item.clientNome ?? "Cliente"} · ${item.items.length} prodotti`, timestamp: millis(item.createdAt), to: "/dashboard/ordini" })),
    ...customerTickets.filter((item) => item.lastSenderRole === "cliente").map((item) => ({ id: `ticket-${item.id}-${item.updatedAtMs}`, tipo: "ticket" as const, titolo: "Messaggio da un cliente", testo: `${item.requesterName} · ${item.oggetto}`, timestamp: item.updatedAtMs, to: "/dashboard/assistenza" })),
    ...supportTickets.filter((item) => item.lastSenderRole === "piattaforma").map((item) => ({ id: `support-${item.id}-${item.updatedAtMs}`, tipo: "ticket" as const, titolo: "Risposta di Salon Suite", testo: item.oggetto, timestamp: item.updatedAtMs, to: "/dashboard/assistenza" })),
    ...announcements.map((item) => ({ id: `announcement-${item.id}`, tipo: "piattaforma" as const, titolo: item.titolo, testo: item.testo, timestamp: item.createdAtMs, to: "/dashboard" })),
  ].sort((a, b) => b.timestamp - a.timestamp).slice(0, 30);
}
