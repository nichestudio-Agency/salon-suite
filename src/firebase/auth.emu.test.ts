import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getDoc, doc } from "firebase/firestore";
import { auth, db, connectEmulators } from "./app";
import { registerClient, signIn, signOutUser } from "./auth";
import type { UserProfile } from "../domain/models";

beforeAll(() => {
  connectEmulators();
});

afterEach(async () => {
  await signOutUser();
});

describe("registerClient", () => {
  it("crea l'utente auth e il documento profilo con sesso e data di nascita", async () => {
    const email = `mario_${Date.now()}@example.com`;
    const cred = await registerClient({
      email,
      password: "password123",
      nome: "Mario Rossi",
      sesso: "maschile",
      dataNascita: "1996-05-14",
    });

    expect(cred.uid).toBeTruthy();
    expect(auth.currentUser?.uid).toBe(cred.uid);

    const snap = await getDoc(doc(db, "users", cred.uid));
    expect(snap.exists()).toBe(true);
    const data = snap.data() as UserProfile;
    expect(data.nome).toBe("Mario Rossi");
    expect(data.email).toBe(email);
    expect(data.sesso).toBe("maschile");
    expect(data.dataNascita).toBe("1996-05-14");
    expect(data.ruolo).toBe("cliente");
    expect(data.fcmTokens).toEqual([]);
  });
});

describe("signIn / signOutUser", () => {
  it("accede con credenziali valide ed esce", async () => {
    const email = `luca_${Date.now()}@example.com`;
    await registerClient({
      email,
      password: "password123",
      nome: "Luca Bianchi",
      sesso: "maschile",
      dataNascita: "2000-01-01",
    });
    await signOutUser();
    expect(auth.currentUser).toBeNull();

    const cred = await signIn(email, "password123");
    expect(cred.uid).toBeTruthy();
    expect(auth.currentUser?.uid).toBe(cred.uid);
  });
});
