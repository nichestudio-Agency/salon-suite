// @vitest-environment node
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, connectEmulators } from "./app";
import { activateFeatureTrial } from "./subscription-repo";

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

describe("prova gratuita funzionalità", () => {
  it("sblocca una funzione una sola volta per quattordici giorni", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const credential = await createUserWithEmailAndPassword(auth, `trial-${suffix}@example.test`, "password123");
    const salonId = `trial-${suffix}`;
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `users/${credential.user.uid}`), { ruolo: "owner", salonId, nome: "Titolare Trial" });
      await setDoc(doc(db, `salons/${salonId}`), {
        nome: "Salone Trial",
        licenza: { stato: "attiva", piano: "start", scadenza: "2027-12-31", prezzoMensile: 4900 },
      });
    });

    const result = await activateFeatureTrial("marketing");
    expect(result.giorni).toBe(14);
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const snapshot = await getDoc(doc(context.firestore(), `salons/${salonId}`));
      expect(snapshot.data()?.licenza.funzionalitaTemporanee).toEqual(expect.arrayContaining([
        expect.objectContaining({ funzione: "marketing", scadeIl: result.scadeIl }),
      ]));
      expect(snapshot.data()?.licenza.proveUtilizzate.marketing).toBeTruthy();
    });
    await expect(activateFeatureTrial("marketing")).rejects.toMatchObject({ code: expect.stringMatching(/already-exists|failed-precondition/) });
  });
});
