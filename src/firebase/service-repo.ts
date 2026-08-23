import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
import type { Service } from "../domain/models";

export type ServiceWithId = Service & { id: string };

const servicesCol = (salonId: string) =>
  collection(db, "salons", salonId, "services");

export async function listServices(salonId: string): Promise<ServiceWithId[]> {
  const snap = await getDocs(servicesCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Service) }));
}

export async function createService(salonId: string, data: Service): Promise<string> {
  const ref = await addDoc(servicesCol(salonId), data);
  return ref.id;
}

export async function updateService(
  salonId: string, id: string, data: Partial<Service>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "services", id), data);
}

export async function deleteService(salonId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "salons", salonId, "services", id));
}
