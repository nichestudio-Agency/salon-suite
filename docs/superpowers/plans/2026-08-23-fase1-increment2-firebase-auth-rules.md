# Fase 1 · Increment 2 — Firebase: Auth, modello dati, Security Rules — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collegare le fondamenta a Firebase: autenticazione (email/password + profilo con sesso e data di nascita), modello dati Firestore, e Security Rules multi-salone — il tutto costruito e testato in locale con il Firebase Emulator Suite, senza un progetto cloud reale.

**Architecture:** Il client Firebase si inizializza in `src/firebase/` e in test/dev punta agli emulatori (Auth + Firestore). I tipi del modello dati sono TypeScript puro in `src/domain/models.ts` e riusano `Interval`/`WeeklyHours` già definiti dal motore di disponibilità. Le conversioni data↔minuti stanno in `src/domain/datetime.ts` (pure, testabili senza emulatore). Le Security Rules (`firestore.rules`) sono testate con `@firebase/rules-unit-testing` contro l'emulatore Firestore. I test si dividono in due categorie: **puri** (girano con `npm test`, nessun emulatore) e **emulatore** (file `*.emu.test.ts`, girano con `npm run test:emu`, che avvia gli emulatori via `firebase emulators:exec`).

**Tech Stack:** Firebase JS SDK (client), `@firebase/rules-unit-testing`, firebase-tools (già installato globalmente, v15), Java (OpenJDK, già installato in `/opt/homebrew/opt/openjdk`), Vitest.

**Decisione di modellazione (raffinamento della spec):** una prenotazione memorizza, oltre ai riferimenti, `date` (YYYY-MM-DD, ora locale del salone), `startMin`/`endMin` (minuti dalla mezzanotte) e `startAt` (Timestamp, per ordinamento/visualizzazione). Motivo: il motore di disponibilità lavora in minuti-del-giorno, quindi memorizzarli direttamente rende la query "impegni di un operatore in un giorno" banale (`operatorId == X && date == Y`) ed elimina i calcoli di fuso orario dal percorso critico. Il salone ha un campo `timezone` (IANA) usato per derivare `date`/`startAt` alla creazione (Increment 4) e per la visualizzazione.

---

## Struttura file (Increment 2)

- Create: `firebase.json` — config emulatori (auth+firestore) + puntatore alle rules.
- Create: `.firebaserc` — progetto di default `demo-barbershop` (il prefisso `demo-` fa girare gli emulatori senza credenziali reali).
- Create: `firestore.rules` — Security Rules multi-tenant.
- Create: `vitest.emu.config.ts` — config Vitest per i soli test `*.emu.test.ts`.
- Modify: `vite.config.ts` — esclude `**/*.emu.test.ts` dalla suite pura.
- Modify: `package.json` — script `test:emu`, `emu:start`.
- Create: `src/domain/models.ts` — tipi del dominio (UserProfile, Salon, Operator, Service, Booking…).
- Create: `src/domain/datetime.ts` + `src/domain/datetime.test.ts` — conversioni data/ora pure.
- Create: `src/firebase/app.ts` — init Firebase, aggancio emulatori in test/dev.
- Create: `src/firebase/auth.ts` — `registerClient`, `signIn`, `signOutUser`.
- Create: `src/firebase/auth.emu.test.ts` — test auth+firestore contro l'emulatore.
- Create: `src/firebase/rules.emu.test.ts` — test delle Security Rules.
- Create: `.env.example` — variabili `VITE_FIREBASE_*` (placeholder, per il futuro progetto reale).

Responsabilità isolate: `models.ts` = forma dei dati; `datetime.ts` = conversioni temporali; `firebase/app.ts` = connessione; `firebase/auth.ts` = registrazione/accesso; `firestore.rules` = autorizzazioni.

---

### Task 1: Config emulatori + prova che partono con la Java installata

**Files:**
- Create: `firebase.json`, `.firebaserc`, `firestore.rules`
- Modify: `package.json`

- [ ] **Step 1: Installa le dipendenze Firebase**

Run:
```bash
cd "/Users/fabio_pace/App Barber Shop"
npm install firebase
npm install -D @firebase/rules-unit-testing @types/node
```
Expected: installazione senza errori. (`@types/node` serve per `node:fs` nei test delle rules.)

- [ ] **Step 2: Crea `.firebaserc`**

Create `.firebaserc`:
```json
{
  "projects": {
    "default": "demo-barbershop"
  }
}
```

- [ ] **Step 3: Crea `firebase.json`**

Create `firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 4: Crea una `firestore.rules` minimale (permissiva-autenticata, temporanea)**

Regole di partenza: accesso consentito a qualsiasi utente autenticato. È uno scaffold temporaneo che il Task 7 sostituirà con le regole vere; serve a far girare il test di `registerClient` (Task 6) prima che le regole definitive esistano.

Create `firestore.rules`:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

- [ ] **Step 5: Aggiungi gli script emulatore a `package.json`**

Aggiungi in `"scripts"` (la variabile PATH aggancia la Java di Homebrew, keg-only, senza toccare la shell globale):
```json
"emu:start": "PATH=\"/opt/homebrew/opt/openjdk/bin:$PATH\" firebase emulators:start --only auth,firestore --project demo-barbershop",
"test:emu": "PATH=\"/opt/homebrew/opt/openjdk/bin:$PATH\" firebase emulators:exec --only auth,firestore --project demo-barbershop \"vitest run --config vitest.emu.config.ts\""
```

- [ ] **Step 6: PROVA che l'emulatore parte con questa Java (de-risk JDK 26)**

Run:
```bash
cd "/Users/fabio_pace/App Barber Shop"
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" firebase emulators:exec --only firestore --project demo-barbershop "echo EMULATORE_OK"
```
Expected: output che include `EMULATORE_OK` e nessun errore Java. La prima esecuzione può scaricare il JAR dell'emulatore Firestore (serve rete).
**Se fallisce per incompatibilità Java (JDK 26 troppo recente):** STOP e riporta BLOCKED — il controller installerà un JDK LTS (`brew install openjdk@21`) e aggiornerà il path negli script a `/opt/homebrew/opt/openjdk@21/bin`.

- [ ] **Step 7: Commit**

```bash
cd "/Users/fabio_pace/App Barber Shop"
git add .firebaserc firebase.json firestore.rules package.json package-lock.json
git commit -m "chore(firebase): config emulatori auth+firestore + verifica avvio"
```

---

### Task 2: Separazione test puri / test emulatore

**Files:**
- Create: `vitest.emu.config.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Escludi i test emulatore dalla suite pura**

In `vite.config.ts`, aggiungi (o estendi) la sezione `test` per escludere i file `*.emu.test.ts`. Se il file usa `defineConfig` da `vite`, importa anche i default di esclusione da `vitest/config`. Contenuto risultante di `vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.emu.test.ts"],
  },
});
```
(Se `vite.config.ts` ha già altri campi, conservali e aggiungi solo `test`.)

- [ ] **Step 2: Config Vitest per i soli test emulatore**

Create `vitest.emu.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.emu.test.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
```

- [ ] **Step 3: Verifica che la suite pura giri ancora**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test`
Expected: i 21 test dell'Increment 1 passano; nessun tentativo di avviare emulatori.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts vitest.emu.config.ts
git commit -m "chore(test): separa test puri da test emulatore"
```

---

### Task 3: Tipi del modello dati

**Files:**
- Create: `src/domain/models.ts`

- [ ] **Step 1: Definisci i tipi (nessun test dedicato: sono solo tipi, li validano i task successivi che li usano)**

Create `src/domain/models.ts`:
```ts
import type { Interval } from "./time";
import type { WeeklyHours } from "./availability";

export type Gender = "maschile" | "femminile" | "altro";
export type UserRole = "cliente" | "staff" | "owner";
export type BookingStatus =
  | "in_attesa"
  | "confermata"
  | "rifiutata"
  | "annullata";

/** Documento in `users/{uid}`. */
export interface UserProfile {
  nome: string;
  email: string;
  sesso: Gender;
  /** Data di nascita come "YYYY-MM-DD" (nessun fuso: è una data anagrafica). */
  dataNascita: string;
  ruolo: UserRole;
  /** Presente solo per staff/owner: il salone di appartenenza. */
  salonId?: string;
  /** Token FCM dei dispositivi registrati per le notifiche push. */
  fcmTokens: string[];
}

/** Documento in `salons/{salonId}`. */
export interface Salon {
  nome: string;
  /** Fuso orario IANA, es. "Europe/Rome". */
  timezone: string;
  orariApertura: WeeklyHours;
  impostazioni: {
    passoMinuti: number;
    modalitaConferma: "manuale" | "auto";
  };
}

/** Documento in `salons/{salonId}/operators/{id}`. */
export interface Operator {
  nome: string;
  attivo: boolean;
  /** Override degli orari; se assente valgono quelli del salone. */
  orariPersonalizzati?: WeeklyHours;
}

/** Documento in `salons/{salonId}/services/{id}`. */
export interface Service {
  titolo: string;
  descrizione: string;
  /** Prezzo in centesimi interi. */
  prezzo: number;
  durataMin: number;
  attivo: boolean;
}

/** Documento in `salons/{salonId}/bookings/{id}`. */
export interface Booking {
  clientId: string;
  operatorId: string;
  serviceId: string;
  /** Data locale del salone, "YYYY-MM-DD". */
  date: string;
  /** Minuti dalla mezzanotte (ora locale del salone). */
  startMin: number;
  endMin: number;
  stato: BookingStatus;
}

/** Un impegno che occupa l'agenda: le prenotazioni in_attesa e confermate. */
export function bookingToInterval(b: Pick<Booking, "startMin" | "endMin">): Interval {
  return { start: b.startMin, end: b.endMin };
}
```

- [ ] **Step 2: Verifica che compili**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npx tsc -b`
Expected: nessun errore di tipo.

- [ ] **Step 3: Commit**

```bash
git add src/domain/models.ts
git commit -m "feat(domain): tipi del modello dati (User, Salon, Operator, Service, Booking)"
```

---

### Task 4: Conversioni data/ora (`datetime.ts`)

**Files:**
- Create: `src/domain/datetime.ts`
- Test: `src/domain/datetime.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Create `src/domain/datetime.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { weekdayOf, isValidDateKey } from "./datetime";

describe("weekdayOf", () => {
  it("restituisce il giorno della settimana in formato breve italiano", () => {
    // 2026-08-24 è un lunedì.
    expect(weekdayOf("2026-08-24")).toBe("lun");
    expect(weekdayOf("2026-08-25")).toBe("mar");
    expect(weekdayOf("2026-08-30")).toBe("dom");
  });
});

describe("isValidDateKey", () => {
  it("accetta solo il formato YYYY-MM-DD valido", () => {
    expect(isValidDateKey("2026-08-24")).toBe(true);
    expect(isValidDateKey("2026-8-24")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/datetime.test.ts`
Expected: FAIL — modulo `./datetime` non trovato.

- [ ] **Step 3: Implementazione minima**

Create `src/domain/datetime.ts`:
```ts
import type { Weekday } from "./availability";

const WEEKDAYS: Weekday[] = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"];

/** Verifica che una stringa sia una data valida in formato "YYYY-MM-DD". */
export function isValidDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/**
 * Giorno della settimana (formato breve italiano) di una data "YYYY-MM-DD".
 * Usa UTC per evitare slittamenti dovuti al fuso della macchina: la data è già
 * intesa come data locale del salone, non un istante.
 */
export function weekdayOf(dateKey: string): Weekday {
  const [y, m, d] = dateKey.split("-").map(Number);
  const idx = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAYS[idx];
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/datetime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/datetime.ts src/domain/datetime.test.ts
git commit -m "feat(domain): conversioni data/ora (weekdayOf, isValidDateKey)"
```

---

### Task 5: Inizializzazione Firebase (aggancio emulatori)

**Files:**
- Create: `src/firebase/app.ts`, `.env.example`

- [ ] **Step 1: Crea `.env.example`**

Create `.env.example`:
```
# Config del progetto Firebase REALE (da compilare quando lo si crea sulla console).
# In sviluppo/test, se VITE_USE_EMULATOR=true, questi valori non servono.
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_EMULATOR=true
```

- [ ] **Step 2: Crea il modulo di init**

Create `src/firebase/app.ts`:
```ts
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";

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

let emulatorsConnected = false;
/** Aggancia auth+firestore agli emulatori. Idempotente. */
export function connectEmulators(
  host = "127.0.0.1",
  authPort = 9099,
  firestorePort = 8080
): void {
  if (emulatorsConnected) return;
  connectAuthEmulator(auth, `http://${host}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, firestorePort);
  emulatorsConnected = true;
}

if (useEmulator) {
  connectEmulators();
}
```

- [ ] **Step 3: Verifica che compili**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npx tsc -b`
Expected: nessun errore.

- [ ] **Step 4: Commit**

```bash
git add src/firebase/app.ts .env.example
git commit -m "feat(firebase): init app con aggancio emulatori"
```

---

### Task 6: Servizio di autenticazione (`registerClient`, `signIn`, `signOutUser`)

**Files:**
- Create: `src/firebase/auth.ts`
- Test: `src/firebase/auth.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/auth.emu.test.ts`:
```ts
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
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL — modulo `./auth` non trovato / funzioni non definite. (Gli emulatori si avviano correttamente grazie al Task 1.)

- [ ] **Step 3: Implementazione minima**

Create `src/firebase/auth.ts`:
```ts
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
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: PASS (i test di `auth.emu.test.ts` verdi). Le regole permissive-autenticate del Task 1 consentono la `setDoc` su `users/{uid}`; il Task 7 le stringerà mantenendo valida la self-create del cliente.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/auth.ts src/firebase/auth.emu.test.ts
git commit -m "feat(firebase): servizio auth (registerClient/signIn/signOut) + test emulatore"
```

---

### Task 7: Security Rules multi-tenant + test

**Files:**
- Modify: `firestore.rules`
- Test: `src/firebase/rules.emu.test.ts`

- [ ] **Step 1: Scrivi i test delle rules (falliscono con le regole attuali permissive)**

Create `src/firebase/rules.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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
      port: 8080,
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
});
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: molti FAIL — le regole attuali (permissive `if request.auth != null`) consentono cose che i test si aspettano vengano negate (es. cliente che scrive i servizi, cliente che crea prenotazione a nome altrui).

- [ ] **Step 3: Scrivi le Security Rules vere**

Sostituisci interamente `firestore.rules` con:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }
    function isSelf(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    function userData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    function isStaffOf(salonId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && userData().salonId == salonId
        && userData().ruolo in ['owner', 'staff'];
    }

    match /users/{uid} {
      allow read: if isSelf(uid);
      allow create: if isSelf(uid) && request.resource.data.ruolo == 'cliente';
      allow update: if isSelf(uid);
      allow delete: if false;
    }

    match /salons/{salonId} {
      allow read: if isSignedIn();
      allow write: if isStaffOf(salonId);

      match /operators/{operatorId} {
        allow read: if isSignedIn();
        allow write: if isStaffOf(salonId);
      }

      match /services/{serviceId} {
        allow read: if isSignedIn();
        allow write: if isStaffOf(salonId);
      }

      match /bookings/{bookingId} {
        allow read: if isSignedIn()
          && (resource.data.clientId == request.auth.uid || isStaffOf(salonId));
        allow create: if isSignedIn()
          && request.resource.data.clientId == request.auth.uid
          && request.resource.data.stato == 'in_attesa';
        allow update: if isStaffOf(salonId)
          || (isSignedIn()
              && resource.data.clientId == request.auth.uid
              && request.resource.data.stato == 'annullata');
        allow delete: if false;
      }
    }
  }
}
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: PASS — tutti i test delle rules verdi, e anche `auth.emu.test.ts` continua a passare (la regola `users` allow create per il proprio uid con ruolo 'cliente' copre la `registerClient`).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/firebase/rules.emu.test.ts
git commit -m "feat(firebase): Security Rules multi-tenant + test rules"
```

---

## Verifica di completamento Increment 2

- [ ] `npm run test` → i test puri (Increment 1 + models/datetime) verdi
- [ ] `npm run test:emu` → i test emulatore (auth + rules) verdi
- [ ] `npx tsc -b` → nessun errore di tipo
- [ ] La `registerClient` crea auth user + doc profilo con sesso/data di nascita
- [ ] Le rules impediscono a un salone di leggere/scrivere i dati di un altro (isolamento multi-tenant verificato dai test)

## Cosa NON è in questo incremento (arriva dopo)

- UI di registrazione/login e dashboard → Increment 3
- Repository/CRUD servizi-operatori-orari usati dalla dashboard → Increment 3
- Transazione anti doppia-prenotazione (userà il motore dell'Increment 1) + trigger notifiche → Increment 4
- Creazione del progetto Firebase reale e deploy delle rules → quando si va in produzione (le `VITE_FIREBASE_*` in `.env`)
