import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
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
  await deleteDoc(doc(db, "salons", salonId, "operators", id));
}
