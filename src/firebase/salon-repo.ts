import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./app";
import type { Salon } from "../domain/models";
import type { WeeklyHours } from "../domain/availability";

export async function getSalon(salonId: string): Promise<Salon | null> {
  const snap = await getDoc(doc(db, "salons", salonId));
  return snap.exists() ? (snap.data() as Salon) : null;
}

export async function updateOpeningHours(
  salonId: string, orariApertura: WeeklyHours
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId), { orariApertura });
}
