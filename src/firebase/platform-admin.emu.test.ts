import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, connectEmulators } from "./app";
import { listPlatformSalons, updatePlatformSalonLicense } from "./platform-admin";
import { registerOwner } from "./onboarding";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  connectEmulators();
  testEnv = await initializeTestEnvironment({
    projectId: "demo-barbershop",
    firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 },
  });
});
afterEach(async () => { await signOut(auth); });
afterAll(async () => { await testEnv.cleanup(); });

async function setupSuperAdmin() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const credential = await createUserWithEmailAndPassword(auth, `admin_${suffix}@example.test`, "password123");
  const salonId = `platform_${suffix}`;
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `users/${credential.user.uid}`), { ruolo: "superadmin", nome: "Admin" });
    await setDoc(doc(db, `salons/${salonId}`), {
      nome: "Salone Platform Test", timezone: "Europe/Rome", dominio: "test.barberia.app",
      licenza: { stato: "trial", piano: "start", scadenza: "2026-12-20", prezzoMensile: 4900 },
    });
  });
  return salonId;
}

describe("amministrazione piattaforma", () => {
  it("consente al super admin di leggere i tenant e aggiornare una licenza", async () => {
    const salonId = await setupSuperAdmin();
    const salons = await listPlatformSalons();
    expect(salons).toEqual(expect.arrayContaining([expect.objectContaining({ id: salonId, nome: "Salone Platform Test" })]));
    await updatePlatformSalonLicense({ salonId, stato: "attiva", piano: "pro", scadenza: "2027-01-31", prezzoMensile: 12900 });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snap = await getDoc(doc(context.firestore(), `salons/${salonId}`));
      expect(snap.data()?.licenza).toMatchObject({ stato: "attiva", piano: "pro", prezzoMensile: 12900 });
    });
  });

  it("nega l'elenco globale al titolare di un singolo salone", async () => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await registerOwner({ email: `owner_platform_${suffix}@example.test`, password: "password123", nomeSalone: "Tenant isolato", timezone: "Europe/Rome", orariApertura: {} });
    await expect(listPlatformSalons()).rejects.toMatchObject({ code: expect.stringMatching(/permission-denied/) });
  });
});
