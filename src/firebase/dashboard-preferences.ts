import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./app";

export type DashboardShortcutId = "agenda" | "nuovo_cliente" | "nuovo_prodotto" | "nuovo_coupon" | "nuovo_operatore" | "assistenza";
export interface DashboardPreferences { shortcuts: DashboardShortcutId[]; lastNotificationsReadAt: number; }
export const DEFAULT_SHORTCUTS: DashboardShortcutId[] = ["agenda", "nuovo_cliente", "nuovo_prodotto", "nuovo_coupon"];

export async function getDashboardPreferences(uid: string): Promise<DashboardPreferences> {
  const snap = await getDoc(doc(db, "users", uid, "preferences", "dashboard")); const data = snap.data();
  return { shortcuts: Array.isArray(data?.shortcuts) ? data.shortcuts as DashboardShortcutId[] : DEFAULT_SHORTCUTS, lastNotificationsReadAt: Number(data?.lastNotificationsReadAt) || 0 };
}

export async function saveDashboardShortcuts(uid: string, shortcuts: DashboardShortcutId[]): Promise<void> {
  await setDoc(doc(db, "users", uid, "preferences", "dashboard"), { shortcuts, updatedAt: serverTimestamp() }, { merge: true });
}

export async function markDashboardNotificationsRead(uid: string, timestamp = Date.now()): Promise<void> {
  await setDoc(doc(db, "users", uid, "preferences", "dashboard"), { lastNotificationsReadAt: timestamp, updatedAt: serverTimestamp() }, { merge: true });
}
