import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "./app";
import type { Salon } from "../domain/models";
import type { WeeklyHours } from "../domain/availability";

export type SalonWithId = Salon & { id: string };

export async function listSalons(): Promise<SalonWithId[]> {
  const snap = await getDocs(collection(db, "salons"));
  return snap.docs.map((salon) => ({
    id: salon.id,
    ...(salon.data() as Salon),
  }));
}

export async function getSalon(salonId: string): Promise<Salon | null> {
  const snap = await getDoc(doc(db, "salons", salonId));
  return snap.exists() ? (snap.data() as Salon) : null;
}

export async function resolveSalonAccessCode(code: string): Promise<SalonWithId | null> {
  const accessSnap = await getDoc(doc(db, "salonAccessCodes", code));
  if (!accessSnap.exists() || accessSnap.data().attivo !== true) return null;
  const salonId = String(accessSnap.data().salonId ?? "");
  if (!salonId) return null;
  const salon = await getSalon(salonId);
  return salon ? { id: salonId, ...salon } : null;
}

export async function updateOpeningHours(
  salonId: string, orariApertura: WeeklyHours
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId), { orariApertura });
}

import type { CompleannoConfig } from "../domain/models";

export async function updateBirthdayConfig(
  salonId: string,
  compleanno: CompleannoConfig
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId), { compleanno });
}
