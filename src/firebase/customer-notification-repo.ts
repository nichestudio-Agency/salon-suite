import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "./app";

export type CustomerNotificationKind = "booking" | "order" | "waitlist" | "birthday" | "campaign" | "general";

export interface CustomerNotification {
  id: string;
  title: string;
  body: string;
  kind: CustomerNotificationKind;
  read: boolean;
  createdAtMs: number;
  bookingId?: string;
  orderId?: string;
  couponId?: string;
  waitlistEntryId?: string;
}

function notificationKind(data: Record<string, unknown>): CustomerNotificationKind {
  if (data.tipo === "compleanno") return "birthday";
  if (typeof data.bookingId === "string") return "booking";
  if (typeof data.orderId === "string") return "order";
  if (typeof data.waitlistEntryId === "string") return "waitlist";
  if (typeof data.campaignId === "string" || typeof data.couponId === "string") return "campaign";
  return "general";
}

export async function listMyNotifications(salonId: string): Promise<CustomerNotification[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utente non autenticato.");
  const snapshot = await getDocs(query(
    collection(db, "salons", salonId, "notifications"),
    where("clientId", "==", uid),
  ));
  return snapshot.docs.map((item) => {
    const data = item.data();
    return {
      id: item.id,
      title: String(data.title ?? data.titolo ?? "Aggiornamento dal salone"),
      body: String(data.body ?? data.testo ?? "Apri l’app per vedere i dettagli."),
      kind: notificationKind(data),
      read: data.read === true,
      createdAtMs: data.createdAt?.toMillis?.() ?? 0,
      ...(typeof data.bookingId === "string" ? { bookingId: data.bookingId } : {}),
      ...(typeof data.orderId === "string" ? { orderId: data.orderId } : {}),
      ...(typeof data.couponId === "string" ? { couponId: data.couponId } : {}),
      ...(typeof data.waitlistEntryId === "string" ? { waitlistEntryId: data.waitlistEntryId } : {}),
    };
  }).sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export async function markNotificationRead(salonId: string, notificationId: string): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "notifications", notificationId), { read: true });
}

export async function markAllNotificationsRead(salonId: string, notifications: CustomerNotification[]): Promise<void> {
  await Promise.all(notifications.filter((item) => !item.read).map((item) => markNotificationRead(salonId, item.id)));
}
