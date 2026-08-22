# Fase 1 · Increment 3a — Guscio dashboard + Onboarding salone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un titolare può registrarsi, creare il proprio salone (via Cloud Function) e accedere al guscio della dashboard con barra laterale; un non-owner viene reindirizzato.

**Architecture:** La PWA (Vite + React + TS) usa React Router. Un `AuthProvider` espone utente/ruolo/salonId da Firebase Auth + Firestore. La prima Cloud Function (`createSalon`, cartella `functions/`, TypeScript, `firebase-admin`) crea il salone ed eleva l'utente a owner lato server (le rules bloccano l'auto-promozione client). Tutto testato con l'emulatore Firebase (auth + firestore + functions). I test componente usano Vitest con ambiente `jsdom` + Testing Library.

**Tech Stack:** React Router, Firebase (Auth, Firestore, Functions), firebase-admin/firebase-functions (v2), Vitest (jsdom), @testing-library/react.

**Convenzioni preesistenti:** emulatore Firestore su porta **8085**, Auth su 9099 (vedi `firebase.json`); script `test` (puri, ora ambiente jsdom) e `test:emu` (file `*.emu.test.ts`, avvia gli emulatori). La Java di Homebrew è agganciata negli script tramite PATH.

---

## Struttura file (Increment 3a)

- Create: `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`, `functions/src/createSalon.ts`
- Modify: `firebase.json` (aggiunge functions + emulatore functions), `package.json` (dep + script), `vite.config.ts` (ambiente jsdom), `vitest.emu.config.ts` (ambiente jsdom)
- Create: `src/test/setup.ts` (jest-dom matchers)
- Modify: `src/firebase/app.ts` (aggancio functions emulator)
- Create: `src/firebase/onboarding.ts` (+ `onboarding.emu.test.ts`) — orchestrazione registrazione owner + createSalon
- Create: `src/app/auth-context.tsx` (+ `auth-context.emu.test.tsx`) — AuthProvider/useAuth
- Create: `src/app/RequireOwner.tsx` (+ `RequireOwner.test.tsx`)
- Create: `src/pages/LoginPage.tsx`, `src/pages/OnboardingPage.tsx` (+ `OnboardingPage.test.tsx`), `src/app/DashboardLayout.tsx`
- Modify: `src/App.tsx`, `src/main.tsx` (router)

---

### Task 1: Dipendenze, ambiente jsdom, scaffolding Cloud Functions

**Files:**
- Modify: `package.json`, `vite.config.ts`, `vitest.emu.config.ts`, `firebase.json`, `src/firebase/app.ts`
- Create: `src/test/setup.ts`, `functions/package.json`, `functions/tsconfig.json`, `functions/src/index.ts`

- [ ] **Step 1: Installa le dipendenze**

```bash
cd "/Users/fabio_pace/App Barber Shop"
npm install react-router-dom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Ambiente jsdom + setup per i test**

Create `src/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

In `vite.config.ts`, imposta l'ambiente `jsdom` e il setup file. Contenuto risultante:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.emu.test.ts", "**/*.emu.test.tsx"],
  },
});
```

In `vitest.emu.config.ts`, usa anch'esso jsdom e includi i `.tsx`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["src/test/setup.ts"],
    include: ["**/*.emu.test.ts", "**/*.emu.test.tsx"],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
```
(Nota: `node:fs` usato in `rules.emu.test.ts` continua a funzionare: l'ambiente jsdom di Vitest gira comunque su Node, quindi i moduli built-in restano disponibili.)

- [ ] **Step 3: Scaffolding Cloud Functions**

Create `functions/package.json`:
```json
{
  "name": "functions",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "engines": { "node": "22" },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "firebase-admin": "^13.0.0",
    "firebase-functions": "^6.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

Create `functions/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "outDir": "lib",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Create `functions/src/index.ts`:
```ts
export { createSalon } from "./createSalon.js";
```

Install functions deps:
```bash
cd "/Users/fabio_pace/App Barber Shop/functions" && npm install
```

- [ ] **Step 4: Aggiorna `firebase.json` (functions + emulatore functions)**

Contenuto risultante di `firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8085 },
    "functions": { "port": 5001 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 5: Aggancia l'emulatore Functions in `src/firebase/app.ts`**

In `src/firebase/app.ts`, aggiungi l'import e l'aggancio functions dentro `connectEmulators`. Aggiungi in cima agli import:
```ts
import { getFunctions, connectFunctionsEmulator, type Functions } from "firebase/functions";
```
Aggiungi dopo `export const db`:
```ts
export const functions: Functions = getFunctions(app);
```
Dentro `connectEmulators`, dopo l'aggancio firestore, aggiungi (usa un parametro nuovo con default):
```ts
  connectFunctionsEmulator(functions, host, 5001);
```

- [ ] **Step 6: Aggiorna gli script `test:emu` per avviare anche functions**

In `package.json`, cambia i due script così (aggiungono `functions` e fanno build delle functions prima):
```json
"emu:start": "PATH=\"/opt/homebrew/opt/openjdk/bin:$PATH\" firebase emulators:start --only auth,firestore,functions --project demo-barbershop",
"test:emu": "npm --prefix functions run build && PATH=\"/opt/homebrew/opt/openjdk/bin:$PATH\" firebase emulators:exec --only auth,firestore,functions --project demo-barbershop \"vitest run --config vitest.emu.config.ts\""
```

- [ ] **Step 7: Verifica**

```bash
cd "/Users/fabio_pace/App Barber Shop"
npm run test         # i test puri esistenti passano in ambiente jsdom
npm --prefix functions run build   # le functions compilano (index.ts importa createSalon: creane uno stub temporaneo se serve, poi Task 2 lo sostituisce)
```
Nota: `functions/src/index.ts` importa `./createSalon.js`, che non esiste ancora. Per far passare questo step, crea uno stub minimo `functions/src/createSalon.ts` con `export const createSalon = null as unknown;` — il Task 2 lo sostituirà con l'implementazione vera. In alternativa esegui il build alla fine del Task 2.
Expected: test puri verdi; build functions ok (con lo stub).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vite.config.ts vitest.emu.config.ts firebase.json src/firebase/app.ts src/test/setup.ts functions/
git commit -m "chore(3a): deps, ambiente jsdom, scaffolding Cloud Functions + emulatore"
```

---

### Task 2: Cloud Function `createSalon`

**Files:**
- Create: `functions/src/createSalon.ts`
- Test: `src/firebase/createSalon.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/createSalon.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getDoc, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, connectEmulators } from "./app";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

async function newUser() {
  const email = `owner_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  const cred = await createUserWithEmailAndPassword(auth, email, "password123");
  return cred.user.uid;
}

const call = () =>
  httpsCallable<
    { nome: string; timezone: string; orariApertura: Record<string, { start: number; end: number }[]> },
    { salonId: string }
  >(functions, "createSalon");

describe("createSalon", () => {
  it("crea il salone ed eleva l'utente a owner", async () => {
    const uid = await newUser();
    const res = await call()({
      nome: "Salone Mario",
      timezone: "Europe/Rome",
      orariApertura: { lun: [{ start: 540, end: 1140 }] },
    });
    const salonId = res.data.salonId;
    expect(salonId).toBeTruthy();

    const salonSnap = await getDoc(doc(db, "salons", salonId));
    expect(salonSnap.exists()).toBe(true);
    expect(salonSnap.data()?.nome).toBe("Salone Mario");
    expect(salonSnap.data()?.impostazioni?.passoMinuti).toBe(15);

    const userSnap = await getDoc(doc(db, "users", uid));
    expect(userSnap.data()?.ruolo).toBe("owner");
    expect(userSnap.data()?.salonId).toBe(salonId);
  });

  it("rifiuta un utente già legato a un salone", async () => {
    await newUser();
    await call()({ nome: "Uno", timezone: "Europe/Rome", orariApertura: {} });
    await expect(
      call()({ nome: "Due", timezone: "Europe/Rome", orariApertura: {} })
    ).rejects.toThrow();
  });

  it("rifiuta un nome mancante", async () => {
    await newUser();
    await expect(
      call()({ nome: "", timezone: "Europe/Rome", orariApertura: {} })
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL (la function non esiste ancora / è uno stub null).

- [ ] **Step 3: Implementa la function**

Sostituisci interamente `functions/src/createSalon.ts` con:
```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

interface CreateSalonData {
  nome: string;
  timezone: string;
  orariApertura: Record<string, { start: number; end: number }[]>;
}

export const createSalon = onCall<CreateSalonData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const { nome, timezone, orariApertura } = request.data ?? ({} as CreateSalonData);
  if (!nome || !timezone) {
    throw new HttpsError("invalid-argument", "Nome del salone e fuso orario sono obbligatori.");
  }

  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  if (userSnap.exists && userSnap.data()?.salonId) {
    throw new HttpsError("failed-precondition", "Questo utente è già legato a un salone.");
  }

  const salonRef = db.collection("salons").doc();
  await db.runTransaction(async (tx) => {
    tx.set(salonRef, {
      nome,
      timezone,
      orariApertura: orariApertura ?? {},
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
    });
    tx.set(
      userRef,
      { ruolo: "owner", salonId: salonRef.id, email: request.auth?.token.email ?? null },
      { merge: true }
    );
  });

  return { salonId: salonRef.id };
});
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: PASS (i 3 test di `createSalon.emu.test.ts` verdi; gli altri test emulatore restano verdi).

- [ ] **Step 5: Commit**

```bash
git add functions/src/createSalon.ts src/firebase/createSalon.emu.test.ts
git commit -m "feat(3a): Cloud Function createSalon (crea salone + eleva owner)"
```

---

### Task 3: Orchestrazione onboarding (`registerOwner`)

**Files:**
- Create: `src/firebase/onboarding.ts`
- Test: `src/firebase/onboarding.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/onboarding.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getDoc, doc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { auth, db, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("registerOwner", () => {
  it("registra l'owner, crea il salone e restituisce salonId", async () => {
    const email = `titolare_${Date.now()}@ex.com`;
    const res = await registerOwner({
      email,
      password: "password123",
      nomeSalone: "Barberia Centrale",
      timezone: "Europe/Rome",
      orariApertura: { lun: [{ start: 540, end: 1140 }] },
    });
    expect(res.salonId).toBeTruthy();
    expect(auth.currentUser).not.toBeNull();

    const userSnap = await getDoc(doc(db, "users", auth.currentUser!.uid));
    expect(userSnap.data()?.ruolo).toBe("owner");
    expect(userSnap.data()?.salonId).toBe(res.salonId);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npm run test:emu`
Expected: FAIL — `registerOwner` non definita.

- [ ] **Step 3: Implementazione**

Create `src/firebase/onboarding.ts`:
```ts
import { createUserWithEmailAndPassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./app";
import type { WeeklyHours } from "../domain/availability";

export interface RegisterOwnerInput {
  email: string;
  password: string;
  nomeSalone: string;
  timezone: string;
  orariApertura: WeeklyHours;
}

export interface RegisterOwnerResult {
  salonId: string;
}

/**
 * Registra il titolare (auth) e crea il suo salone via Cloud Function.
 * Il profilo owner NON viene creato lato client (le rules lo vietano):
 * ci pensa la function `createSalon` con privilegi admin.
 */
export async function registerOwner(
  input: RegisterOwnerInput
): Promise<RegisterOwnerResult> {
  await createUserWithEmailAndPassword(auth, input.email, input.password);
  const createSalon = httpsCallable<
    { nome: string; timezone: string; orariApertura: WeeklyHours },
    { salonId: string }
  >(functions, "createSalon");
  const res = await createSalon({
    nome: input.nomeSalone,
    timezone: input.timezone,
    orariApertura: input.orariApertura,
  });
  return { salonId: res.data.salonId };
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/onboarding.ts src/firebase/onboarding.emu.test.ts
git commit -m "feat(3a): orchestrazione onboarding registerOwner"
```

---

### Task 4: Auth context (`AuthProvider` / `useAuth`)

**Files:**
- Create: `src/app/auth-context.tsx`
- Test: `src/app/auth-context.emu.test.tsx`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/app/auth-context.emu.test.tsx`:
```tsx
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "../firebase/app";
import { registerOwner } from "../firebase/onboarding";
import { AuthProvider, useAuth } from "./auth-context";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

function Probe() {
  const { loading, role, salonId } = useAuth();
  if (loading) return <div>caricamento</div>;
  return <div>ruolo:{role ?? "nessuno"} salone:{salonId ?? "nessuno"}</div>;
}

describe("AuthProvider", () => {
  it("espone ruolo owner e salonId dopo l'onboarding", async () => {
    const email = `t_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "X",
      timezone: "Europe/Rome", orariApertura: {},
    });
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByText(`ruolo:owner salone:${salonId}`)).toBeInTheDocument()
    );
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npm run test:emu`
Expected: FAIL — modulo `./auth-context` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/app/auth-context.tsx`:
```tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/app";
import type { UserRole } from "../domain/models";

interface AuthState {
  loading: boolean;
  user: User | null;
  role: UserRole | null;
  salonId: string | null;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  user: null,
  role: null,
  salonId: null,
});

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    user: null,
    role: null,
    salonId: null,
  });

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (!user) {
        setState({ loading: false, user: null, role: null, salonId: null });
        return;
      }
      setState((s) => ({ ...s, loading: true, user }));
      unsubProfile = onSnapshot(doc(db, "users", user.uid), (snap) => {
        const data = snap.data();
        setState({
          loading: false,
          user,
          role: (data?.ruolo as UserRole) ?? null,
          salonId: (data?.salonId as string) ?? null,
        });
      });
    });
    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth-context.tsx src/app/auth-context.emu.test.tsx
git commit -m "feat(3a): AuthProvider/useAuth (ruolo + salonId reattivi)"
```

---

### Task 5: Guardia di rotta `RequireOwner` + `LoginPage`

**Files:**
- Create: `src/app/RequireOwner.tsx`, `src/pages/LoginPage.tsx`
- Test: `src/app/RequireOwner.test.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/app/RequireOwner.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireOwner } from "./RequireOwner";
import * as authCtx from "./auth-context";

function renderAt(state: Partial<ReturnType<typeof authCtx.useAuth>>) {
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: null, role: null, salonId: null, ...state,
  } as ReturnType<typeof authCtx.useAuth>);
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route path="/accedi" element={<div>pagina accesso</div>} />
        <Route
          path="/dashboard"
          element={
            <RequireOwner>
              <div>contenuto dashboard</div>
            </RequireOwner>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}

describe("RequireOwner", () => {
  it("mostra il contenuto a un owner", () => {
    renderAt({ role: "owner", salonId: "s1", user: {} as never });
    expect(screen.getByText("contenuto dashboard")).toBeInTheDocument();
  });
  it("reindirizza un non-owner all'accesso", () => {
    renderAt({ role: null, user: null });
    expect(screen.getByText("pagina accesso")).toBeInTheDocument();
  });
  it("mostra un caricamento finché l'auth non è pronta", () => {
    renderAt({ loading: true });
    expect(screen.getByText(/caricamento/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/app/RequireOwner.test.tsx`
Expected: FAIL — modulo `./RequireOwner` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/app/RequireOwner.tsx`:
```tsx
import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./auth-context";

/** Consente l'accesso solo a un utente con ruolo owner; altrimenti reindirizza. */
export function RequireOwner({ children }: { children: ReactNode }) {
  const { loading, role, salonId } = useAuth();
  if (loading) return <div>caricamento…</div>;
  if (role !== "owner" || !salonId) return <Navigate to="/accedi" replace />;
  return <>{children}</>;
}
```

Create `src/pages/LoginPage.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "../firebase/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signIn(email, password);
      navigate("/dashboard/servizi");
    } catch {
      setError("Email o password non validi.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>Accedi</h1>
      <input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Accedi</button>
      <p>Nuovo salone? <Link to="/registrati-salone">Registrati</Link></p>
    </form>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/app/RequireOwner.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/RequireOwner.tsx src/app/RequireOwner.test.tsx src/pages/LoginPage.tsx
git commit -m "feat(3a): RequireOwner + LoginPage"
```

---

### Task 6: `OnboardingPage`, guscio `DashboardLayout`, wiring router

**Files:**
- Create: `src/pages/OnboardingPage.tsx`, `src/app/DashboardLayout.tsx`
- Test: `src/pages/OnboardingPage.test.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/pages/OnboardingPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { OnboardingPage } from "./OnboardingPage";
import * as onboarding from "../firebase/onboarding";

beforeEach(() => vi.restoreAllMocks());

function setup() {
  return render(
    <MemoryRouter initialEntries={["/registrati-salone"]}>
      <Routes>
        <Route path="/registrati-salone" element={<OnboardingPage />} />
        <Route path="/dashboard/servizi" element={<div>dashboard servizi</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("OnboardingPage", () => {
  it("invia i dati a registerOwner e naviga alla dashboard", async () => {
    const spy = vi
      .spyOn(onboarding, "registerOwner")
      .mockResolvedValue({ salonId: "s1" });
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "t@ex.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Nome del salone"), "Barberia X");
    await userEvent.click(screen.getByRole("button", { name: /crea il salone/i }));

    await waitFor(() =>
      expect(screen.getByText("dashboard servizi")).toBeInTheDocument()
    );
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toMatchObject({
      email: "t@ex.com",
      password: "password123",
      nomeSalone: "Barberia X",
    });
  });

  it("mostra un errore se registerOwner fallisce", async () => {
    vi.spyOn(onboarding, "registerOwner").mockRejectedValue(new Error("boom"));
    setup();
    await userEvent.type(screen.getByLabelText("Email"), "t@ex.com");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.type(screen.getByLabelText("Nome del salone"), "Barberia X");
    await userEvent.click(screen.getByRole("button", { name: /crea il salone/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/OnboardingPage.test.tsx`
Expected: FAIL — modulo `./OnboardingPage` non trovato.

- [ ] **Step 3: Implementazione delle pagine + guscio**

Create `src/pages/OnboardingPage.tsx`:
```tsx
import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerOwner } from "../firebase/onboarding";
import type { WeeklyHours } from "../domain/availability";

/** Orari di default: Lun–Sab 9:00–19:00 (rifiniti poi nella sezione Orari). */
const DEFAULT_HOURS: WeeklyHours = {
  lun: [{ start: 540, end: 1140 }],
  mar: [{ start: 540, end: 1140 }],
  mer: [{ start: 540, end: 1140 }],
  gio: [{ start: 540, end: 1140 }],
  ven: [{ start: 540, end: 1140 }],
  sab: [{ start: 540, end: 1140 }],
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomeSalone, setNomeSalone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await registerOwner({
        email,
        password,
        nomeSalone,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome",
        orariApertura: DEFAULT_HOURS,
      });
      navigate("/dashboard/servizi");
    } catch {
      setError("Registrazione non riuscita. Controlla i dati e riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>Crea il tuo salone</h1>
      <input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <input aria-label="Nome del salone" value={nomeSalone} onChange={(e) => setNomeSalone(e.target.value)} required />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>Crea il salone</button>
      <p>Hai già un salone? <Link to="/accedi">Accedi</Link></p>
    </form>
  );
}
```

Create `src/app/DashboardLayout.tsx`:
```tsx
import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";

const SECTIONS = [
  { to: "/dashboard/servizi", label: "Servizi" },
  { to: "/dashboard/operatori", label: "Operatori" },
  { to: "/dashboard/orari", label: "Orari" },
];

export function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav aria-label="Sezioni dashboard" className="dashboard__sidebar">
        <strong>💈 Salone</strong>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.to}>
              <NavLink to={s.to}>{s.label}</NavLink>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => signOutUser()}>Esci</button>
      </nav>
      <main className="dashboard__content">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/OnboardingPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wiring del router**

Sostituisci `src/App.tsx` con:
```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./app/auth-context";
import { RequireOwner } from "./app/RequireOwner";
import { DashboardLayout } from "./app/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";

function Placeholder({ nome }: { nome: string }) {
  return <h2>{nome} (in arrivo nell'Increment 3b)</h2>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/accedi" element={<LoginPage />} />
          <Route path="/registrati-salone" element={<OnboardingPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireOwner>
                <DashboardLayout />
              </RequireOwner>
            }
          >
            <Route index element={<Navigate to="servizi" replace />} />
            <Route path="servizi" element={<Placeholder nome="Servizi" />} />
            <Route path="operatori" element={<Placeholder nome="Operatori" />} />
            <Route path="orari" element={<Placeholder nome="Orari" />} />
          </Route>
          <Route path="*" element={<Navigate to="/accedi" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

Assicurati che `src/main.tsx` renderizzi `<App />` (il template Vite lo fa già). Se `main.tsx` importa `App.css`/altri asset del template non più usati, lascialo com'è purché compili.

- [ ] **Step 6: Verifica finale del task**

```bash
cd "/Users/fabio_pace/App Barber Shop"
npm run test          # test puri + componente verdi
npx tsc -b            # nessun errore di tipo
npm run build         # build ok
```
Expected: tutto verde.

- [ ] **Step 7: Commit**

```bash
git add src/pages/OnboardingPage.tsx src/pages/OnboardingPage.test.tsx src/app/DashboardLayout.tsx src/App.tsx src/main.tsx
git commit -m "feat(3a): OnboardingPage + guscio DashboardLayout + router"
```

---

## Verifica di completamento Increment 3a

- [ ] `npm run test` → test puri + componente verdi
- [ ] `npm run test:emu` → test emulatore (auth, rules, createSalon, onboarding, auth-context) verdi
- [ ] `npx tsc -b` → nessun errore; `npm run build` → ok
- [ ] Flusso end-to-end coperto dai test: un titolare si registra → `createSalon` crea il salone e lo eleva a owner → l'auth context espone owner+salonId → la dashboard (guscio) è accessibile, un non-owner viene reindirizzato.

## Cosa NON è in questo incremento (arriva in 3b)

- Sezioni Servizi/Operatori/Orari con CRUD reale e repository (ora sono placeholder)
- Editor degli orari e degli operatori
- Stili/rifinitura visiva della dashboard (ora struttura minima)
