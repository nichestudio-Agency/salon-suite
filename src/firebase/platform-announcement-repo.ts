import { addDoc, collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "./app";
import type { PlatformAnnouncement } from "../domain/models";

export type PlatformAnnouncementWithId = PlatformAnnouncement & { id: string };
export async function createPlatformAnnouncement(data: Omit<PlatformAnnouncement, "createdAtMs">): Promise<string> {
  const ref = await addDoc(collection(db, "platformAnnouncements"), { ...data, createdAtMs: Date.now(), createdAt: serverTimestamp() }); return ref.id;
}
export async function listPlatformAnnouncements(salonId: string): Promise<PlatformAnnouncementWithId[]> {
  const [all, targeted] = await Promise.all([
    getDocs(query(collection(db, "platformAnnouncements"), where("audience", "==", "all"))),
    getDocs(query(collection(db, "platformAnnouncements"), where("audience", "==", "salon"), where("salonId", "==", salonId))),
  ]);
  const byId = new Map([...all.docs, ...targeted.docs].map((item) => [item.id, { id: item.id, ...(item.data() as PlatformAnnouncement) }])); return [...byId.values()].sort((a, b) => b.createdAtMs - a.createdAtMs);
}
