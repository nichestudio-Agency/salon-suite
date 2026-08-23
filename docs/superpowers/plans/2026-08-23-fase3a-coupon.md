# Fase 3a — Coupon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il salone crea e gestisce coupon (codice personalizzato, tipo `percentuale`/`fisso`, valore, scadenza opzionale, attivo) da una nuova sezione "Notifiche" della dashboard.

**Architecture:** Riusa i pattern consolidati: tipo in `models.ts`, repository sottile `coupon-repo` (CRUD Firestore), Security Rules multi-tenant (solo staff), componente/pagina React che usa `useAuth().salonId`. La sezione "Notifiche" ospiterà in seguito anche compositore campagne (3b) e configurazione compleanno (3c); in 3a contiene solo la gestione coupon.

**Tech Stack:** Firebase Firestore, React, React Router, Vitest (jsdom) + Testing Library.

**Convenzioni preesistenti:** `useAuth()` → `{loading,user,role,salonId}`; repos in `src/firebase/`; `formatEuro` in `src/domain/money.ts`; rules helper `isStaffOf(salonId)`; test `test` (puri/jsdom) e `test:emu` (`*.emu.test.ts(x)`; se "port taken": `pkill -f firebase; pkill -f cloud-firestore-emulator; sleep 3`). Pattern di riferimento: `service-repo.ts`, `ServicesPage.tsx`, il blocco `services` in `firestore.rules` e `rules.emu.test.ts`.

---

## Struttura file (Fase 3a)

- Modify: `src/domain/models.ts` (tipi `CouponType`, `Coupon`)
- Create: `src/firebase/coupon-repo.ts` (+ `coupon-repo.emu.test.ts`)
- Modify: `firestore.rules` (blocco `coupons`) + `src/firebase/rules.emu.test.ts`
- Create: `src/pages/NotificationsPage.tsx` (+ `NotificationsPage.test.tsx`)
- Modify: `src/App.tsx` (rotta `/dashboard/notifiche`), `src/app/DashboardLayout.tsx` (voce "Notifiche")

---

### Task 1: Tipo `Coupon`

**Files:**
- Modify: `src/domain/models.ts`

- [ ] **Step 1: Aggiungi i tipi**

In `src/domain/models.ts`, aggiungi:
```ts
export type CouponType = "percentuale" | "fisso";

/** Documento in `salons/{salonId}/coupons/{id}`. */
export interface Coupon {
  /** Codice personalizzato dal salone, es. "ESTATE20". */
  codice: string;
  tipo: CouponType;
  /** percentuale: 0-100; fisso: centesimi interi. */
  valore: number;
  /** Scadenza "YYYY-MM-DD", opzionale. */
  scadenza?: string;
  attivo: boolean;
}
```

- [ ] **Step 2: Verifica**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/domain/models.ts
git commit -m "feat(3a): tipo Coupon"
```

---

### Task 2: `coupon-repo` (CRUD)

**Files:**
- Create: `src/firebase/coupon-repo.ts`
- Test: `src/firebase/coupon-repo.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/coupon-repo.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listCoupons, createCoupon, updateCoupon, deleteCoupon,
} from "./coupon-repo";
import type { Coupon } from "../domain/models";

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

const sample: Coupon = {
  codice: "ESTATE20", tipo: "percentuale", valore: 20, attivo: true,
};

describe("coupon-repo", () => {
  it("crea, elenca, aggiorna ed elimina un coupon", async () => {
    const salonId = await newSalon();

    const id = await createCoupon(salonId, sample);
    expect(id).toBeTruthy();

    let list = await listCoupons(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, codice: "ESTATE20", tipo: "percentuale", valore: 20 });

    await updateCoupon(salonId, id, { attivo: false });
    list = await listCoupons(salonId);
    expect(list[0].attivo).toBe(false);

    await deleteCoupon(salonId, id);
    expect(await listCoupons(salonId)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL — modulo `./coupon-repo` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/firebase/coupon-repo.ts`:
```ts
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
import type { Coupon } from "../domain/models";

export type CouponWithId = Coupon & { id: string };

const couponsCol = (salonId: string) =>
  collection(db, "salons", salonId, "coupons");

export async function listCoupons(salonId: string): Promise<CouponWithId[]> {
  const snap = await getDocs(couponsCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Coupon) }));
}

export async function createCoupon(salonId: string, data: Coupon): Promise<string> {
  const ref = await addDoc(couponsCol(salonId), data);
  return ref.id;
}

export async function updateCoupon(
  salonId: string, id: string, data: Partial<Coupon>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "coupons", id), data);
}

export async function deleteCoupon(salonId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "salons", salonId, "coupons", id));
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/coupon-repo.ts src/firebase/coupon-repo.emu.test.ts
git commit -m "feat(3a): coupon-repo (CRUD coupon)"
```

---

### Task 3: Security Rules per i coupon

**Files:**
- Modify: `firestore.rules`
- Test: `src/firebase/rules.emu.test.ts`

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/firebase/rules.emu.test.ts`, aggiungi un blocco `describe("coupon", ...)` (riusa gli helper `client(uid)`, i seed `salonA`/`salonB`/`staffA`/`staffB` esistenti; segui il pattern del blocco `services`). I coupon sono dati riservati al salone: lettura E scrittura solo staff.
```ts
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
```
(Se `staffB` non è tra i seed, è stato aggiunto nel blocco ordini della Fase 2b; riusalo. Riusa `doc`/`getDoc`/`setDoc` già importati in cima al file.)

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npm run test:emu`
Expected: FAIL — nessun match `coupons` ⇒ tutto negato; gli `assertSucceeds` dello staff falliscono.

- [ ] **Step 3: Aggiungi le regole coupon**

In `firestore.rules`, dentro `match /salons/{salonId}`, accanto a `services`/`products`, aggiungi:
```
      match /coupons/{couponId} {
        allow read, write: if isStaffOf(salonId);
      }
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/firebase/rules.emu.test.ts
git commit -m "feat(3a): Security Rules coupon (solo staff del salone)"
```

---

### Task 4: `NotificationsPage` (gestione coupon in dashboard)

**Files:**
- Create: `src/pages/NotificationsPage.tsx`
- Test: `src/pages/NotificationsPage.test.tsx`
- Modify: `src/App.tsx`, `src/app/DashboardLayout.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/pages/NotificationsPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsPage } from "./NotificationsPage";
import * as repo from "../firebase/coupon-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("NotificationsPage — coupon", () => {
  it("elenca i coupon esistenti", async () => {
    vi.spyOn(repo, "listCoupons").mockResolvedValue([
      { id: "a", codice: "ESTATE20", tipo: "percentuale", valore: 20, attivo: true },
    ]);
    render(<NotificationsPage />);
    expect(await screen.findByText("ESTATE20")).toBeInTheDocument();
    expect(screen.getByText(/20%/)).toBeInTheDocument();
  });

  it("crea un coupon percentuale", async () => {
    vi.spyOn(repo, "listCoupons").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createCoupon").mockResolvedValue("newid");
    render(<NotificationsPage />);
    await userEvent.type(screen.getByLabelText("Codice"), "AUTUNNO10");
    await userEvent.type(screen.getByLabelText("Valore"), "10");
    await userEvent.click(screen.getByRole("button", { name: /crea coupon/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ codice: "AUTUNNO10", tipo: "percentuale", valore: 10, attivo: true })
      )
    );
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Expected: FAIL — modulo `./NotificationsPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/NotificationsPage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listCoupons, createCoupon, deleteCoupon, type CouponWithId,
} from "../firebase/coupon-repo";
import { formatEuro } from "../domain/money";
import type { CouponType } from "../domain/models";

function descrizioneSconto(c: CouponWithId): string {
  return c.tipo === "percentuale" ? `${c.valore}%` : `€ ${formatEuro(c.valore)}`;
}

export function NotificationsPage() {
  const { salonId } = useAuth();
  const [coupons, setCoupons] = useState<CouponWithId[]>([]);
  const [codice, setCodice] = useState("");
  const [tipo, setTipo] = useState<CouponType>("percentuale");
  const [valore, setValore] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload(id: string) {
    setCoupons(await listCoupons(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setError(null);
    try {
      await createCoupon(salonId, {
        codice: codice.trim(),
        tipo,
        valore:
          tipo === "percentuale"
            ? parseInt(valore || "0", 10)
            : Math.round(parseFloat(valore || "0") * 100),
        ...(scadenza ? { scadenza } : {}),
        attivo: true,
      });
      setCodice(""); setValore(""); setScadenza("");
      await reload(salonId);
    } catch {
      setError("Creazione del coupon non riuscita.");
    }
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteCoupon(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Notifiche</h2>
      <h3>Coupon</h3>
      {coupons.map((c) => (
        <div className="card row" key={c.id} style={{ justifyContent: "space-between" }}>
          <span>
            <strong>{c.codice}</strong> · {descrizioneSconto(c)}
            {c.scadenza && ` · scade ${c.scadenza}`}
            {!c.attivo && " · (non attivo)"}
          </span>
          <button className="btn btn--danger" onClick={() => onDelete(c.id)}>Elimina</button>
        </div>
      ))}
      <form className="card" onSubmit={onSubmit}>
        <h3>Nuovo coupon</h3>
        <div className="field"><label htmlFor="cc">Codice</label>
          <input id="cc" aria-label="Codice" value={codice} onChange={(e) => setCodice(e.target.value)} required /></div>
        <div className="field"><label htmlFor="ct">Tipo</label>
          <select id="ct" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as CouponType)}>
            <option value="percentuale">Percentuale (%)</option>
            <option value="fisso">Importo fisso (€)</option>
          </select></div>
        <div className="field"><label htmlFor="cv">Valore</label>
          <input id="cv" aria-label="Valore" type="number" min="0" step={tipo === "percentuale" ? "1" : "0.01"} value={valore} onChange={(e) => setValore(e.target.value)} required /></div>
        <div className="field"><label htmlFor="cs">Scadenza (opzionale)</label>
          <input id="cs" aria-label="Scadenza (opzionale)" type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} /></div>
        {error && <p role="alert">{error}</p>}
        <button className="btn" type="submit">Crea coupon</button>
      </form>
      <p style={{ color: "var(--muted)", marginTop: 12 }}>
        Compositore campagne e auguri di compleanno in arrivo nelle prossime parti.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Aggancia rotta e voce di menu**

In `src/App.tsx`, aggiungi l'import `import { NotificationsPage } from "./pages/NotificationsPage";` e, tra le rotte `/dashboard`, aggiungi:
```tsx
<Route path="notifiche" element={<NotificationsPage />} />
```
In `src/app/DashboardLayout.tsx`, aggiungi a `SECTIONS` (dopo "Ordini"):
```ts
  { to: "/dashboard/notifiche", label: "Notifiche" },
```

- [ ] **Step 6: Verifica finale**

```bash
cd "/Users/fabio_pace/App Barber Shop"
npm run test
npm run test:emu
npx tsc -b
npm run build
```
Expected: tutto verde.

- [ ] **Step 7: Commit**

```bash
git add src/pages/NotificationsPage.tsx src/pages/NotificationsPage.test.tsx src/App.tsx src/app/DashboardLayout.tsx
git commit -m "feat(3a): NotificationsPage — gestione coupon"
```

---

## Verifica di completamento Fase 3a

- [ ] `npm run test` → puri/componente verdi
- [ ] `npm run test:emu` → emulatore verdi (coupon-repo, rules coupon)
- [ ] `npx tsc -b` e `npm run build` ok
- [ ] In dashboard → "Notifiche": creare/eliminare coupon (percentuale o fisso, con scadenza opzionale)

## Cosa NON è in questo incremento (arriva in 3b/3c)

- `sendCampaign` + compositore campagne mirate (filtri sesso/età) → 3b
- Auguri di compleanno schedulati + configurazione → 3c
- Modifica in-place dei coupon (ora: crea + elimina)
