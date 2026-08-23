# Fase 1 · Increment 3b — Dashboard CRUD (servizi, operatori, orari) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Riempire le sezioni della dashboard con CRUD reali: Servizi (titolo/descrizione/prezzo/durata), Operatori (nome, attivo, orari personalizzati), Orari di apertura del salone — con repository tipizzati, un editor di orari settimanali riutilizzabile, e uno stile base pulito.

**Architecture:** Repository sottili in `src/firebase/` incapsulano Firestore per servizi/operatori/salone; le pagine (`src/pages/`) li usano via l'`salonId` dell'`useAuth`. Un componente controllato `WeeklyHoursEditor` gestisce le fasce orarie settimanali (riusa `hm`/`toHM` per convertire HH:MM↔minuti) ed è condiviso tra orari salone e override operatore. I repository sono testati con l'emulatore (girano come owner autenticato, verificando anche le rules); le pagine e l'editor con Testing Library (repository mockati).

**Tech Stack:** Firebase Firestore, React, React Router, Vitest (jsdom) + Testing Library.

**Convenzioni preesistenti:** `useAuth()` espone `{loading, user, role, salonId}`; tipi `Service`/`Operator`/`Salon`/`WeeklyHours` già definiti; `hm`/`toHM` in `src/domain/time.ts`; prezzi in **centesimi interi**; test `test` (puri, jsdom) e `test:emu` (file `*.emu.test.ts(x)`, avviano gli emulatori). Le tre pagine dashboard sono oggi placeholder in `src/App.tsx`.

---

## Struttura file (Increment 3b)

- Create: `src/firebase/service-repo.ts` (+ `service-repo.emu.test.ts`)
- Create: `src/firebase/operator-repo.ts` (+ `operator-repo.emu.test.ts`)
- Create: `src/firebase/salon-repo.ts` (+ `salon-repo.emu.test.ts`)
- Create: `src/components/WeeklyHoursEditor.tsx` (+ `WeeklyHoursEditor.test.tsx`)
- Create: `src/pages/ServicesPage.tsx` (+ `ServicesPage.test.tsx`)
- Create: `src/pages/OperatorsPage.tsx` (+ `OperatorsPage.test.tsx`)
- Create: `src/pages/HoursPage.tsx` (+ `HoursPage.test.tsx`)
- Create: `src/app/dashboard.css`
- Modify: `src/App.tsx` (sostituisce i placeholder con le pagine reali), `src/app/DashboardLayout.tsx` (importa lo stile)

---

### Task 1: Stile base della dashboard

**Files:**
- Create: `src/app/dashboard.css`
- Modify: `src/app/DashboardLayout.tsx`

- [ ] **Step 1: Crea lo stile base**

Create `src/app/dashboard.css`:
```css
:root {
  --bg: #f6f5f3;
  --panel: #ffffff;
  --ink: #1e1b18;
  --muted: #6b6560;
  --accent: #e67e22;
  --border: #e5e1dc;
  --danger: #c0392b;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font-family: system-ui, sans-serif; }
.dashboard { display: flex; min-height: 100vh; }
.dashboard__sidebar {
  width: 220px; background: var(--panel); border-right: 1px solid var(--border);
  padding: 20px 16px; display: flex; flex-direction: column; gap: 8px;
}
.dashboard__sidebar ul { list-style: none; padding: 0; margin: 12px 0; display: flex; flex-direction: column; gap: 4px; }
.dashboard__sidebar a {
  display: block; padding: 8px 12px; border-radius: 8px; text-decoration: none; color: var(--ink);
}
.dashboard__sidebar a.active, .dashboard__sidebar a:hover { background: rgba(230,126,34,.12); color: var(--accent); }
.dashboard__sidebar button { margin-top: auto; padding: 8px 12px; border: 1px solid var(--border); background: none; border-radius: 8px; cursor: pointer; }
.dashboard__content { flex: 1; padding: 28px; }
.card { background: var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
.btn { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 9px 14px; cursor: pointer; font-weight: 600; }
.btn--ghost { background: none; color: var(--ink); border: 1px solid var(--border); }
.btn--danger { background: none; color: var(--danger); border: 1px solid var(--danger); }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field label { font-size: .85em; color: var(--muted); }
.field input, .field textarea { padding: 8px 10px; border: 1px solid var(--border); border-radius: 8px; font: inherit; }
.row { display: flex; gap: 8px; align-items: center; }
@media (max-width: 640px) {
  .dashboard { flex-direction: column; }
  .dashboard__sidebar { width: auto; flex-direction: row; flex-wrap: wrap; }
  .dashboard__sidebar button { margin: 0; }
}
```

- [ ] **Step 2: Importa lo stile nel guscio**

In `src/app/DashboardLayout.tsx`, aggiungi come prima riga di import:
```ts
import "./dashboard.css";
```
(Nessun'altra modifica al componente.)

- [ ] **Step 3: Verifica**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test && npx tsc -b`
Expected: test verdi, nessun errore di tipo (lo stile non rompe i test esistenti).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard.css src/app/DashboardLayout.tsx
git commit -m "feat(3b): stile base della dashboard"
```

---

### Task 2: `service-repo`

**Files:**
- Create: `src/firebase/service-repo.ts`
- Test: `src/firebase/service-repo.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/service-repo.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listServices, createService, updateService, deleteService,
} from "./service-repo";
import type { Service } from "../domain/models";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

async function newSalon(): Promise<string> {
  const email = `own_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  const { salonId } = await registerOwner({
    email, password: "password123", nomeSalone: "S",
    timezone: "Europe/Rome", orariApertura: {},
  });
  return salonId;
}

const sample: Service = {
  titolo: "Taglio", descrizione: "Taglio uomo", prezzo: 2000, durataMin: 30, attivo: true,
};

describe("service-repo", () => {
  it("crea, elenca, aggiorna ed elimina un servizio", async () => {
    const salonId = await newSalon();

    const id = await createService(salonId, sample);
    expect(id).toBeTruthy();

    let list = await listServices(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, titolo: "Taglio", prezzo: 2000, durataMin: 30 });

    await updateService(salonId, id, { prezzo: 2500, attivo: false });
    list = await listServices(salonId);
    expect(list[0].prezzo).toBe(2500);
    expect(list[0].attivo).toBe(false);

    await deleteService(salonId, id);
    expect(await listServices(salonId)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL — modulo `./service-repo` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/firebase/service-repo.ts`:
```ts
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
import type { Service } from "../domain/models";

export type ServiceWithId = Service & { id: string };

const servicesCol = (salonId: string) =>
  collection(db, "salons", salonId, "services");

export async function listServices(salonId: string): Promise<ServiceWithId[]> {
  const snap = await getDocs(servicesCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Service) }));
}

export async function createService(salonId: string, data: Service): Promise<string> {
  const ref = await addDoc(servicesCol(salonId), data);
  return ref.id;
}

export async function updateService(
  salonId: string, id: string, data: Partial<Service>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "services", id), data);
}

export async function deleteService(salonId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "salons", salonId, "services", id));
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/service-repo.ts src/firebase/service-repo.emu.test.ts
git commit -m "feat(3b): service-repo (CRUD servizi)"
```

---

### Task 3: `operator-repo`

**Files:**
- Create: `src/firebase/operator-repo.ts`
- Test: `src/firebase/operator-repo.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/operator-repo.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listOperators, createOperator, updateOperator, deleteOperator,
} from "./operator-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

async function newSalon(): Promise<string> {
  const email = `own_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  const { salonId } = await registerOwner({
    email, password: "password123", nomeSalone: "S",
    timezone: "Europe/Rome", orariApertura: {},
  });
  return salonId;
}

describe("operator-repo", () => {
  it("crea, elenca, aggiorna (attivo + orari) ed elimina un operatore", async () => {
    const salonId = await newSalon();

    const id = await createOperator(salonId, { nome: "Marco", attivo: true });
    let list = await listOperators(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, nome: "Marco", attivo: true });

    await updateOperator(salonId, id, {
      attivo: false,
      orariPersonalizzati: { lun: [{ start: 600, end: 780 }] },
    });
    list = await listOperators(salonId);
    expect(list[0].attivo).toBe(false);
    expect(list[0].orariPersonalizzati?.lun).toEqual([{ start: 600, end: 780 }]);

    await deleteOperator(salonId, id);
    expect(await listOperators(salonId)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npm run test:emu`
Expected: FAIL — modulo `./operator-repo` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/firebase/operator-repo.ts`:
```ts
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
import type { Operator } from "../domain/models";

export type OperatorWithId = Operator & { id: string };

const operatorsCol = (salonId: string) =>
  collection(db, "salons", salonId, "operators");

export async function listOperators(salonId: string): Promise<OperatorWithId[]> {
  const snap = await getDocs(operatorsCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Operator) }));
}

export async function createOperator(salonId: string, data: Operator): Promise<string> {
  const ref = await addDoc(operatorsCol(salonId), data);
  return ref.id;
}

export async function updateOperator(
  salonId: string, id: string, data: Partial<Operator>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "operators", id), data);
}

export async function deleteOperator(salonId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "salons", salonId, "operators", id));
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/operator-repo.ts src/firebase/operator-repo.emu.test.ts
git commit -m "feat(3b): operator-repo (CRUD operatori)"
```

---

### Task 4: `salon-repo`

**Files:**
- Create: `src/firebase/salon-repo.ts`
- Test: `src/firebase/salon-repo.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/salon-repo.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { getSalon, updateOpeningHours } from "./salon-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("salon-repo", () => {
  it("legge il salone e aggiorna gli orari di apertura", async () => {
    const email = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "Barberia X",
      timezone: "Europe/Rome", orariApertura: { lun: [{ start: 540, end: 1140 }] },
    });

    const salon = await getSalon(salonId);
    expect(salon?.nome).toBe("Barberia X");
    expect(salon?.orariApertura.lun).toEqual([{ start: 540, end: 1140 }]);

    await updateOpeningHours(salonId, { mar: [{ start: 600, end: 720 }] });
    const updated = await getSalon(salonId);
    expect(updated?.orariApertura.mar).toEqual([{ start: 600, end: 720 }]);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npm run test:emu`
Expected: FAIL — modulo `./salon-repo` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/firebase/salon-repo.ts`:
```ts
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "./app";
import type { Salon } from "../domain/models";
import type { WeeklyHours } from "../domain/availability";

export async function getSalon(salonId: string): Promise<Salon | null> {
  const snap = await getDoc(doc(db, "salons", salonId));
  return snap.exists() ? (snap.data() as Salon) : null;
}

export async function updateOpeningHours(
  salonId: string, orariApertura: WeeklyHours
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId), { orariApertura });
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/salon-repo.ts src/firebase/salon-repo.emu.test.ts
git commit -m "feat(3b): salon-repo (lettura + aggiornamento orari)"
```

---

### Task 5: Editor orari settimanali `WeeklyHoursEditor`

**Files:**
- Create: `src/components/WeeklyHoursEditor.tsx`
- Test: `src/components/WeeklyHoursEditor.test.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/components/WeeklyHoursEditor.test.tsx`:
```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WeeklyHoursEditor } from "./WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";

describe("WeeklyHoursEditor", () => {
  it("mostra le fasce esistenti come HH:MM", () => {
    const value: WeeklyHours = { lun: [{ start: 540, end: 1140 }] };
    render(<WeeklyHoursEditor value={value} onChange={() => {}} />);
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("19:00")).toBeInTheDocument();
  });

  it("aggiunge una fascia a un giorno vuoto e notifica onChange in minuti", async () => {
    const onChange = vi.fn();
    render(<WeeklyHoursEditor value={{}} onChange={onChange} />);
    // Ogni giorno ha un bottone "Aggiungi fascia"; clic sul primo (lunedì).
    const addButtons = screen.getAllByRole("button", { name: /aggiungi fascia/i });
    await userEvent.click(addButtons[0]);
    // Default della nuova fascia: 09:00–17:00 (540–1020).
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ lun: [{ start: 540, end: 1020 }] })
    );
  });

  it("rimuove una fascia", async () => {
    const onChange = vi.fn();
    render(
      <WeeklyHoursEditor value={{ lun: [{ start: 540, end: 1140 }] }} onChange={onChange} />
    );
    await userEvent.click(screen.getByRole("button", { name: /rimuovi fascia/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ lun: [] }));
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/components/WeeklyHoursEditor.test.tsx`
Expected: FAIL — modulo `./WeeklyHoursEditor` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/components/WeeklyHoursEditor.tsx`:
```tsx
import { hm, toHM, type Interval } from "../domain/time";
import type { Weekday, WeeklyHours } from "../domain/availability";

const DAYS: { key: Weekday; label: string }[] = [
  { key: "lun", label: "Lunedì" },
  { key: "mar", label: "Martedì" },
  { key: "mer", label: "Mercoledì" },
  { key: "gio", label: "Giovedì" },
  { key: "ven", label: "Venerdì" },
  { key: "sab", label: "Sabato" },
  { key: "dom", label: "Domenica" },
];

const DEFAULT_SLOT: Interval = { start: 540, end: 1020 }; // 09:00–17:00

export function WeeklyHoursEditor({
  value,
  onChange,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
}) {
  function setDay(day: Weekday, slots: Interval[]) {
    onChange({ ...value, [day]: slots });
  }

  return (
    <div>
      {DAYS.map(({ key, label }) => {
        const slots = value[key] ?? [];
        return (
          <div key={key} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>{label}</strong>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setDay(key, [...slots, { ...DEFAULT_SLOT }])}
              >
                Aggiungi fascia
              </button>
            </div>
            {slots.length === 0 && <p style={{ color: "var(--muted)" }}>Chiuso</p>}
            {slots.map((slot, i) => (
              <div className="row" key={i} style={{ marginTop: 6 }}>
                <input
                  aria-label={`${label} inizio fascia ${i + 1}`}
                  type="time"
                  value={toHM(slot.start)}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...slot, start: hm(e.target.value) };
                    setDay(key, next);
                  }}
                />
                <span>–</span>
                <input
                  aria-label={`${label} fine fascia ${i + 1}`}
                  type="time"
                  value={toHM(slot.end)}
                  onChange={(e) => {
                    const next = [...slots];
                    next[i] = { ...slot, end: hm(e.target.value) };
                    setDay(key, next);
                  }}
                />
                <button
                  type="button"
                  className="btn btn--danger"
                  aria-label={`Rimuovi fascia ${i + 1} di ${label}`}
                  onClick={() => setDay(key, slots.filter((_, j) => j !== i))}
                >
                  Rimuovi fascia
                </button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/components/WeeklyHoursEditor.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/WeeklyHoursEditor.tsx src/components/WeeklyHoursEditor.test.tsx
git commit -m "feat(3b): WeeklyHoursEditor (fasce orarie settimanali)"
```

---

### Task 6: `ServicesPage`

**Files:**
- Create: `src/pages/ServicesPage.tsx`
- Test: `src/pages/ServicesPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/pages/ServicesPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ServicesPage } from "./ServicesPage";
import * as repo from "../firebase/service-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("ServicesPage", () => {
  it("elenca i servizi esistenti", async () => {
    vi.spyOn(repo, "listServices").mockResolvedValue([
      { id: "a", titolo: "Taglio", descrizione: "", prezzo: 2000, durataMin: 30, attivo: true },
    ]);
    render(<ServicesPage />);
    expect(await screen.findByText("Taglio")).toBeInTheDocument();
    expect(screen.getByText(/20,00/)).toBeInTheDocument(); // prezzo in euro
  });

  it("crea un servizio convertendo il prezzo in centesimi", async () => {
    vi.spyOn(repo, "listServices").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createService").mockResolvedValue("newid");
    render(<ServicesPage />);
    await userEvent.type(screen.getByLabelText("Titolo"), "Barba");
    await userEvent.type(screen.getByLabelText("Prezzo (€)"), "15");
    await userEvent.type(screen.getByLabelText("Durata (min)"), "20");
    await userEvent.click(screen.getByRole("button", { name: /aggiungi servizio/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ titolo: "Barba", prezzo: 1500, durataMin: 20, attivo: true })
      )
    );
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/ServicesPage.test.tsx`
Expected: FAIL — modulo `./ServicesPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/ServicesPage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listServices, createService, deleteService, type ServiceWithId,
} from "../firebase/service-repo";

function euro(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 });
}

export function ServicesPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<ServiceWithId[]>([]);
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [prezzoEuro, setPrezzoEuro] = useState("");
  const [durata, setDurata] = useState("");

  async function reload(id: string) {
    setItems(await listServices(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    await createService(salonId, {
      titolo,
      descrizione,
      prezzo: Math.round(parseFloat(prezzoEuro || "0") * 100),
      durataMin: parseInt(durata || "0", 10),
      attivo: true,
    });
    setTitolo(""); setDescrizione(""); setPrezzoEuro(""); setDurata("");
    await reload(salonId);
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteService(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Servizi</h2>
      {items.map((s) => (
        <div className="card row" key={s.id} style={{ justifyContent: "space-between" }}>
          <span><strong>{s.titolo}</strong> · {s.durataMin}′ · € {euro(s.prezzo)}{!s.attivo && " (non attivo)"}</span>
          <button className="btn btn--danger" onClick={() => onDelete(s.id)}>Elimina</button>
        </div>
      ))}
      <form className="card" onSubmit={onSubmit}>
        <h3>Nuovo servizio</h3>
        <div className="field"><label htmlFor="t">Titolo</label>
          <input id="t" aria-label="Titolo" value={titolo} onChange={(e) => setTitolo(e.target.value)} required /></div>
        <div className="field"><label htmlFor="d">Descrizione</label>
          <textarea id="d" aria-label="Descrizione" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} /></div>
        <div className="field"><label htmlFor="p">Prezzo (€)</label>
          <input id="p" aria-label="Prezzo (€)" type="number" min="0" step="0.01" value={prezzoEuro} onChange={(e) => setPrezzoEuro(e.target.value)} required /></div>
        <div className="field"><label htmlFor="dur">Durata (min)</label>
          <input id="dur" aria-label="Durata (min)" type="number" min="0" step="5" value={durata} onChange={(e) => setDurata(e.target.value)} required /></div>
        <button className="btn" type="submit">Aggiungi servizio</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/ServicesPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Aggancia la rotta**

In `src/App.tsx`, sostituisci la riga del placeholder Servizi. Aggiungi l'import in cima:
```ts
import { ServicesPage } from "./pages/ServicesPage";
```
e cambia:
```tsx
<Route path="servizi" element={<Placeholder nome="Servizi" />} />
```
in:
```tsx
<Route path="servizi" element={<ServicesPage />} />
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/ServicesPage.tsx src/pages/ServicesPage.test.tsx src/App.tsx
git commit -m "feat(3b): ServicesPage (CRUD servizi)"
```

---

### Task 7: `OperatorsPage`

**Files:**
- Create: `src/pages/OperatorsPage.tsx`
- Test: `src/pages/OperatorsPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/pages/OperatorsPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OperatorsPage } from "./OperatorsPage";
import * as repo from "../firebase/operator-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("OperatorsPage", () => {
  it("elenca gli operatori", async () => {
    vi.spyOn(repo, "listOperators").mockResolvedValue([
      { id: "o1", nome: "Marco", attivo: true },
    ]);
    render(<OperatorsPage />);
    expect(await screen.findByText("Marco")).toBeInTheDocument();
  });

  it("aggiunge un operatore", async () => {
    vi.spyOn(repo, "listOperators").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createOperator").mockResolvedValue("o2");
    render(<OperatorsPage />);
    await userEvent.type(screen.getByLabelText("Nome operatore"), "Luca");
    await userEvent.click(screen.getByRole("button", { name: /aggiungi operatore/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith("s1", expect.objectContaining({ nome: "Luca", attivo: true }))
    );
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/OperatorsPage.test.tsx`
Expected: FAIL — modulo `./OperatorsPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/OperatorsPage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listOperators, createOperator, updateOperator, deleteOperator,
  type OperatorWithId,
} from "../firebase/operator-repo";
import { WeeklyHoursEditor } from "../components/WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";

export function OperatorsPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<OperatorWithId[]>([]);
  const [nome, setNome] = useState("");
  const [openHours, setOpenHours] = useState<string | null>(null);

  async function reload(id: string) {
    setItems(await listOperators(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    await createOperator(salonId, { nome, attivo: true });
    setNome("");
    await reload(salonId);
  }

  async function toggleActive(op: OperatorWithId) {
    if (!salonId) return;
    await updateOperator(salonId, op.id, { attivo: !op.attivo });
    await reload(salonId);
  }

  async function saveHours(op: OperatorWithId, orari: WeeklyHours) {
    if (!salonId) return;
    await updateOperator(salonId, op.id, { orariPersonalizzati: orari });
    await reload(salonId);
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteOperator(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Operatori</h2>
      {items.map((op) => (
        <div className="card" key={op.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{op.nome}{!op.attivo && " (non attivo)"}</strong>
            <div className="row">
              <button className="btn btn--ghost" onClick={() => toggleActive(op)}>
                {op.attivo ? "Disattiva" : "Attiva"}
              </button>
              <button className="btn btn--ghost" onClick={() => setOpenHours(openHours === op.id ? null : op.id)}>
                Orari
              </button>
              <button className="btn btn--danger" onClick={() => onDelete(op.id)}>Elimina</button>
            </div>
          </div>
          {openHours === op.id && (
            <div style={{ marginTop: 10 }}>
              <p style={{ color: "var(--muted)" }}>Orari personalizzati (sovrascrivono quelli del salone)</p>
              <WeeklyHoursEditor
                value={op.orariPersonalizzati ?? {}}
                onChange={(orari) => void saveHours(op, orari)}
              />
            </div>
          )}
        </div>
      ))}
      <form className="card" onSubmit={onAdd}>
        <h3>Nuovo operatore</h3>
        <div className="field">
          <label htmlFor="nome">Nome operatore</label>
          <input id="nome" aria-label="Nome operatore" value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <button className="btn" type="submit">Aggiungi operatore</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/OperatorsPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Aggancia la rotta**

In `src/App.tsx`, aggiungi l'import:
```ts
import { OperatorsPage } from "./pages/OperatorsPage";
```
e sostituisci `<Route path="operatori" element={<Placeholder nome="Operatori" />} />` con `<Route path="operatori" element={<OperatorsPage />} />`.

- [ ] **Step 6: Commit**

```bash
git add src/pages/OperatorsPage.tsx src/pages/OperatorsPage.test.tsx src/App.tsx
git commit -m "feat(3b): OperatorsPage (CRUD operatori + orari)"
```

---

### Task 8: `HoursPage` (orari di apertura salone)

**Files:**
- Create: `src/pages/HoursPage.tsx`
- Test: `src/pages/HoursPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/pages/HoursPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HoursPage } from "./HoursPage";
import * as repo from "../firebase/salon-repo";
import * as authCtx from "../app/auth-context";
import type { Salon } from "../domain/models";

const salon: Salon = {
  nome: "X", timezone: "Europe/Rome",
  orariApertura: { lun: [{ start: 540, end: 1140 }] },
  impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("HoursPage", () => {
  it("carica gli orari del salone e li salva", async () => {
    vi.spyOn(repo, "getSalon").mockResolvedValue(salon);
    const save = vi.spyOn(repo, "updateOpeningHours").mockResolvedValue();
    render(<HoursPage />);
    expect(await screen.findByDisplayValue("09:00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /salva orari/i }));
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ lun: [{ start: 540, end: 1140 }] })
      )
    );
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/HoursPage.test.tsx`
Expected: FAIL — modulo `./HoursPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/HoursPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useAuth } from "../app/auth-context";
import { getSalon, updateOpeningHours } from "../firebase/salon-repo";
import { WeeklyHoursEditor } from "../components/WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";

export function HoursPage() {
  const { salonId } = useAuth();
  const [hours, setHours] = useState<WeeklyHours | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!salonId) return;
    void getSalon(salonId).then((s) => setHours(s?.orariApertura ?? {}));
  }, [salonId]);

  async function onSave() {
    if (!salonId || !hours) return;
    await updateOpeningHours(salonId, hours);
    setSaved(true);
  }

  if (!hours) return <p>Caricamento…</p>;

  return (
    <section>
      <h2>Orari di apertura</h2>
      <WeeklyHoursEditor value={hours} onChange={(h) => { setHours(h); setSaved(false); }} />
      <button className="btn" onClick={onSave}>Salva orari</button>
      {saved && <span role="status" style={{ marginLeft: 10 }}>Salvato ✓</span>}
    </section>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/HoursPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Aggancia la rotta**

In `src/App.tsx`, aggiungi l'import:
```ts
import { HoursPage } from "./pages/HoursPage";
```
e sostituisci `<Route path="orari" element={<Placeholder nome="Orari" />} />` con `<Route path="orari" element={<HoursPage />} />`. Rimuovi il componente `Placeholder` se non più usato.

- [ ] **Step 6: Verifica finale**

```bash
cd "/Users/fabio_pace/App Barber Shop"
npm run test         # tutti i test puri/componente verdi
npm run test:emu     # tutti i test emulatore (repo) verdi
npx tsc -b           # nessun errore
npm run build        # build ok
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/HoursPage.tsx src/pages/HoursPage.test.tsx src/App.tsx
git commit -m "feat(3b): HoursPage (orari di apertura)"
```

---

## Verifica di completamento Increment 3b

- [ ] `npm run test` → puri/componente verdi (repos mockati nei test pagina)
- [ ] `npm run test:emu` → repo testati contro l'emulatore (con isolamento multi-salone via rules)
- [ ] `npx tsc -b` e `npm run build` ok
- [ ] Nella dashboard: creare/eliminare servizi; aggiungere/attivare/eliminare operatori e modificarne gli orari; modificare gli orari di apertura del salone — tutto persistito su Firestore

## Cosa NON è in questo incremento

- Design completo che ricalca il mockup arancione (palette/tipografia/card curate) → passo di design dedicato successivo
- Vista prenotazioni + conferma/rifiuto → Increment 4
- Modifica in-place dei servizi (ora: crea + elimina; l'edit completo può arrivare dopo se serve)
