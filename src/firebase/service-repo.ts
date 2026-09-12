import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./app";
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
  const serviceRef = doc(db, "salons", salonId, "services", id);
  const snapshot = await getDoc(serviceRef);
  const fotoPath = snapshot.data()?.fotoPath as string | undefined;
  if (fotoPath) {
    try { await deleteObject(ref(storage, fotoPath)); } catch { /* best effort */ }
  }
  await deleteDoc(serviceRef);
}

export async function uploadServicePhoto(salonId: string, serviceId: string, file: Blob, filename: string) {
  const fotoPath = `salons/${salonId}/services/${serviceId}/${filename}`;
  const storageRef = ref(storage, fotoPath);
  await uploadBytes(storageRef, file);
  return { fotoUrl: await getDownloadURL(storageRef), fotoPath };
}
