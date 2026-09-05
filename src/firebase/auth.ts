import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./app";
import type { Gender, UserProfile } from "../domain/models";

export interface RegisterClientInput {
  email: string;
  password: string;
  nome: string;
  sesso: Gender;
  /** "YYYY-MM-DD" */
  dataNascita: string;
  /** Tenant white-label da cui il cliente si registra. */
  salonId?: string;
}

export interface AuthResult {
  uid: string;
  ruolo?: UserProfile["ruolo"];
  salonId?: string;
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
    ...(input.salonId ? { salonId: input.salonId } : {}),
    fcmTokens: [],
  };
  try {
    await setDoc(doc(db, "users", cred.user.uid), profile);
  } catch (error) {
    // La registrazione è atomica dal punto di vista dell'app: niente account
    // Auth privi del profilo necessario per determinare ruolo e tenant.
    await deleteUser(cred.user).catch(() => undefined);
    throw error;
  }
  return { uid: cred.user.uid };
}

/** Accede con email e password. */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getDoc(doc(db, "users", cred.user.uid));
  const data = profile.data() as Partial<UserProfile> | undefined;
  return {
    uid: cred.user.uid,
    ...(data?.ruolo ? { ruolo: data.ruolo } : {}),
    ...(data?.salonId ? { salonId: data.salonId } : {}),
  };
}

/** Esce dall'account corrente. */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}
