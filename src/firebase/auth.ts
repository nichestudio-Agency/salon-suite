import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInWithEmailAndPassword,
  signOut,
  updateCurrentUser,
} from "firebase/auth";
import { UserImpl } from "@firebase/auth/internal";
import { Capacitor } from "@capacitor/core";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./app";
import type { Gender, UserProfile } from "../domain/models";
import { getEmulatorDocument } from "./emulator-rest";

const useEmulator = import.meta.env?.VITE_USE_EMULATOR === "true";
const firebaseApiKey = import.meta.env?.VITE_FIREBASE_API_KEY ?? "demo-api-key";

interface EmulatorPasswordResponse {
  localId: string;
  email?: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface EmulatorAccountResponse {
  users: Array<{
    localId: string;
    email?: string;
    displayName?: string;
    emailVerified?: boolean;
    passwordHash?: string;
    createdAt?: number;
    lastLoginAt?: number;
    providerUserInfo?: Array<Record<string, unknown>>;
  }>;
}

function withTimeout<T>(promise: Promise<T>, milliseconds = 10_000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("auth-timeout")), milliseconds)),
  ]);
}

/**
 * WKWebView può lasciare pendente la strategia email/password del Web SDK
 * quando Auth gira sull'emulatore HTTP. Usiamo gli stessi endpoint REST e poi
 * consegniamo l'utente risultante all'istanza Firebase: in questo modo anche
 * Firestore e Functions ricevono normalmente il token dell'utente.
 */
async function signInWithEmulatorRest(email: string, password: string) {
  const base = "http://localhost:9099/identitytoolkit.googleapis.com/v1";
  const passwordResponse = await withTimeout(fetch(
    `${base}/accounts:signInWithPassword?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  ));
  if (!passwordResponse.ok) throw new Error("invalid-credentials");
  const tokens = await passwordResponse.json() as EmulatorPasswordResponse;

  const accountResponse = await withTimeout(fetch(
    `${base}/accounts:lookup?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: tokens.idToken }),
    },
  ));
  if (!accountResponse.ok) throw new Error("invalid-account");
  const account = await accountResponse.json() as EmulatorAccountResponse;
  if (!account.users?.[0]) throw new Error("invalid-account");

  const user = await UserImpl._fromGetAccountInfoResponse(
    auth as never,
    account as never,
    tokens.idToken,
  );
  // Il refresh token non fa parte della risposta accounts:lookup, ma serve a
  // mantenere valida la sessione oltre la prima ora.
  user.stsTokenManager.refreshToken = tokens.refreshToken;
  user.stsTokenManager.expirationTime = Date.now() + Number(tokens.expiresIn || 3600) * 1000;
  await updateCurrentUser(auth, user);
  return { user };
}

export async function getUserProfile(uid: string, idToken?: string): Promise<Partial<UserProfile> | null> {
  if (useEmulator) {
    return await getEmulatorDocument(`users/${encodeURIComponent(uid)}`, idToken) as Partial<UserProfile> | null;
  }
  const profile = await getDoc(doc(db, "users", uid));
  return profile.exists() ? profile.data() as Partial<UserProfile> : null;
}

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
  const normalizedEmail = email.trim();
  const cred = useEmulator && Capacitor.isNativePlatform()
    ? await signInWithEmulatorRest(normalizedEmail, password)
    : await withTimeout(signInWithEmailAndPassword(auth, normalizedEmail, password));
  const data = await withTimeout(getUserProfile(cred.user.uid, await cred.user.getIdToken()));
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
