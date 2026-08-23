# Fase 3b — Notifiche mirate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lo staff compone una campagna (filtri sesso + fascia d'età, titolo, testo, coupon opzionale) e la invia; una Cloud Function `sendCampaign` calcola i destinatari (clientela del salone), applica i filtri **lato server** e invia push+email, restituendo il numero di destinatari.

**Architecture:** Riusa i pattern delle altre Cloud Function. `sendCampaign` (callable, solo `isStaffOf`) ricava i `clientId` distinti da `bookings` + `orders` del salone, carica i profili **lato admin**, filtra per `sesso`/`dataNascita`, compone il messaggio (append del coupon se indicato), scrive i doc `mail/` (batch) e invia FCM, registra il doc `campaigns/{id}`. Il salone non legge mai i dati personali. Il compositore vive nella `NotificationsPage` (accanto ai coupon della 3a).

**Tech Stack:** Firebase Cloud Functions (v2, `firebase-admin`, FCM), Firestore, React, Vitest.

**Convenzioni preesistenti:** callable esposte in `functions/src/index.ts`; pattern in `createOrder.ts`/`notifyBookingStatus.ts`; `useAuth()`; `coupon-repo` (`listCoupons`); `formatEuro`; test `test:emu` (se "port taken": `pkill -f firebase; pkill -f cloud-firestore-emulator; sleep 3`).

---

## Struttura file (Fase 3b)

- Modify: `src/domain/models.ts` (tipi `CampaignFilters`, `Campaign`)
- Create: `functions/src/sendCampaign.ts`; Modify `functions/src/index.ts`
- Modify: `firestore.rules` (blocco `campaigns`) + `src/firebase/rules.emu.test.ts`
- Create: `src/firebase/campaign.ts` (wrapper callable) + `src/firebase/campaign.emu.test.ts`
- Modify: `src/pages/NotificationsPage.tsx` (compositore campagna) + `src/pages/NotificationsPage.test.tsx`

---

### Task 1: Tipi Campaign

**Files:**
- Modify: `src/domain/models.ts`

- [ ] **Step 1: Aggiungi i tipi**

In `src/domain/models.ts`, aggiungi:
```ts
export interface CampaignFilters {
  sesso?: "maschile" | "femminile";
  /** Data di nascita minima "YYYY-MM-DD" (nato da). */
  natoDa?: string;
  /** Data di nascita massima "YYYY-MM-DD" (nato a). */
  natoA?: string;
}

/** Documento in `salons/{salonId}/campaigns/{id}` (audit, creato dalla Cloud Function). */
export interface Campaign {
  filtri: CampaignFilters;
  titolo: string;
  testo: string;
  couponId?: string | null;
  recipientCount: number;
}
```

- [ ] **Step 2: Verifica**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/domain/models.ts
git commit -m "feat(3b): tipi Campaign"
```

---

### Task 2: Cloud Function `sendCampaign`

**Files:**
- Create: `functions/src/sendCampaign.ts`
- Modify: `functions/src/index.ts`
- Test: `src/firebase/campaign.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/campaign.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";
import { createOrder } from "./order";
import type { Gender } from "../domain/models";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

const send = () =>
  httpsCallable<
    { salonId: string; filtri: { sesso?: string; natoDa?: string; natoA?: string }; titolo: string; testo: string; couponId?: string },
    { campaignId: string; recipientCount: number }
  >(functions, "sendCampaign");

async function clientWithOrder(salonId: string, productId: string, sesso: Gender, dataNascita: string) {
  const email = `cli_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  await registerClient({ email, password: "password123", nome: "Cli", sesso, dataNascita });
  await createOrder({ salonId, items: [{ productId, qta: 1 }] });
  await signOut(auth);
}

describe("sendCampaign", () => {
  it("conta i destinatari applicando i filtri sesso/età lato server", async () => {
    const ownerEmail = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1000, attivo: true });
    await signOut(auth);

    // clientela: 2 uomini (2000, 1980) + 1 donna (1995)
    await clientWithOrder(salonId, p, "maschile", "2000-05-10");
    await clientWithOrder(salonId, p, "maschile", "1980-03-01");
    await clientWithOrder(salonId, p, "femminile", "1995-07-20");

    await signInWithEmailAndPassword(auth, ownerEmail, "password123");

    const tutti = await send()({ salonId, filtri: {}, titolo: "Promo", testo: "Sconti!" });
    expect(tutti.data.recipientCount).toBe(3);

    const soloUomini = await send()({ salonId, filtri: { sesso: "maschile" }, titolo: "Promo", testo: "Sconti!" });
    expect(soloUomini.data.recipientCount).toBe(2);

    const giovani = await send()({ salonId, filtri: { natoDa: "1990-01-01" }, titolo: "Promo", testo: "Sconti!" });
    expect(giovani.data.recipientCount).toBe(2); // nati nel 2000 e 1995
  });

  it("rifiuta un chiamante che non è staff del salone", async () => {
    const ownerEmail = `own2_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S2",
      timezone: "Europe/Rome", orariApertura: {},
    });
    await signOut(auth);
    await registerClient({ email: `intruso_${Date.now()}@ex.com`, password: "password123", nome: "X", sesso: "altro", dataNascita: "1990-01-01" });
    await expect(send()({ salonId, filtri: {}, titolo: "T", testo: "B" })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL — la callable `sendCampaign` non esiste.

- [ ] **Step 3: Implementa la function**

Create `functions/src/sendCampaign.ts`:
```ts
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

interface CampaignFilters {
  sesso?: "maschile" | "femminile";
  natoDa?: string;
  natoA?: string;
}
interface SendCampaignData {
  salonId: string;
  filtri?: CampaignFilters;
  titolo: string;
  testo: string;
  couponId?: string;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value;
}

export const sendCampaign = onCall<SendCampaignData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const titolo = (request.data?.titolo ?? "").trim();
  const testo = (request.data?.testo ?? "").trim();
  if (!titolo || !testo) {
    throw new HttpsError("invalid-argument", "Titolo e testo sono obbligatori.");
  }
  const filtri: CampaignFilters = request.data?.filtri ?? {};

  const db = getFirestore();
  const callerSnap = await db.doc(`users/${uid}`).get();
  const caller = callerSnap.data();
  if (
    !callerSnap.exists ||
    caller?.salonId !== salonId ||
    !["owner", "staff"].includes(caller?.ruolo)
  ) {
    throw new HttpsError("permission-denied", "Solo lo staff del salone può inviare campagne.");
  }

  // Clientela: clientId distinti da prenotazioni + ordini del salone.
  const [bookings, orders] = await Promise.all([
    db.collection(`salons/${salonId}/bookings`).get(),
    db.collection(`salons/${salonId}/orders`).get(),
  ]);
  const clientIds = new Set<string>();
  for (const d of bookings.docs) {
    const c = d.data().clientId;
    if (typeof c === "string") clientIds.add(c);
  }
  for (const d of orders.docs) {
    const c = d.data().clientId;
    if (typeof c === "string") clientIds.add(c);
  }

  // Coupon opzionale → suffisso nel messaggio.
  let couponSuffix = "";
  const couponId = request.data?.couponId;
  if (typeof couponId === "string" && couponId) {
    const couponSnap = await db.doc(`salons/${salonId}/coupons/${couponId}`).get();
    const coupon = couponSnap.data();
    if (couponSnap.exists && coupon) {
      const sconto =
        coupon.tipo === "percentuale"
          ? `-${coupon.valore}%`
          : `-€${(Number(coupon.valore) / 100).toFixed(2)}`;
      couponSuffix = ` Usa il codice ${coupon.codice} (${sconto}).`;
    }
  }
  const body = testo + couponSuffix;

  // Filtra i profili lato server e raccogli token/email.
  const tokens: string[] = [];
  const emails: string[] = [];
  let recipientCount = 0;
  for (const clientId of clientIds) {
    const profile = (await db.doc(`users/${clientId}`).get()).data();
    if (!profile) continue;
    if (filtri.sesso && profile.sesso !== filtri.sesso) continue;
    const nascita = typeof profile.dataNascita === "string" ? profile.dataNascita : null;
    if (filtri.natoDa && (!nascita || nascita < filtri.natoDa)) continue;
    if (filtri.natoA && (!nascita || nascita > filtri.natoA)) continue;
    recipientCount++;
    if (Array.isArray(profile.fcmTokens)) {
      for (const t of profile.fcmTokens) {
        if (typeof t === "string" && t.length > 0) tokens.push(t);
      }
    }
    if (typeof profile.email === "string" && profile.email) emails.push(profile.email);
  }

  const campaignRef = db.collection(`salons/${salonId}/campaigns`).doc();
  await campaignRef.set({
    filtri,
    titolo,
    testo,
    couponId: couponId ?? null,
    recipientCount,
    sentAt: FieldValue.serverTimestamp(),
  });

  // Email via estensione mail (batch; per lotti oltre 500 servirà chunking, non necessario ora).
  if (emails.length > 0) {
    const batch = db.batch();
    emails.forEach((email, i) => {
      batch.set(db.doc(`mail/${campaignRef.id}_${i}`), {
        to: email,
        message: { subject: titolo, text: body },
        salonId,
        campaignId: campaignRef.id,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
  }

  // Push (best effort).
  if (tokens.length > 0) {
    try {
      await getMessaging().sendEachForMulticast({
        tokens,
        notification: { title: titolo, body },
        data: { salonId, campaignId: campaignRef.id },
      });
    } catch {
      // best effort: l'email resta il canale di riserva
    }
  }

  return { campaignId: campaignRef.id, recipientCount };
});
```

In `functions/src/index.ts`, aggiungi:
```ts
export { sendCampaign } from "./sendCampaign.js";
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/sendCampaign.ts functions/src/index.ts src/firebase/campaign.emu.test.ts
git commit -m "feat(3b): Cloud Function sendCampaign (targeting server-side)"
```

---

### Task 3: Security Rules per le campagne

**Files:**
- Modify: `firestore.rules`
- Test: `src/firebase/rules.emu.test.ts`

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/firebase/rules.emu.test.ts`, aggiungi `describe("campagne", ...)` (riusa helper e seed esistenti):
```ts
describe("campagne", () => {
  it("creazione diretta vietata (solo via Cloud Function)", async () => {
    await assertFails(
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
```

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npm run test:emu`
Expected: FAIL — nessun match `campaigns`: la lettura staff (`assertSucceeds`) fallisce.

- [ ] **Step 3: Aggiungi le regole campagne**

In `firestore.rules`, dentro `match /salons/{salonId}`, accanto a `coupons`, aggiungi:
```
      match /campaigns/{campaignId} {
        allow read: if isStaffOf(salonId);
        allow write: if false;
      }
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/firebase/rules.emu.test.ts
git commit -m "feat(3b): Security Rules campagne (lettura staff, create via function)"
```

---

### Task 4: Wrapper `campaign.ts` + compositore nella `NotificationsPage`

**Files:**
- Create: `src/firebase/campaign.ts`
- Modify: `src/pages/NotificationsPage.tsx`, `src/pages/NotificationsPage.test.tsx`

- [ ] **Step 1: Crea il wrapper client**

Create `src/firebase/campaign.ts`:
```ts
import { httpsCallable } from "firebase/functions";
import { functions } from "./app";
import type { CampaignFilters } from "../domain/models";

export interface SendCampaignInput {
  salonId: string;
  filtri: CampaignFilters;
  titolo: string;
  testo: string;
  couponId?: string;
}
export interface SendCampaignResult {
  campaignId: string;
  recipientCount: number;
}

export async function sendCampaign(input: SendCampaignInput): Promise<SendCampaignResult> {
  const callable = httpsCallable<SendCampaignInput, SendCampaignResult>(functions, "sendCampaign");
  const res = await callable(input);
  return res.data;
}
```

- [ ] **Step 2: Aggiorna il test della pagina (compositore) — deve fallire**

In `src/pages/NotificationsPage.test.tsx`, aggiungi in cima agli import:
```tsx
import * as campaignApi from "../firebase/campaign";
```
e un test:
```tsx
it("invia una campagna con i filtri scelti e mostra i destinatari", async () => {
  vi.spyOn(repo, "listCoupons").mockResolvedValue([]);
  const send = vi.spyOn(campaignApi, "sendCampaign").mockResolvedValue({ campaignId: "x", recipientCount: 7 });
  render(<NotificationsPage />);
  await userEvent.type(screen.getByLabelText("Titolo campagna"), "Promo estate");
  await userEvent.type(screen.getByLabelText("Testo campagna"), "Sconti su tutto");
  await userEvent.selectOptions(screen.getByLabelText("Sesso destinatari"), "maschile");
  await userEvent.click(screen.getByRole("button", { name: /invia campagna/i }));
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        salonId: "s1",
        titolo: "Promo estate",
        testo: "Sconti su tutto",
        filtri: expect.objectContaining({ sesso: "maschile" }),
      })
    )
  );
  expect(await screen.findByText(/7 destinatari/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Expected: FAIL — il compositore non esiste ancora.

- [ ] **Step 4: Aggiungi il compositore alla `NotificationsPage`**

In `src/pages/NotificationsPage.tsx`:
- import in cima:
```tsx
import { sendCampaign } from "../firebase/campaign";
import type { CampaignFilters } from "../domain/models";
```
- aggiungi stato del compositore dentro il componente:
```tsx
  const [campTitolo, setCampTitolo] = useState("");
  const [campTesto, setCampTesto] = useState("");
  const [campSesso, setCampSesso] = useState<"" | "maschile" | "femminile">("");
  const [campNatoDa, setCampNatoDa] = useState("");
  const [campNatoA, setCampNatoA] = useState("");
  const [campCoupon, setCampCoupon] = useState("");
  const [campResult, setCampResult] = useState<string | null>(null);
  const [campBusy, setCampBusy] = useState(false);
```
- aggiungi l'handler:
```tsx
  async function onSendCampaign(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setCampBusy(true);
    setCampResult(null);
    try {
      const filtri: CampaignFilters = {};
      if (campSesso) filtri.sesso = campSesso;
      if (campNatoDa) filtri.natoDa = campNatoDa;
      if (campNatoA) filtri.natoA = campNatoA;
      const res = await sendCampaign({
        salonId,
        filtri,
        titolo: campTitolo,
        testo: campTesto,
        ...(campCoupon ? { couponId: campCoupon } : {}),
      });
      setCampResult(`Campagna inviata a ${res.recipientCount} destinatari.`);
      setCampTitolo(""); setCampTesto("");
    } catch {
      setCampResult("Invio della campagna non riuscito.");
    } finally {
      setCampBusy(false);
    }
  }
```
- aggiungi il form del compositore nel JSX, dopo il form dei coupon (prima del paragrafo "Compositore campagne … in arrivo", che va rimosso o aggiornato):
```tsx
      <h3>Invia una notifica mirata</h3>
      <form className="card" onSubmit={onSendCampaign}>
        <div className="field"><label htmlFor="ct2">Titolo campagna</label>
          <input id="ct2" aria-label="Titolo campagna" value={campTitolo} onChange={(e) => setCampTitolo(e.target.value)} required /></div>
        <div className="field"><label htmlFor="cx">Testo campagna</label>
          <textarea id="cx" aria-label="Testo campagna" value={campTesto} onChange={(e) => setCampTesto(e.target.value)} required /></div>
        <div className="field"><label htmlFor="cse">Sesso destinatari</label>
          <select id="cse" aria-label="Sesso destinatari" value={campSesso} onChange={(e) => setCampSesso(e.target.value as "" | "maschile" | "femminile")}>
            <option value="">Qualsiasi</option>
            <option value="maschile">Maschile</option>
            <option value="femminile">Femminile</option>
          </select></div>
        <div className="field"><label htmlFor="cnd">Nato da (opzionale)</label>
          <input id="cnd" aria-label="Nato da" type="date" value={campNatoDa} onChange={(e) => setCampNatoDa(e.target.value)} /></div>
        <div className="field"><label htmlFor="cna">Nato a (opzionale)</label>
          <input id="cna" aria-label="Nato a" type="date" value={campNatoA} onChange={(e) => setCampNatoA(e.target.value)} /></div>
        <div className="field"><label htmlFor="ccp">Coupon (opzionale)</label>
          <select id="ccp" aria-label="Coupon" value={campCoupon} onChange={(e) => setCampCoupon(e.target.value)}>
            <option value="">Nessuno</option>
            {coupons.map((c) => <option key={c.id} value={c.id}>{c.codice}</option>)}
          </select></div>
        {campResult && <p role="status">{campResult}</p>}
        <button className="btn" type="submit" disabled={campBusy}>Invia campagna</button>
      </form>
```
Rimuovi il paragrafo segnaposto "Compositore campagne e auguri di compleanno in arrivo…" (l'auguri compleanno arriva in 3c).

- [ ] **Step 5: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/NotificationsPage.test.tsx`
Expected: PASS (i test coupon della 3a restano verdi).

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
git add src/firebase/campaign.ts src/pages/NotificationsPage.tsx src/pages/NotificationsPage.test.tsx
git commit -m "feat(3b): compositore campagne mirate in NotificationsPage"
```

---

## Verifica di completamento Fase 3b

- [ ] `npm run test` → puri/componente verdi
- [ ] `npm run test:emu` → emulatore verdi (sendCampaign, rules campagne)
- [ ] `npx tsc -b` e `npm run build` ok
- [ ] In dashboard → Notifiche: comporre una campagna con filtri sesso/età e coupon, inviarla, vedere il numero di destinatari

## Cosa NON è in questo incremento (arriva in 3c)

- Auguri di compleanno automatici (Cloud Function schedulata) + configurazione
- Anteprima elenco destinatari prima dell'invio (ora si vede solo il conteggio dopo l'invio)
- Chunking email oltre 500 destinatari (limite batch Firestore) — non necessario ora
