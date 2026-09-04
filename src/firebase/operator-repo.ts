import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, deleteField,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "./app";
import type { Operator } from "../domain/models";

export type OperatorWithId = Operator & { id: string };

const operatorsCol = (salonId: string) =>
  collection(db, "salons", salonId, "operators");

export async function listOperators(salonId: string): Promise<OperatorWithId[]> {
  const snap = await getDocs(operatorsCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Operator) }));
}

export async function createOperator(salonId: string, data: Operator): Promise<string> {
  const ref = await addDoc(operatorsCol(salonId), data);
  return ref.id;
}

export async function updateOperator(
  salonId: string, id: string, data: Partial<Operator>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "operators", id), data);
}

export async function deleteOperator(salonId: string, id: string): Promise<void> {
  const operatorRef = doc(db, "salons", salonId, "operators", id);
  const snap = await getDoc(operatorRef);
  const fotoPath = snap.data()?.fotoPath as string | undefined;
  if (fotoPath) {
    try { await deleteObject(ref(storage, fotoPath)); } catch { /* best effort */ }
  }
  await deleteDoc(operatorRef);
}

export async function resetOperatorHours(salonId: string, id: string): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "operators", id), { orariPersonalizzati: deleteField() });
}

export async function uploadOperatorPhoto(salonId: string, operatorId: string, file: Blob, filename: string) {
  const fotoPath = `salons/${salonId}/operators/${operatorId}/${filename}`;
  const storageRef = ref(storage, fotoPath);
  await uploadBytes(storageRef, file);
  return { fotoUrl: await getDownloadURL(storageRef), fotoPath };
}
