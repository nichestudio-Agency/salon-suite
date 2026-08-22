import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./app";
import type { Gender, UserProfile } from "../domain/models";

export interface RegisterClientInput {
  email: string;
  password: string;
  nome: string;
  sesso: Gender;
  /** "YYYY-MM-DD" */
  dataNascita: string;
}

export interface AuthResult {
  uid: string;
}

/** Registra un cliente: crea l'utente auth e il suo documento profilo. */
export async function registerClient(
  input: RegisterClientInput
): Promise<AuthResult> {
  const cred = await createUserWithEmailAndPassword(
    auth,
    input.email,
    input.password
  );
  const profile: UserProfile = {
    nome: input.nome,
    email: input.email,
    sesso: input.sesso,
    dataNascita: input.dataNascita,
    ruolo: "cliente",
    fcmTokens: [],
  };
  // Nota: se questa setDoc fallisce dopo la creazione dell'utente auth, l'utente
  // resta orfano (auth creato ma senza profilo). La pulizia (deleteUser) sarà
  // gestita in un increment successivo.
  await setDoc(doc(db, "users", cred.user.uid), profile);
  return { uid: cred.user.uid };
}

/** Accede con email e password. */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return { uid: cred.user.uid };
}

/** Esce dall'account corrente. */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
