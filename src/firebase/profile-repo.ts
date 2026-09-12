import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./app";
import type { Gender, UserProfile } from "../domain/models";

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, "users", uid));
  return snapshot.exists() ? snapshot.data() as UserProfile : null;
}

export async function updateUserProfile(uid: string, input: { nome: string; sesso: Gender; dataNascita: string }): Promise<void> {
  await updateDoc(doc(db, "users", uid), {
    nome: input.nome.trim(),
    sesso: input.sesso,
    dataNascita: input.dataNascita,
  });
}
