# Fase 3c — Auguri di compleanno automatici — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ogni giorno il sistema invia automaticamente gli auguri di compleanno ai clienti del salone che compiono gli anni oggi (con o senza codice sconto), secondo una configurazione impostabile in dashboard.

**Architecture:** La **selezione dei compleanni** è logica pura (`src/domain/birthday.ts`, unit-testata; copia in `functions/src/birthday-core.ts` come per `booking-core`). Le Cloud Function stanno in `functions/src/birthdayNotifications.ts`: un trigger **schedulato** giornaliero (`onSchedule`) che processa tutti i saloni, e una **callable** `runBirthdayGreetings` (solo staff, con `date` opzionale) che processa il proprio salone — usata sia per l'invio manuale "oggi" dalla dashboard sia per il test end-to-end sull'emulatore (i trigger schedulati non sono facilmente emulabili). Entrambe condividono `processSalon(db, salonId, today)`, che riusa il pattern notifiche (doc `notifications` idempotente + `mail/` + FCM). La clientela è calcolata lato server (prenotazioni+ordini) e i dati personali restano server-side.

**Tech Stack:** Firebase Cloud Functions (v2: `onSchedule`, `onCall`, `firebase-admin`, FCM), Firestore, React, Vitest.

**Convenzioni preesistenti:** pattern in `sendCampaign.ts` (clientela + getAll profili) e `notifyBookingStatus.ts` (notifica idempotente + mail); `useAuth()`; `salon-repo` (`getSalon`); `NotificationsPage` (coupon 3a + campagne 3b); test `test:emu` (se "port taken": `pkill -f firebase; pkill -f cloud-firestore-emulator; sleep 3`).

---

## Struttura file (Fase 3c)

- Modify: `src/domain/models.ts` (tipo `CompleannoConfig` + campo `compleanno?` su `Salon`)
- Create: `src/domain/birthday.ts` (+ `birthday.test.ts`) — selezione pura
- Create: `functions/src/birthday-core.ts` (copia della selezione), `functions/src/birthdayNotifications.ts` (schedule + callable); Modify `functions/src/index.ts`
- Create: `src/firebase/birthday.ts` (wrapper callable) + `src/firebase/birthday.emu.test.ts`
- Modify: `src/firebase/salon-repo.ts` (`updateBirthdayConfig`)
- Modify: `src/pages/NotificationsPage.tsx` (sezione Compleanno) + `src/pages/NotificationsPage.test.tsx`

---

### Task 1: Tipo `CompleannoConfig`

**Files:**
- Modify: `src/domain/models.ts`

- [ ] **Step 1: Aggiungi il tipo e il campo sul salone**

In `src/domain/models.ts`, aggiungi:
```ts
export interface CompleannoConfig {
  attivo: boolean;
  messaggio: string;
  couponId?: string | null;
}
```
e aggiungi alla interface `Salon` il campo opzionale:
```ts
  compleanno?: CompleannoConfig;
```

- [ ] **Step 2: Verifica**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/domain/models.ts
git commit -m "feat(3c): tipo CompleannoConfig"
```

---

### Task 2: Selezione compleanni (logica pura)

**Files:**
- Create: `src/domain/birthday.ts`
- Test: `src/domain/birthday.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Create `src/domain/birthday.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { birthdaysToday, isLeapYear } from "./birthday";

const people = [
  { clientId: "a", dataNascita: "1990-06-15" },
  { clientId: "b", dataNascita: "1985-06-15" },
  { clientId: "c", dataNascita: "2000-02-29" },
  { clientId: "d", dataNascita: "1995-12-01" },
];

describe("birthdaysToday", () => {
  it("seleziona chi compie gli anni oggi (per mese-giorno)", () => {
    expect(birthdaysToday(people, "2026-06-15").sort()).toEqual(["a", "b"]);
    expect(birthdaysToday(people, "2026-12-01")).toEqual(["d"]);
    expect(birthdaysToday(people, "2026-07-04")).toEqual([]);
  });

  it("in anno bisestile i nati il 29/2 festeggiano il 29/2", () => {
    expect(birthdaysToday(people, "2028-02-29")).toEqual(["c"]); // 2028 bisestile
  });

  it("in anno non bisestile i nati il 29/2 festeggiano il 28/2", () => {
    expect(birthdaysToday(people, "2026-02-28")).toEqual(["c"]); // 2026 non bisestile
    expect(birthdaysToday(people, "2028-02-28")).toEqual([]); // bisestile: nessuno il 28
  });

  it("data odierna non valida → nessuno", () => {
    expect(birthdaysToday(people, "non-una-data")).toEqual([]);
  });
});

describe("isLeapYear", () => {
  it("riconosce gli anni bisestili", () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/birthday.test.ts`
Expected: FAIL — modulo `./birthday` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/domain/birthday.ts`:
```ts
export interface BirthdayCandidate {
  clientId: string;
  /** "YYYY-MM-DD" */
  dataNascita: string;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Restituisce gli id dei candidati che compiono gli anni in `today` ("YYYY-MM-DD"),
 * confrontando mese-giorno. Regola 29/2: nei giorni non bisestili, i nati il 29/2
 * festeggiano il 28/2.
 */
export function birthdaysToday(
  candidates: BirthdayCandidate[],
  today: string
): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  const md = today.slice(5); // "MM-DD"
  const feb28NonLeap = md === "02-28" && !isLeapYear(Number(today.slice(0, 4)));
  return candidates
    .filter(
      (c) => typeof c.dataNascita === "string" && /^\d{4}-\d{2}-\d{2}$/.test(c.dataNascita)
    )
    .filter((c) => {
      const bmd = c.dataNascita.slice(5);
      return bmd === md || (feb28NonLeap && bmd === "02-29");
    })
    .map((c) => c.clientId);
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/birthday.test.ts`
Expected: PASS.

- [ ] **Step 5: Copia la logica in functions e commit**

Create `functions/src/birthday-core.ts` con **lo stesso identico contenuto** di `src/domain/birthday.ts` (copia, come per `booking-core.ts`).

```bash
git add src/domain/birthday.ts src/domain/birthday.test.ts functions/src/birthday-core.ts
git commit -m "feat(3c): selezione compleanni (logica pura + copia functions)"
```

---

### Task 3: Cloud Function compleanno (schedule + callable)

**Files:**
- Create: `functions/src/birthdayNotifications.ts`
- Modify: `functions/src/index.ts`
- Test: `src/firebase/birthday.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/birthday.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { getDoc, doc, updateDoc } from "firebase/firestore";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";
import { createOrder } from "./order";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("runBirthdayGreetings", () => {
  it("invia gli auguri ai clienti che compiono gli anni nella data indicata", async () => {
    const ownerEmail = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1000, attivo: true });
    // configura gli auguri
    await updateDoc(doc(db, "salons", salonId), {
      compleanno: { attivo: true, messaggio: "Auguri dal salone!", couponId: null },
    });
    await signOut(auth);

    // cliente che compie gli anni il 15 giugno
    await registerClient({ email: `cli_${Date.now()}@ex.com`, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-06-15" });
    await createOrder({ salonId, items: [{ productId: p, qta: 1 }] });
    const clientUid = auth.currentUser!.uid;
    await signOut(auth);

    // owner lancia gli auguri per il 2026-06-15
    await signInWithEmailAndPassword(auth, ownerEmail, "password123");
    const run = httpsCallable<{ date?: string }, { count: number }>(functions, "runBirthdayGreetings");
    const res = await run({ date: "2026-06-15" });
    expect(res.data.count).toBe(1);

    const notif = await getDoc(doc(db, "salons", salonId, "notifications", `bday_${clientUid}_2026-06-15`));
    expect(notif.exists()).toBe(true);
    expect(notif.data()?.tipo).toBe("compleanno");
  });

  it("rifiuta un chiamante non staff", async () => {
    await registerClient({ email: `x_${Date.now()}@ex.com`, password: "password123", nome: "X", sesso: "altro", dataNascita: "1990-01-01" });
    const run = httpsCallable<{ date?: string }, { count: number }>(functions, "runBirthdayGreetings");
    await expect(run({ date: "2026-06-15" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL — la callable `runBirthdayGreetings` non esiste.

- [ ] **Step 3: Implementa le function**

Create `functions/src/birthdayNotifications.ts`:
```ts
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { birthdaysToday, type BirthdayCandidate } from "./birthday-core.js";

if (getApps().length === 0) initializeApp();

function todayYMD(): string {
  return new Date().toISOString().slice(0, 10);
}

async function processSalon(db: Firestore, salonId: string, today: string): Promise<number> {
  const salon = (await db.doc(`salons/${salonId}`).get()).data();
  const compleanno = salon?.compleanno;
  if (!compleanno || compleanno.attivo !== true) return 0;

  const messaggio =
    typeof compleanno.messaggio === "string" && compleanno.messaggio.trim()
      ? compleanno.messaggio.trim()
      : "Tanti auguri di buon compleanno!";

  let couponSuffix = "";
  if (typeof compleanno.couponId === "string" && compleanno.couponId) {
    const coupon = (await db.doc(`salons/${salonId}/coupons/${compleanno.couponId}`).get()).data();
    if (coupon && coupon.attivo === true && (typeof coupon.scadenza !== "string" || coupon.scadenza >= today)) {
      const sconto =
        coupon.tipo === "percentuale" ? `-${coupon.valore}%` : `-€${(Number(coupon.valore) / 100).toFixed(2)}`;
      couponSuffix = ` Usa il codice ${coupon.codice} (${sconto}).`;
    }
  }
  const body = messaggio + couponSuffix;

  const [bookings, orders] = await Promise.all([
    db.collection(`salons/${salonId}/bookings`).get(),
    db.collection(`salons/${salonId}/orders`).get(),
  ]);
  const clientIds = new Set<string>();
  for (const d of bookings.docs) { const c = d.data().clientId; if (typeof c === "string") clientIds.add(c); }
  for (const d of orders.docs) { const c = d.data().clientId; if (typeof c === "string") clientIds.add(c); }
  const idArr = [...clientIds];
  if (idArr.length === 0) return 0;

  const snaps = await db.getAll(...idArr.map((id) => db.doc(`users/${id}`)));
  const candidates: BirthdayCandidate[] = snaps
    .filter((s) => typeof s.data()?.dataNascita === "string")
    .map((s) => ({ clientId: s.id, dataNascita: s.data()!.dataNascita as string }));
  const birthdayIds = new Set(birthdaysToday(candidates, today));
  if (birthdayIds.size === 0) return 0;

  let count = 0;
  for (const snap of snaps) {
    if (!birthdayIds.has(snap.id)) continue;
    const profile = snap.data()!;
    const email = typeof profile.email === "string" ? profile.email : null;
    const tokens = Array.isArray(profile.fcmTokens)
      ? profile.fcmTokens.filter((t: unknown): t is string => typeof t === "string" && t.length > 0)
      : [];
    const notifId = `bday_${snap.id}_${today}`;
    const notifRef = db.doc(`salons/${salonId}/notifications/${notifId}`);

    const created = await db.runTransaction(async (tx) => {
      if ((await tx.get(notifRef)).exists) return false;
      tx.create(notifRef, {
        tipo: "compleanno",
        clientId: snap.id,
        title: "Buon compleanno!",
        body,
        channels: {
          email: { status: email ? "queued" : "unavailable" },
          push: { status: tokens.length > 0 ? "queued" : "unavailable" },
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      if (email) {
        tx.set(db.doc(`mail/${salonId}_${notifId}`), {
          to: email,
          message: { subject: "Buon compleanno!", text: body },
          salonId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return true;
    });

    if (!created) continue;
    count++;
    if (tokens.length > 0) {
      try {
        await getMessaging().sendEachForMulticast({
          tokens,
          notification: { title: "Buon compleanno!", body },
          data: { salonId, tipo: "compleanno" },
        });
      } catch { /* best effort */ }
    }
  }
  return count;
}

/** Invio manuale/di test per il proprio salone (solo staff). */
export const runBirthdayGreetings = onCall<{ date?: string }>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const db = getFirestore();
  const caller = (await db.doc(`users/${uid}`).get()).data();
  const salonId = caller?.salonId;
  if (!salonId || !["owner", "staff"].includes(caller?.ruolo)) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone.");
  }
  const date = typeof request.data?.date === "string" ? request.data.date : todayYMD();
  const count = await processSalon(db, salonId, date);
  return { count };
});

/** Invio automatico giornaliero per tutti i saloni configurati. */
export const birthdayNotifications = onSchedule("every day 09:00", async () => {
  const db = getFirestore();
  const today = todayYMD();
  const salons = await db.collection("salons").get();
  for (const salon of salons.docs) {
    await processSalon(db, salon.id, today);
  }
});
```

In `functions/src/index.ts`, aggiungi:
```ts
export { runBirthdayGreetings, birthdayNotifications } from "./birthdayNotifications.js";
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/birthdayNotifications.ts functions/src/index.ts src/firebase/birthday.emu.test.ts
git commit -m "feat(3c): Cloud Function compleanno (schedule + callable manuale)"
```

---

### Task 4: `updateBirthdayConfig` + sezione Compleanno nella `NotificationsPage`

**Files:**
- Modify: `src/firebase/salon-repo.ts`
- Create: `src/firebase/birthday.ts` (wrapper callable)
- Modify: `src/pages/NotificationsPage.tsx`, `src/pages/NotificationsPage.test.tsx`

- [ ] **Step 1: Aggiungi `updateBirthdayConfig` e il wrapper callable**

In `src/firebase/salon-repo.ts`, aggiungi in fondo:
```ts
import type { CompleannoConfig } from "../domain/models";

export async function updateBirthdayConfig(
  salonId: string,
  compleanno: CompleannoConfig
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId), { compleanno });
}
```
(`doc`/`updateDoc`/`db` sono già importati nel file.)

Create `src/firebase/birthday.ts`:
```ts
import { httpsCallable } from "firebase/functions";
import { functions } from "./app";

export async function runBirthdayGreetings(date?: string): Promise<{ count: number }> {
  const callable = httpsCallable<{ date?: string }, { count: number }>(functions, "runBirthdayGreetings");
  const res = await callable(date ? { date } : {});
  return res.data;
}
```

- [ ] **Step 2: Aggiorna il test della pagina (sezione Compleanno) — deve fallire**

In `src/pages/NotificationsPage.test.tsx`, aggiungi in cima agli import:
```tsx
import * as salonRepo from "../firebase/salon-repo";
```

**Importante:** `NotificationsPage` ora chiama `getSalon` in un `useEffect`. Per evitare che i test esistenti (coupon/campagne) facciano una chiamata reale a Firestore, aggiungi un mock di default nel `beforeEach` già presente nel file (dopo il mock di `useAuth`):
```tsx
  vi.spyOn(salonRepo, "getSalon").mockResolvedValue(null);
```
(Il test compleanno qui sotto ridefinisce `getSalon` con un salone vero tramite un nuovo `vi.spyOn`.)

Poi aggiungi il test:
```tsx
it("salva la configurazione compleanno", async () => {
  vi.spyOn(repo, "listCoupons").mockResolvedValue([]);
  vi.spyOn(salonRepo, "getSalon").mockResolvedValue({
    nome: "S", timezone: "Europe/Rome", orariApertura: {},
    impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
  });
  const save = vi.spyOn(salonRepo, "updateBirthdayConfig").mockResolvedValue();
  render(<NotificationsPage />);
  await userEvent.click(await screen.findByLabelText("Auguri di compleanno attivi"));
  await userEvent.type(screen.getByLabelText("Messaggio di compleanno"), "Tanti auguri!");
  await userEvent.click(screen.getByRole("button", { name: /salva compleanno/i }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ attivo: true, messaggio: "Tanti auguri!" })
    )
  );
});
```

- [ ] **Step 3: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Expected: FAIL — la sezione Compleanno non esiste.

- [ ] **Step 4: Aggiungi la sezione Compleanno alla `NotificationsPage`**

In `src/pages/NotificationsPage.tsx`:
- import in cima:
```tsx
import { getSalon, updateBirthdayConfig } from "../firebase/salon-repo";
import { runBirthdayGreetings } from "../firebase/birthday";
```
- stato:
```tsx
  const [bdAttivo, setBdAttivo] = useState(false);
  const [bdMessaggio, setBdMessaggio] = useState("");
  const [bdCoupon, setBdCoupon] = useState("");
  const [bdResult, setBdResult] = useState<string | null>(null);
```
- carica la config all'avvio (dentro un `useEffect` che dipende da `salonId`):
```tsx
  useEffect(() => {
    if (!salonId) return;
    void getSalon(salonId).then((s) => {
      if (s?.compleanno) {
        setBdAttivo(s.compleanno.attivo);
        setBdMessaggio(s.compleanno.messaggio ?? "");
        setBdCoupon(s.compleanno.couponId ?? "");
      }
    });
  }, [salonId]);
```
- handler:
```tsx
  async function onSaveBirthday(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setBdResult(null);
    try {
      await updateBirthdayConfig(salonId, {
        attivo: bdAttivo,
        messaggio: bdMessaggio,
        couponId: bdCoupon || null,
      });
      setBdResult("Configurazione salvata.");
    } catch {
      setBdResult("Salvataggio non riuscito.");
    }
  }
  async function onSendBirthdaysNow() {
    setBdResult(null);
    try {
      const { count } = await runBirthdayGreetings();
      setBdResult(`Auguri inviati a ${count} clienti che compiono gli anni oggi.`);
    } catch {
      setBdResult("Invio auguri non riuscito.");
    }
  }
```
- JSX (dopo il compositore campagne):
```tsx
      <h3>Auguri di compleanno</h3>
      <form className="card" onSubmit={onSaveBirthday}>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" aria-label="Auguri di compleanno attivi" checked={bdAttivo} onChange={(e) => setBdAttivo(e.target.checked)} />
          Invia automaticamente gli auguri ogni giorno
        </label>
        <div className="field"><label htmlFor="bdm">Messaggio di compleanno</label>
          <textarea id="bdm" aria-label="Messaggio di compleanno" value={bdMessaggio} onChange={(e) => setBdMessaggio(e.target.value)} /></div>
        <div className="field"><label htmlFor="bdc">Coupon di compleanno (opzionale)</label>
          <select id="bdc" aria-label="Coupon di compleanno" value={bdCoupon} onChange={(e) => setBdCoupon(e.target.value)}>
            <option value="">Nessuno</option>
            {coupons.filter((c) => c.attivo).map((c) => <option key={c.id} value={c.id}>{c.codice}</option>)}
          </select></div>
        {bdResult && <p role="status">{bdResult}</p>}
        <div className="row">
          <button className="btn" type="submit">Salva compleanno</button>
          <button className="btn btn--ghost" type="button" onClick={onSendBirthdaysNow}>Invia auguri di oggi</button>
        </div>
      </form>
```

- [ ] **Step 5: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Expected: PASS (i test coupon/campagne restano verdi).

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
git add src/firebase/salon-repo.ts src/firebase/birthday.ts src/pages/NotificationsPage.tsx src/pages/NotificationsPage.test.tsx
git commit -m "feat(3c): configurazione compleanno + invio manuale in NotificationsPage"
```

---

## Verifica di completamento Fase 3c

- [ ] `npm run test` → puri/componente verdi (inclusa la selezione compleanni)
- [ ] `npm run test:emu` → emulatore verdi (`runBirthdayGreetings`)
- [ ] `npx tsc -b` e `npm run build` ok
- [ ] In dashboard → Notifiche → Compleanno: attivare, impostare messaggio e coupon, salvare; "Invia auguri di oggi" invia agli aventi diritto

## Note

- Il trigger **schedulato** (`birthdayNotifications`, `onSchedule`) non è esercitato dai test (i trigger a tempo non sono emulabili in modo pratico); la sua logica è però quella di `processSalon`, coperta end-to-end dal test della callable `runBirthdayGreetings`, e la selezione per data è coperta dagli unit test puri di `src/domain/birthday.ts`.
- In produzione, l'`onSchedule` richiede Cloud Scheduler (attivo di default sul piano Blaze); da valutare al momento del deploy.
