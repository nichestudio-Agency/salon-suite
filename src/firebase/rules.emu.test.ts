import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, writeBatch } from "firebase/firestore";

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
    await setDoc(doc(d, "salonAccessCodes/SALONA1234"), { salonId: "salonA", attivo: true });
    // staffA appartiene a salonA.
    await setDoc(doc(d, "users/staffA"), { ruolo: "staff", salonId: "salonA" });
    // staffB appartiene a salonB (per i test di isolamento cross-tenant).
    await setDoc(doc(d, "users/staffB"), { ruolo: "staff", salonId: "salonB" });
    await setDoc(doc(d, "users/admin"), { ruolo: "superadmin" });
    // un servizio di salonA.
    await setDoc(doc(d, "salons/salonA/services/s1"), {
      titolo: "Taglio", descrizione: "", prezzo: 2000, durataMin: 30, attivo: true,
    });
    // prenotazione del cliente "cli1" in salonA.
    await setDoc(doc(d, "salons/salonA/bookings/b1"), {
      clientId: "cli1", operatorId: "op1", serviceId: "s1",
      date: "2026-08-24", startMin: 600, endMin: 630, stato: "in_attesa",
    });
    // prenotazione del cliente "cli3" in salonB (per i test di isolamento cross-tenant).
    await setDoc(doc(d, "salons/salonB/bookings/b2"), {
      clientId: "cli3", operatorId: "opB", serviceId: "sB",
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
  it("rende pubblica l'identità del singolo salone ma non l'elenco dei tenant", async () => {
    await assertSucceeds(getDoc(doc(anon(), "salons/salonA")));
    await assertFails(getDocs(collection(anon(), "salons")));
  });
  it("consente la lettura del salone e dei servizi agli autenticati", async () => {
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA")));
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA/services/s1")));
  });
});

describe("codici accesso salone", () => {
  it("consente la risoluzione esatta ma non espone l'elenco", async () => {
    await assertSucceeds(getDoc(doc(anon(), "salonAccessCodes/SALONA1234")));
    await assertFails(getDocs(collection(anon(), "salonAccessCodes")));
  });

  it("non consente a client o staff di creare o cambiare un codice", async () => {
    await assertFails(setDoc(doc(anon(), "salonAccessCodes/NUOVO12345"), { salonId: "salonA", attivo: true }));
    await assertFails(setDoc(doc(client("staffA"), "salonAccessCodes/NUOVO12345"), { salonId: "salonA", attivo: true }));
  });

  it("consente al super admin di assegnare il codice", async () => {
    await assertSucceeds(setDoc(doc(client("admin"), "salonAccessCodes/NUOVO12345"), { salonId: "salonA", attivo: true }));
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
  it("il cliente può legarsi al tenant ma non aggiungere campi arbitrari", async () => {
    await assertSucceeds(
      setDoc(doc(client("cli1"), "users/cli1"), {
        nome: "Cli", email: "c@x.it", sesso: "altro",
        dataNascita: "1990-01-01", ruolo: "cliente", salonId: "salonA", fcmTokens: [],
      })
    );
    await assertFails(
      setDoc(doc(client("cli2"), "users/cli2"), {
        nome: "Cli", email: "c2@x.it", sesso: "altro",
        dataNascita: "1990-01-01", ruolo: "cliente", salonId: "salonA", admin: true, fcmTokens: [],
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
  it("il cliente NON può bypassare la function creando direttamente una prenotazione", async () => {
    await assertFails(
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

describe("prodotti", () => {
  it("un utente autenticato può leggere i prodotti del salone", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "salons/salonA/products/p1"), {
        titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true,
      });
    });
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA/products/p1")));
  });
  it("un utente anonimo NON può leggere i prodotti del salone", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "salons/salonA/products/pX"), {
        titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true,
      });
    });
    await assertFails(getDoc(doc(anon(), "salons/salonA/products/pX")));
  });
  it("un cliente NON può scrivere i prodotti del salone", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/products/p2"), {
        titolo: "X", descrizione: "", prezzo: 0, attivo: true,
      })
    );
  });
  it("lo staff del salone può scrivere i propri prodotti", async () => {
    await assertSucceeds(
      setDoc(doc(client("staffA"), "salons/salonA/products/p3"), {
        titolo: "Balsamo", descrizione: "", prezzo: 1200, attivo: true,
      })
    );
  });
  it("lo staff NON può scrivere i prodotti di un altro salone", async () => {
    await assertFails(
      setDoc(doc(client("staffA"), "salons/salonB/products/p4"), {
        titolo: "X", descrizione: "", prezzo: 0, attivo: true,
      })
    );
  });
});

describe("ordini", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "salons/salonA/orders/o1"), {
        clientId: "cli1", items: [], totale: 0, stato: "in_attesa",
      });
      // Ordine "fresco" e distinto da o1 (id "o2" già usato dal test di
      // creazione diretta), per i test che devono partire da uno stato
      // in_attesa non ancora toccato da un'altra asserzione.
      await setDoc(doc(ctx.firestore(), "salons/salonA/orders/o3"), {
        clientId: "cli1", items: [], totale: 0, stato: "in_attesa",
      });
    });
  });
  it("creazione diretta vietata (solo via Cloud Function)", async () => {
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/orders/o2"), {
        clientId: "cli1", items: [], totale: 0, stato: "in_attesa",
      })
    );
  });
  it("il cliente legge il proprio ordine, non quello altrui", async () => {
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA/orders/o1")));
    await assertFails(getDoc(doc(client("cli2"), "salons/salonA/orders/o1")));
  });
  it("lo staff marca 'pronto'; il cliente non può", async () => {
    await assertSucceeds(
      setDoc(doc(client("staffA"), "salons/salonA/orders/o1"),
        { clientId: "cli1", items: [], totale: 0, stato: "pronto" })
    );
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/orders/o1"),
        { clientId: "cli1", items: [], totale: 0, stato: "pronto" })
    );
  });
  it("il cliente può annullare il proprio ordine in_attesa (solo stato)", async () => {
    await assertSucceeds(
      setDoc(doc(client("cli1"), "salons/salonA/orders/o1"),
        { clientId: "cli1", items: [], totale: 0, stato: "annullato" })
    );
    // Asserzione su un ordine ancora "in_attesa" (o3), non su o1 che sopra è
    // già stato portato ad "annullato": così la negazione isola davvero la
    // mutazione di un campo extra, non un tentativo su un ordine terminale.
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/orders/o3"),
        { clientId: "cli1", items: [], totale: 999, stato: "annullato" })
    );
  });
  it("staff di un altro salone non legge gli ordini di salonA", async () => {
    await assertFails(getDoc(doc(client("staffB"), "salons/salonA/orders/o1")));
  });
  it("staff di un altro salone non può aggiornare gli ordini di salonA", async () => {
    await assertFails(
      setDoc(doc(client("staffB"), "salons/salonA/orders/o1"),
        { clientId: "cli1", items: [], totale: 0, stato: "pronto" })
    );
  });
});

describe("coupon", () => {
  it("lo staff del salone gestisce i coupon del proprio salone", async () => {
    await assertSucceeds(
      setDoc(doc(client("staffA"), "salons/salonA/coupons/c1"), {
        codice: "ESTATE20", tipo: "percentuale", valore: 20, attivo: true,
      })
    );
    await assertSucceeds(getDoc(doc(client("staffA"), "salons/salonA/coupons/c1")));
  });
  it("un cliente NON può leggere né scrivere i coupon", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "salons/salonA/coupons/c2"), {
        codice: "X", tipo: "fisso", valore: 500, attivo: true,
      });
    });
    await assertFails(getDoc(doc(client("cli1"), "salons/salonA/coupons/c2")));
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/coupons/c3"), {
        codice: "Y", tipo: "fisso", valore: 100, attivo: true,
      })
    );
  });
  it("lo staff di un altro salone NON accede ai coupon di salonA", async () => {
    await assertFails(
      setDoc(doc(client("staffB"), "salons/salonA/coupons/c4"), {
        codice: "Z", tipo: "fisso", valore: 100, attivo: true,
      })
    );
  });
});

describe("campagne", () => {
  it("lo staff può creare una campagna per il proprio salone", async () => {
    await assertSucceeds(
      setDoc(doc(client("staffA"), "salons/salonA/campaigns/x1"), {
        filtri: {}, titolo: "T", testo: "B", recipientCount: 0,
      })
    );
  });
  it("lo staff del salone può leggere le campagne", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "salons/salonA/campaigns/x2"), {
        filtri: {}, titolo: "T", testo: "B", recipientCount: 3,
      });
    });
    await assertSucceeds(getDoc(doc(client("staffA"), "salons/salonA/campaigns/x2")));
    await assertFails(getDoc(doc(client("cli1"), "salons/salonA/campaigns/x2")));
    await assertFails(getDoc(doc(client("staffB"), "salons/salonA/campaigns/x2")));
  });
});

describe("isolamento multi-salone sulle prenotazioni", () => {
  it("lo staff di un ALTRO salone NON può leggere una prenotazione", async () => {
    await assertFails(getDoc(doc(client("staffA"), "salons/salonB/bookings/b2")));
  });
  it("lo staff di un ALTRO salone NON può aggiornare una prenotazione", async () => {
    await assertFails(
      setDoc(doc(client("staffA"), "salons/salonB/bookings/b2"), {
        clientId: "cli3", operatorId: "opB", serviceId: "sB",
        date: "2026-08-24", startMin: 600, endMin: 630, stato: "confermata",
      })
    );
  });
});

describe("ticket di assistenza", () => {
  it("il cliente apre un ticket visibile soltanto al proprio salone", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/cli1"), { ruolo: "cliente", salonId: "salonA", nome: "Cliente" });
    });
    const db = client("cli1"); const ticketRef = doc(db, "tickets/t1"); const messageRef = doc(db, "tickets/t1/messages/m1"); const batch = writeBatch(db);
    batch.set(ticketRef, { salonId: "salonA", channel: "cliente_salone", oggetto: "Prenotazione", categoria: "Prenotazione", priorita: "normale", stato: "aperto", requesterId: "cli1", requesterName: "Cliente", requesterRole: "cliente", createdAtMs: 1, updatedAtMs: 1, lastMessage: "Aiuto", messageCount: 1 });
    batch.set(messageRef, { senderId: "cli1", senderName: "Cliente", senderRole: "cliente", testo: "Aiuto", allegati: [], createdAtMs: 1 });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(client("staffA"), "tickets/t1")));
    await assertSucceeds(getDoc(doc(client("staffA"), "tickets/t1/messages/m1")));
    await assertFails(getDoc(doc(client("staffB"), "tickets/t1")));
  });

  it("un salone contatta la piattaforma e il super admin risponde", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/admin"), { ruolo: "superadmin" });
    });
    await assertSucceeds(setDoc(doc(client("staffA"), "tickets/t2"), { salonId: "salonA", channel: "salone_piattaforma", oggetto: "Errore", categoria: "Problema tecnico", priorita: "alta", stato: "aperto", requesterId: "staffA", requesterName: "Salone A", requesterRole: "owner", createdAtMs: 1, updatedAtMs: 1, lastMessage: "Errore", messageCount: 1 }));
    await assertSucceeds(getDoc(doc(client("admin"), "tickets/t2")));
    await assertFails(getDoc(doc(client("staffB"), "tickets/t2")));
    await assertSucceeds(setDoc(doc(client("admin"), "tickets/t2/messages/m2"), { senderId: "admin", senderName: "Supporto", senderRole: "piattaforma", testo: "Verifichiamo", allegati: [], createdAtMs: 2 }));
  });
});

describe("preferenze dashboard e comunicazioni piattaforma", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "users/admin"), { ruolo: "superadmin" });
    });
  });

  it("ogni operatore salva soltanto le proprie scorciatoie", async () => {
    await assertSucceeds(setDoc(doc(client("staffA"), "users/staffA/preferences/dashboard"), {
      shortcuts: ["agenda", "nuovo_cliente"],
      lastNotificationsReadAt: 100,
    }));
    await assertFails(setDoc(doc(client("staffA"), "users/staffB/preferences/dashboard"), {
      shortcuts: ["assistenza"],
    }));
  });

  it("solo il super admin pubblica comunicazioni", async () => {
    await assertSucceeds(setDoc(doc(client("admin"), "platformAnnouncements/a1"), {
      titolo: "Aggiornamento",
      testo: "Nuova agenda disponibile",
      audience: "all",
      createdAtMs: 1,
    }));
    await assertFails(setDoc(doc(client("staffA"), "platformAnnouncements/a2"), {
      titolo: "Non autorizzato",
      testo: "Test",
      audience: "all",
      createdAtMs: 1,
    }));
  });

  it("una comunicazione mirata resta isolata sul salone", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "platformAnnouncements/a3"), {
        titolo: "Solo salone A",
        testo: "Messaggio riservato",
        audience: "salon",
        salonId: "salonA",
        createdAtMs: 1,
      });
    });
    await assertSucceeds(getDoc(doc(client("staffA"), "platformAnnouncements/a3")));
    await assertFails(getDoc(doc(client("staffB"), "platformAnnouncements/a3")));
    await assertSucceeds(getDoc(doc(client("admin"), "platformAnnouncements/a3")));
  });
});
