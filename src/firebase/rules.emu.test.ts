import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-barbershop",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8085,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed dati bypassando le rules.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "salons/salonA"), { nome: "Salone A", timezone: "Europe/Rome" });
    await setDoc(doc(d, "salons/salonB"), { nome: "Salone B", timezone: "Europe/Rome" });
    // staffA appartiene a salonA.
    await setDoc(doc(d, "users/staffA"), { ruolo: "staff", salonId: "salonA" });
    // un servizio di salonA.
    await setDoc(doc(d, "salons/salonA/services/s1"), {
      titolo: "Taglio", descrizione: "", prezzo: 2000, durataMin: 30, attivo: true,
    });
    // prenotazione del cliente "cli1" in salonA.
    await setDoc(doc(d, "salons/salonA/bookings/b1"), {
      clientId: "cli1", operatorId: "op1", serviceId: "s1",
      date: "2026-08-24", startMin: 600, endMin: 630, stato: "in_attesa",
    });
  });
});

function client(uid: string) {
  return testEnv.authenticatedContext(uid).firestore();
}
function anon() {
  return testEnv.unauthenticatedContext().firestore();
}

describe("lettura salone", () => {
  it("nega la lettura ai non autenticati", async () => {
    await assertFails(getDoc(doc(anon(), "salons/salonA")));
  });
  it("consente la lettura del salone e dei servizi agli autenticati", async () => {
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA")));
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA/services/s1")));
  });
});

describe("documento utente", () => {
  it("il cliente può creare solo il PROPRIO doc con ruolo 'cliente'", async () => {
    await assertSucceeds(
      setDoc(doc(client("cli1"), "users/cli1"), {
        nome: "Cli Uno", email: "c1@x.it", sesso: "maschile",
        dataNascita: "1990-01-01", ruolo: "cliente", fcmTokens: [],
      })
    );
  });
  it("il cliente NON può creare il doc di un altro utente", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "users/cli2"), {
        nome: "X", email: "x@x.it", sesso: "altro",
        dataNascita: "1990-01-01", ruolo: "cliente", fcmTokens: [],
      })
    );
  });
  it("il cliente NON può auto-promuoversi a staff via update", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/cli1"), {
        nome: "Cli Uno", email: "c1@x.it", sesso: "maschile",
        dataNascita: "1990-01-01", ruolo: "cliente", fcmTokens: [],
      });
    });
    await assertFails(
      setDoc(doc(client("cli1"), "users/cli1"), {
        nome: "Cli Uno", email: "c1@x.it", sesso: "maschile",
        dataNascita: "1990-01-01", ruolo: "staff", salonId: "salonA", fcmTokens: [],
      })
    );
  });
  it("il cliente può aggiornare i propri dati anagrafici", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/cli1"), {
        nome: "Cli Uno", email: "c1@x.it", sesso: "maschile",
        dataNascita: "1990-01-01", ruolo: "cliente", fcmTokens: [],
      });
    });
    await assertSucceeds(
      setDoc(doc(client("cli1"), "users/cli1"), {
        nome: "Cli Uno Aggiornato", email: "c1@x.it", sesso: "maschile",
        dataNascita: "1990-01-01", ruolo: "cliente", fcmTokens: ["tok1"],
      })
    );
  });
  it("il cliente NON può creare il proprio doc con campi extra (es. salonId)", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "users/cli1"), {
        nome: "Cli", email: "c@x.it", sesso: "altro",
        dataNascita: "1990-01-01", ruolo: "cliente", salonId: "salonA", fcmTokens: [],
      })
    );
  });
});

describe("isolamento multi-salone sui servizi", () => {
  it("un cliente NON può scrivere i servizi del salone", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/services/s2"), {
        titolo: "X", descrizione: "", prezzo: 0, durataMin: 15, attivo: true,
      })
    );
  });
  it("lo staff del salone può scrivere i servizi del proprio salone", async () => {
    await assertSucceeds(
      setDoc(doc(client("staffA"), "salons/salonA/services/s2"), {
        titolo: "Barba", descrizione: "", prezzo: 1500, durataMin: 20, attivo: true,
      })
    );
  });
  it("lo staff di un salone NON può scrivere i servizi di un ALTRO salone", async () => {
    await assertFails(
      setDoc(doc(client("staffA"), "salons/salonB/services/s2"), {
        titolo: "X", descrizione: "", prezzo: 0, durataMin: 15, attivo: true,
      })
    );
  });
});

describe("prenotazioni", () => {
  it("il cliente può creare una prenotazione per sé stesso, stato in_attesa", async () => {
    await assertSucceeds(
      setDoc(doc(client("cli1"), "salons/salonA/bookings/newb"), {
        clientId: "cli1", operatorId: "op1", serviceId: "s1",
        date: "2026-08-25", startMin: 660, endMin: 690, stato: "in_attesa",
      })
    );
  });
  it("il cliente NON può creare una prenotazione a nome di un altro", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/bookings/newb2"), {
        clientId: "cli2", operatorId: "op1", serviceId: "s1",
        date: "2026-08-25", startMin: 660, endMin: 690, stato: "in_attesa",
      })
    );
  });
  it("il cliente NON può creare una prenotazione già 'confermata'", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/bookings/newb3"), {
        clientId: "cli1", operatorId: "op1", serviceId: "s1",
        date: "2026-08-25", startMin: 660, endMin: 690, stato: "confermata",
      })
    );
  });
  it("il cliente legge la PROPRIA prenotazione ma non quella altrui", async () => {
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA/bookings/b1")));
    await assertFails(getDoc(doc(client("cli2"), "salons/salonA/bookings/b1")));
  });
  it("lo staff del salone legge le prenotazioni del salone", async () => {
    await assertSucceeds(getDoc(doc(client("staffA"), "salons/salonA/bookings/b1")));
  });
  it("lo staff conferma una prenotazione; il cliente può solo annullare la propria", async () => {
    await assertSucceeds(
      setDoc(doc(client("staffA"), "salons/salonA/bookings/b1"), {
        clientId: "cli1", operatorId: "op1", serviceId: "s1",
        date: "2026-08-24", startMin: 600, endMin: 630, stato: "confermata",
      })
    );
    // ripristino stato per il test cliente (beforeEach ricrea comunque)
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/bookings/b1"), {
        clientId: "cli1", operatorId: "op1", serviceId: "s1",
        date: "2026-08-24", startMin: 600, endMin: 630, stato: "confermata",
      })
    );
  });
  it("il cliente può annullare la propria prenotazione (solo stato)", async () => {
    await assertSucceeds(
      setDoc(doc(client("cli1"), "salons/salonA/bookings/b1"), {
        clientId: "cli1", operatorId: "op1", serviceId: "s1",
        date: "2026-08-24", startMin: 600, endMin: 630, stato: "annullata",
      })
    );
  });
  it("il cliente NON può cambiare altri campi mentre annulla", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/bookings/b1"), {
        clientId: "cli1", operatorId: "op1", serviceId: "s1",
        date: "2026-08-24", startMin: 999, endMin: 630, stato: "annullata",
      })
    );
  });
});
