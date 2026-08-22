import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";

const useEmulator =
  import.meta.env?.VITE_USE_EMULATOR === "true" ||
  import.meta.env?.MODE === "test";

const config = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY ?? "demo-api-key",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN ?? "demo.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID ?? "demo-barbershop",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID ?? "demo-app-id",
};

export const app: FirebaseApp = initializeApp(config);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app);

let emulatorsConnected = false;
/** Aggancia auth+firestore+functions agli emulatori. Idempotente. */
export function connectEmulators(
  host = "127.0.0.1",
  authPort = 9099,
  firestorePort = 8085
): void {
  if (emulatorsConnected) return;
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, firestorePort);
  connectFunctionsEmulator(functions, host, 5001);
  emulatorsConnected = true;
}

if (useEmulator) {
  connectEmulators();
}
