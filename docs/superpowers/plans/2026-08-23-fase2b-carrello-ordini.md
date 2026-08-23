# Fase 2b — Carrello + Ordini — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il cliente aggiunge prodotti al carrello e invia un ordine (ritiro e pagamento in salone); il salone vede gli ordini in dashboard e li gestisce con stati (`in_attesa → pronto → ritirato`, `annullato`); il cliente riceve una notifica quando l'ordine è `pronto`.

**Architecture:** Riusa i pattern delle prenotazioni. L'ordine si crea **solo lato server** con la Cloud Function `createOrder` (rilegge i prezzi autorevoli dei prodotti, calcola il totale, salva gli item come snapshot). Un trigger `notifyOrderStatus` (sul modello di `notifyBookingStatus`) notifica il cliente al passaggio a `pronto`/`annullato`. Repository `order-repo` per cliente e salone. Il carrello è stato client-side (context React). Regole Firestore per `orders` come per `bookings` (create solo via function, update limitato allo `stato` con transizioni valide).

**Tech Stack:** Firebase Firestore + Cloud Functions (v2, `firebase-admin`), FCM, React, React Router, Vitest (jsdom) + Testing Library.

**Convenzioni preesistenti:** `useAuth()` → `{loading,user,role,salonId}`; `formatEuro` in `src/domain/money.ts`; `listSalons()`/`SalonWithId` in `salon-repo`; `product-repo` con `ProductWithId`; funzioni callable esposte in `functions/src/index.ts`; pattern notifiche in `notifyBookingStatus.ts`; test `test` (puri/jsdom) e `test:emu` (`*.emu.test.ts(x)`; se "port taken": `pkill -f firebase; pkill -f cloud-firestore-emulator; sleep 3`).

---

## Struttura file (Fase 2b)

- Modify: `src/domain/models.ts` (tipi `OrderStatus`, `OrderItem`, `Order`)
- Create: `functions/src/createOrder.ts`, `functions/src/notifyOrderStatus.ts`; Modify `functions/src/index.ts`
- Modify: `firestore.rules` (blocco `orders`) + `src/firebase/rules.emu.test.ts`
- Create: `src/firebase/order.ts` (cliente: createOrder callable, listMyOrders, cancelOrder) + `order.emu.test.ts`
- Create: `src/firebase/order-repo.ts` (salone: listSalonOrders, updateOrderStatus) + `order-repo.emu.test.ts`
- Create: `src/app/cart-context.tsx` (+ `cart-context.test.tsx`)
- Modify: `src/pages/CatalogPage.tsx` (bottoni "Aggiungi al carrello") + `CatalogPage.test.tsx`
- Create: `src/pages/CartPage.tsx` (+ `CartPage.test.tsx`), `src/pages/MyOrdersPage.tsx` (+ `MyOrdersPage.test.tsx`), `src/pages/OrdersPage.tsx` (dashboard) (+ `OrdersPage.test.tsx`)
- Modify: `src/App.tsx` (rotte + CartProvider), `src/app/DashboardLayout.tsx` (voce Ordini)

---

### Task 1: Tipi Order

**Files:**
- Modify: `src/domain/models.ts`

- [ ] **Step 1: Aggiungi i tipi**

In `src/domain/models.ts`, aggiungi:
```ts
export type OrderStatus = "in_attesa" | "pronto" | "ritirato" | "annullato";

/** Riga d'ordine: snapshot immutabile del prodotto al momento dell'ordine. */
export interface OrderItem {
  productId: string;
  titolo: string;
  /** Prezzo unitario in centesimi, congelato al momento dell'ordine. */
  prezzo: number;
  qta: number;
}

/** Documento in `salons/{salonId}/orders/{id}`. */
export interface Order {
  clientId: string;
  clientNome?: string;
  clientEmail?: string;
  items: OrderItem[];
  /** Totale in centesimi, calcolato dal server. */
  totale: number;
  stato: OrderStatus;
}
```

- [ ] **Step 2: Verifica**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/domain/models.ts
git commit -m "feat(2b): tipi Order (OrderItem, Order, OrderStatus)"
```

---

### Task 2: Cloud Function `createOrder`

**Files:**
- Create: `functions/src/createOrder.ts`
- Modify: `functions/src/index.ts`
- Test: `src/firebase/createOrder.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/createOrder.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { getDoc, doc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { signOut } from "firebase/auth";
import { auth, db, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

const call = () =>
  httpsCallable<
    { salonId: string; items: { productId: string; qta: number }[] },
    { orderId: string; totale: number; stato: string }
  >(functions, "createOrder");

async function salonWithProducts() {
  const email = `own_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  const { salonId } = await registerOwner({
    email, password: "password123", nomeSalone: "S",
    timezone: "Europe/Rome", orariApertura: {},
  });
  const p1 = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true });
  const p2 = await createProduct(salonId, { titolo: "Shampoo", descrizione: "", prezzo: 900, attivo: true });
  const pOff = await createProduct(salonId, { titolo: "Vecchio", descrizione: "", prezzo: 500, attivo: false });
  await signOut(auth);
  return { salonId, p1, p2, pOff };
}

async function asClient() {
  const email = `cli_${Date.now()}_${Math.random().toString(36).slice(2)}@ex.com`;
  await registerClient({ email, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-01-01" });
}

describe("createOrder", () => {
  it("crea l'ordine col totale calcolato dai prezzi autorevoli", async () => {
    const { salonId, p1, p2 } = await salonWithProducts();
    await asClient();
    const res = await call()({ salonId, items: [{ productId: p1, qta: 2 }, { productId: p2, qta: 1 }] });
    expect(res.data.totale).toBe(1500 * 2 + 900); // 3900
    expect(res.data.stato).toBe("in_attesa");

    const snap = await getDoc(doc(db, "salons", salonId, "orders", res.data.orderId));
    expect(snap.data()?.items).toHaveLength(2);
    expect(snap.data()?.clientId).toBe(auth.currentUser!.uid);
  });

  it("rifiuta un carrello vuoto", async () => {
    const { salonId } = await salonWithProducts();
    await asClient();
    await expect(call()({ salonId, items: [] })).rejects.toThrow();
  });

  it("rifiuta un prodotto inattivo", async () => {
    const { salonId, pOff } = await salonWithProducts();
    await asClient();
    await expect(call()({ salonId, items: [{ productId: pOff, qta: 1 }] })).rejects.toThrow();
  });

  it("rifiuta un non-cliente (owner)", async () => {
    const email = `own2_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "S2", timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "X", descrizione: "", prezzo: 100, attivo: true });
    // ancora loggato come owner
    await expect(call()({ salonId, items: [{ productId: p, qta: 1 }] })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL — la callable `createOrder` non esiste.

- [ ] **Step 3: Implementa la function**

Create `functions/src/createOrder.ts`:
```ts
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

interface CreateOrderItem {
  productId: string;
  qta: number;
}
interface CreateOrderData {
  salonId: string;
  items: CreateOrderItem[];
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value;
}

export const createOrder = onCall<CreateOrderData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");

  const salonId = requireId(request.data?.salonId, "salonId");
  const items = request.data?.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpsError("invalid-argument", "Il carrello è vuoto.");
  }
  for (const item of items) {
    requireId(item?.productId, "productId");
    if (!Number.isInteger(item?.qta) || item.qta <= 0) {
      throw new HttpsError("invalid-argument", "Quantità non valida.");
    }
  }

  const db = getFirestore();
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists || userSnap.data()?.ruolo !== "cliente") {
    throw new HttpsError("permission-denied", "Solo un cliente può ordinare.");
  }
  const user = userSnap.data() as { nome?: string; email?: string };

  const snapshotItems: {
    productId: string; titolo: string; prezzo: number; qta: number;
  }[] = [];
  let totale = 0;
  for (const item of items) {
    const prodSnap = await db.doc(`salons/${salonId}/products/${item.productId}`).get();
    const prod = prodSnap.data() as { titolo?: string; prezzo?: number; attivo?: boolean } | undefined;
    if (!prodSnap.exists || prod?.attivo !== true) {
      throw new HttpsError("failed-precondition", "Prodotto non disponibile.");
    }
    if (!Number.isInteger(prod.prezzo) || (prod.prezzo as number) < 0) {
      throw new HttpsError("failed-precondition", "Prezzo prodotto non valido.");
    }
    snapshotItems.push({
      productId: item.productId,
      titolo: prod.titolo ?? "Prodotto",
      prezzo: prod.prezzo as number,
      qta: item.qta,
    });
    totale += (prod.prezzo as number) * item.qta;
  }

  const orderRef = db.collection(`salons/${salonId}/orders`).doc();
  await orderRef.set({
    clientId: uid,
    clientNome: user.nome?.trim() || "Cliente",
    clientEmail: user.email ?? null,
    items: snapshotItems,
    totale,
    stato: "in_attesa",
    createdAt: FieldValue.serverTimestamp(),
  });

  return { orderId: orderRef.id, totale, stato: "in_attesa" as const };
});
```

In `functions/src/index.ts`, aggiungi:
```ts
export { createOrder } from "./createOrder.js";
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add functions/src/createOrder.ts functions/src/index.ts src/firebase/createOrder.emu.test.ts
git commit -m "feat(2b): Cloud Function createOrder (totale server-autorevole, snapshot item)"
```

---

### Task 3: Cloud Function `notifyOrderStatus`

**Files:**
- Create: `functions/src/notifyOrderStatus.ts`
- Modify: `functions/src/index.ts`
- Test: `src/firebase/notifyOrder.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/notifyOrder.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { httpsCallable } from "firebase/functions";
import { getDoc, doc, updateDoc } from "firebase/firestore";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db, functions, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("notifyOrderStatus", () => {
  it("crea una notifica quando l'ordine diventa 'pronto'", async () => {
    // salone + prodotto
    const email = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "S", timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true });
    await signOut(auth);

    // cliente crea l'ordine
    const cliEmail = `cli_${Date.now()}@ex.com`;
    await registerClient({ email: cliEmail, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-01-01" });
    const call = httpsCallable<{ salonId: string; items: { productId: string; qta: number }[] }, { orderId: string }>(functions, "createOrder");
    const res = await call({ salonId, items: [{ productId: p, qta: 1 }] });
    const orderId = res.data.orderId;
    await signOut(auth);

    // lo staff (owner) marca 'pronto' — consentito dalle regole ordini (Task 4)
    await signInWithEmailAndPassword(auth, email, "password123");
    await updateDoc(doc(db, "salons", salonId, "orders", orderId), { stato: "pronto" });

    // il trigger crea salons/{salonId}/notifications/{orderId}_pronto (con attesa)
    const notifId = `${orderId}_pronto`;
    const notifRef = doc(db, "salons", salonId, "notifications", notifId);
    await expect
      .poll(async () => (await getDoc(notifRef)).exists(), { timeout: 8000, interval: 300 })
      .toBe(true);
    const data = (await getDoc(notifRef)).data();
    expect(data?.stato).toBe("pronto");
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npm run test:emu`
Expected: FAIL — nessun trigger crea la notifica (timeout del `poll`).

- [ ] **Step 3: Implementa il trigger**

Create `functions/src/notifyOrderStatus.ts`:
```ts
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

if (getApps().length === 0) initializeApp();

type NotifiableStatus = "pronto" | "annullato";

function isNotifiableStatus(value: unknown): value is NotifiableStatus {
  return value === "pronto" || value === "annullato";
}

function messageFor(status: NotifiableStatus) {
  if (status === "pronto") {
    return {
      title: "Ordine pronto per il ritiro",
      body: "Il tuo ordine è pronto: passa in salone a ritirarlo e pagarlo.",
    };
  }
  return {
    title: "Ordine annullato",
    body: "Il tuo ordine è stato annullato.",
  };
}

export const notifyOrderStatus = onDocumentUpdated(
  "salons/{salonId}/orders/{orderId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const salonId = event.params.salonId;
    const orderId = event.params.orderId;
    if (!before || !after || before.stato === after.stato || !isNotifiableStatus(after.stato)) {
      return;
    }

    const db = getFirestore();
    const profile = await db.doc(`users/${after.clientId}`).get();
    const profileData = profile.data() ?? {};
    const email =
      (typeof after.clientEmail === "string" && after.clientEmail) ||
      (typeof profileData.email === "string" && profileData.email) ||
      null;
    const tokens = Array.isArray(profileData.fcmTokens)
      ? profileData.fcmTokens.filter(
          (token: unknown): token is string => typeof token === "string" && token.length > 0,
        )
      : [];
    const copy = messageFor(after.stato);
    const notificationId = `${orderId}_${after.stato}`;
    const notificationRef = db.doc(`salons/${salonId}/notifications/${notificationId}`);
    const mailRef = db.doc(`mail/${salonId}_${notificationId}`);

    const created = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(notificationRef);
      if (existing.exists) return false;
      transaction.create(notificationRef, {
        orderId,
        clientId: after.clientId,
        clientNome: after.clientNome ?? "Cliente",
        stato: after.stato,
        title: copy.title,
        body: copy.body,
        channels: {
          email: { status: email ? "queued" : "unavailable" },
          push: { status: tokens.length > 0 ? "queued" : "unavailable" },
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      if (email) {
        transaction.set(mailRef, {
          to: email,
          message: { subject: copy.title, text: copy.body },
          orderId,
          salonId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return true;
    });

    if (!created || tokens.length === 0) return;
    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens,
        notification: copy,
        data: { salonId, orderId, stato: after.stato },
      });
      await notificationRef.update({
        "channels.push.status": response.failureCount === 0 ? "sent" : "partial",
        "channels.push.successCount": response.successCount,
        "channels.push.failureCount": response.failureCount,
      });
    } catch (error) {
      await notificationRef.update({
        "channels.push.status": "failed",
        "channels.push.error": error instanceof Error ? error.message : "Errore push sconosciuto",
      });
    }
  },
);
```

In `functions/src/index.ts`, aggiungi:
```ts
export { notifyOrderStatus } from "./notifyOrderStatus.js";
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS. (Nota: il test aggiorna lo stato come owner autenticato; la regola di update ordini del Task 4 consente allo staff `in_attesa→pronto`. Se esegui questo task prima del Task 4, l'update fallirebbe: esegui il Task 4 subito dopo, oppure temporaneamente verifica solo che la function esista. Ordine consigliato: implementa Task 4 subito dopo Task 3 e rilancia.)

- [ ] **Step 5: Commit**

```bash
git add functions/src/notifyOrderStatus.ts functions/src/index.ts src/firebase/notifyOrder.emu.test.ts
git commit -m "feat(2b): trigger notifyOrderStatus (notifica pronto/annullato)"
```

---

### Task 4: Security Rules per gli ordini

**Files:**
- Modify: `firestore.rules`
- Test: `src/firebase/rules.emu.test.ts`

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/firebase/rules.emu.test.ts`, aggiungi un blocco `describe("ordini", ...)` (riusa gli helper `client(uid)`, `anon()` e seed esistenti; segui il pattern del blocco `describe("prenotazioni", ...)`). Semina un ordine `salons/salonA/orders/o1` del cliente `cli1` con `withSecurityRulesDisabled`, poi:
```ts
describe("ordini", () => {
  beforeEach(async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "salons/salonA/orders/o1"), {
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
    await assertFails(
      setDoc(doc(client("cli1"), "salons/salonA/orders/o1"),
        { clientId: "cli1", items: [], totale: 999, stato: "annullato" })
    );
  });
  it("staff di un altro salone non legge gli ordini di salonA", async () => {
    await assertFails(getDoc(doc(client("staffB"), "salons/salonA/orders/o1")));
  });
});
```
(Se `staffB` non è tra i seed del file, aggiungilo nel seed `beforeEach` principale come utente staff di `salonB`, oppure usa un uid staff già seminato per salonB; segui i seed esistenti.)

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npm run test:emu`
Expected: FAIL — nessun match `orders` ⇒ letture/scritture negate; i vari `assertSucceeds` falliscono.

- [ ] **Step 3: Aggiungi le regole ordini**

In `firestore.rules`, dentro `match /salons/{salonId}`, accanto a `bookings`, aggiungi:
```
      match /orders/{orderId} {
        allow read: if isSignedIn()
          && (resource.data.clientId == request.auth.uid || isStaffOf(salonId));
        // Le creazioni passano dalla Cloud Function createOrder.
        allow create: if false;
        allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['stato'])
          && ((isStaffOf(salonId)
               && ((resource.data.stato == 'in_attesa'
                    && request.resource.data.stato in ['pronto', 'annullato'])
                   || (resource.data.stato == 'pronto'
                       && request.resource.data.stato in ['ritirato', 'annullato'])))
              || (isSignedIn()
                  && resource.data.clientId == request.auth.uid
                  && resource.data.stato == 'in_attesa'
                  && request.resource.data.stato == 'annullato'));
        allow delete: if false;
      }
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npm run test:emu`
Expected: PASS (rules ordini + `notifyOrder.emu.test.ts` del Task 3 ora verdi).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/firebase/rules.emu.test.ts
git commit -m "feat(2b): Security Rules ordini (create via function, transizioni stato)"
```

---

### Task 5: Repository ordini (`order.ts` cliente, `order-repo.ts` salone)

**Files:**
- Create: `src/firebase/order.ts`, `src/firebase/order-repo.ts`
- Test: `src/firebase/order-repo.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/order-repo.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct } from "./product-repo";
import { createOrder, listMyOrders } from "./order";
import { listSalonOrders, updateOrderStatus } from "./order-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("order repos", () => {
  it("cliente crea e vede il proprio ordine; salone lo elenca e ne cambia stato", async () => {
    const ownerEmail = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email: ownerEmail, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const p = await createProduct(salonId, { titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true });
    await signOut(auth);

    // cliente
    const cliEmail = `cli_${Date.now()}@ex.com`;
    await registerClient({ email: cliEmail, password: "password123", nome: "Cli", sesso: "maschile", dataNascita: "1990-01-01" });
    const { orderId } = await createOrder({ salonId, items: [{ productId: p, qta: 2 }] });
    const mine = await listMyOrders(salonId);
    expect(mine).toHaveLength(1);
    expect(mine[0].totale).toBe(3000);
    await signOut(auth);

    // salone
    await signInWithEmailAndPassword(auth, ownerEmail, "password123");
    const salonOrders = await listSalonOrders(salonId);
    expect(salonOrders.some((o) => o.id === orderId)).toBe(true);
    await updateOrderStatus(salonId, orderId, "pronto");
    const after = await listSalonOrders(salonId);
    expect(after.find((o) => o.id === orderId)?.stato).toBe("pronto");
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npm run test:emu`
Expected: FAIL — moduli `./order` / `./order-repo` non trovati.

- [ ] **Step 3: Implementazione**

Create `src/firebase/order.ts`:
```ts
import { httpsCallable } from "firebase/functions";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { auth, db, functions } from "./app";
import type { Order } from "../domain/models";

export type OrderWithId = Order & { id: string };

export interface CreateOrderInput {
  salonId: string;
  items: { productId: string; qta: number }[];
}
export interface CreateOrderResult {
  orderId: string;
  totale: number;
  stato: "in_attesa";
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const callable = httpsCallable<CreateOrderInput, CreateOrderResult>(functions, "createOrder");
  const res = await callable(input);
  return res.data;
}

export async function listMyOrders(salonId: string): Promise<OrderWithId[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utente non autenticato.");
  const snap = await getDocs(
    query(collection(db, "salons", salonId, "orders"), where("clientId", "==", uid)),
  );
  return snap.docs.map((o) => ({ id: o.id, ...(o.data() as Order) }));
}

export async function cancelOrder(salonId: string, orderId: string): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "orders", orderId), { stato: "annullato" });
}
```

Create `src/firebase/order-repo.ts`:
```ts
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { db } from "./app";
import type { Order, OrderStatus } from "../domain/models";

export type OrderWithId = Order & { id: string };

const statusOrder: Record<OrderStatus, number> = {
  in_attesa: 0, pronto: 1, ritirato: 2, annullato: 3,
};

export async function listSalonOrders(salonId: string): Promise<OrderWithId[]> {
  const snap = await getDocs(collection(db, "salons", salonId, "orders"));
  return snap.docs
    .map((o) => ({ id: o.id, ...(o.data() as Order) }))
    .sort((a, b) => statusOrder[a.stato] - statusOrder[b.stato]);
}

export async function updateOrderStatus(
  salonId: string,
  orderId: string,
  stato: Extract<OrderStatus, "pronto" | "ritirato" | "annullato">,
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "orders", orderId), { stato });
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/order.ts src/firebase/order-repo.ts src/firebase/order-repo.emu.test.ts
git commit -m "feat(2b): repository ordini (cliente + salone)"
```

---

### Task 6: Carrello (`cart-context`)

**Files:**
- Create: `src/app/cart-context.tsx`
- Test: `src/app/cart-context.test.tsx`

- [ ] **Step 1: Scrivi il test che fallisce**

Create `src/app/cart-context.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CartProvider, useCart } from "./cart-context";
import type { ProductWithId } from "../firebase/product-repo";

const cera: ProductWithId = { id: "p1", titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true };

function Harness() {
  const cart = useCart();
  return (
    <div>
      <span data-testid="count">{cart.items.length}</span>
      <span data-testid="total">{cart.totale}</span>
      <button onClick={() => cart.add("s1", cera)}>add</button>
      <button onClick={() => cart.clear()}>clear</button>
    </div>
  );
}

describe("cart-context", () => {
  it("aggiunge, incrementa la quantità e calcola il totale", async () => {
    render(<CartProvider><Harness /></CartProvider>);
    await userEvent.click(screen.getByText("add"));
    await userEvent.click(screen.getByText("add"));
    expect(screen.getByTestId("count").textContent).toBe("1"); // stessa riga, qta 2
    expect(screen.getByTestId("total").textContent).toBe("3000");
    await userEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("total").textContent).toBe("0");
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/app/cart-context.test.tsx`
Expected: FAIL — modulo `./cart-context` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/app/cart-context.tsx`:
```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { ProductWithId } from "../firebase/product-repo";

export interface CartLine {
  product: ProductWithId;
  qta: number;
}

interface CartState {
  salonId: string | null;
  items: CartLine[];
  totale: number;
  add: (salonId: string, product: ProductWithId) => void;
  setQta: (productId: string, qta: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve essere usato dentro CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [salonId, setSalonId] = useState<string | null>(null);
  const [items, setItems] = useState<CartLine[]>([]);

  function add(nextSalonId: string, product: ProductWithId) {
    setItems((prev) => {
      // Il carrello è per singolo salone: cambiando salone si svuota.
      const base = nextSalonId === salonId ? prev : [];
      const existing = base.find((l) => l.product.id === product.id);
      if (existing) {
        return base.map((l) =>
          l.product.id === product.id ? { ...l, qta: l.qta + 1 } : l,
        );
      }
      return [...base, { product, qta: 1 }];
    });
    setSalonId(nextSalonId);
  }

  function setQta(productId: string, qta: number) {
    setItems((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, qta } : l))
        .filter((l) => l.qta > 0),
    );
  }

  function remove(productId: string) {
    setItems((prev) => prev.filter((l) => l.product.id !== productId));
  }

  function clear() {
    setItems([]);
    setSalonId(null);
  }

  const totale = useMemo(
    () => items.reduce((sum, l) => sum + l.product.prezzo * l.qta, 0),
    [items],
  );

  return (
    <CartContext.Provider value={{ salonId, items, totale, add, setQta, remove, clear }}>
      {children}
    </CartContext.Provider>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/app/cart-context.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/cart-context.tsx src/app/cart-context.test.tsx
git commit -m "feat(2b): carrello (cart-context)"
```

---

### Task 7: Catalogo con "Aggiungi al carrello" + `CartPage`

**Files:**
- Modify: `src/pages/CatalogPage.tsx`, `src/pages/CatalogPage.test.tsx`
- Create: `src/pages/CartPage.tsx`, `src/pages/CartPage.test.tsx`

- [ ] **Step 1: Aggiorna il test del catalogo (aggiunta al carrello)**

In `src/pages/CatalogPage.test.tsx`, aggiungi un test che verifica il pulsante di aggiunta. Avvolgi il render in `CartProvider` e verifica che dopo il click il prodotto sia nel carrello tramite una piccola sonda. Aggiungi in cima agli import:
```tsx
import { CartProvider, useCart } from "../app/cart-context";
```
e un test:
```tsx
it("aggiunge un prodotto al carrello", async () => {
  const { default: userEvent } = await import("@testing-library/user-event");
  vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
    { id: "s1", nome: "Salone Uno", timezone: "Europe/Rome", orariApertura: {},
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" } },
  ]);
  vi.spyOn(productRepo, "listProducts").mockResolvedValue([
    { id: "p1", titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true },
  ]);
  function Count() { return <span data-testid="n">{useCart().items.length}</span>; }
  render(
    <MemoryRouter>
      <CartProvider>
        <CatalogPage />
        <Count />
      </CartProvider>
    </MemoryRouter>
  );
  await userEvent.click(await screen.findByRole("button", { name: /aggiungi al carrello/i }));
  expect(screen.getByTestId("n").textContent).toBe("1");
});
```
Il test esistente ("mostra i prodotti attivi…") va anch'esso avvolto in `<CartProvider>` (perché `CatalogPage` ora usa `useCart`). Aggiorna quel render:
```tsx
render(<MemoryRouter><CartProvider><CatalogPage /></CartProvider></MemoryRouter>);
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/CatalogPage.test.tsx`
Expected: FAIL — `CatalogPage` non ha ancora il pulsante / non usa `useCart`.

- [ ] **Step 3: Aggiorna `CatalogPage` + crea `CartPage`**

In `src/pages/CatalogPage.tsx`: importa `useCart` e, dentro ogni card prodotto, aggiungi un pulsante. Aggiungi import:
```tsx
import { Link } from "react-router-dom"; // già presente
import { useCart } from "../app/cart-context";
```
Dentro il componente, all'inizio: `const cart = useCart();`. Nella card prodotto, dopo il prezzo, aggiungi:
```tsx
            <button
              className="customer-button"
              onClick={() => cart.add(salonId, p)}
            >
              Aggiungi al carrello
            </button>
```
E in `customer-shell__header`, accanto al link "Prenota", aggiungi un link al carrello:
```tsx
        <Link className="customer-button" to="/carrello">Carrello ({cart.items.length})</Link>
```

Create `src/pages/CartPage.tsx`:
```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../app/cart-context";
import { createOrder } from "../firebase/order";
import { formatEuro } from "../domain/money";
import "./customer.css";

export function CartPage() {
  const navigate = useNavigate();
  const { salonId, items, totale, setQta, remove, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCheckout() {
    if (!salonId || items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createOrder({
        salonId,
        items: items.map((l) => ({ productId: l.product.id, qta: l.qta })),
      });
      clear();
      navigate("/i-miei-ordini");
    } catch {
      setError("Invio dell'ordine non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="customer-shell customer-shell--narrow">
      <span className="customer-shell__eyebrow">Carrello</span>
      <h1>Il tuo ordine</h1>
      {items.length === 0 && <p className="customer-booking__meta">Il carrello è vuoto.</p>}
      {items.map((l) => (
        <div className="customer-booking" key={l.product.id}>
          <span><strong>{l.product.titolo}</strong> · € {formatEuro(l.product.prezzo)}</span>
          <span className="row">
            <input
              aria-label={`Quantità ${l.product.titolo}`}
              type="number" min="1" value={l.qta}
              onChange={(e) => setQta(l.product.id, parseInt(e.target.value || "1", 10))}
              style={{ width: 64 }}
            />
            <button className="customer-button customer-button--secondary" onClick={() => remove(l.product.id)}>Rimuovi</button>
          </span>
        </div>
      ))}
      {items.length > 0 && (
        <>
          <p style={{ marginTop: 16 }}><strong>Totale: € {formatEuro(totale)}</strong></p>
          {error && <p className="customer-error" role="alert">{error}</p>}
          <button className="customer-button" onClick={onCheckout} disabled={busy}>
            {busy ? "Invio…" : "Invia ordine (paghi in salone)"}
          </button>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/CatalogPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CatalogPage.tsx src/pages/CatalogPage.test.tsx src/pages/CartPage.tsx
git commit -m "feat(2b): aggiunta al carrello + CartPage (checkout)"
```

---

### Task 8: `MyOrdersPage` (cliente)

**Files:**
- Create: `src/pages/MyOrdersPage.tsx`, `src/pages/MyOrdersPage.test.tsx`

- [ ] **Step 1: Scrivi il test che fallisce**

Create `src/pages/MyOrdersPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MyOrdersPage } from "./MyOrdersPage";
import * as salonRepo from "../firebase/salon-repo";
import * as orderApi from "../firebase/order";

beforeEach(() => vi.restoreAllMocks());

describe("MyOrdersPage", () => {
  it("elenca gli ordini del cliente per il salone selezionato", async () => {
    vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
      { id: "s1", nome: "Salone Uno", timezone: "Europe/Rome", orariApertura: {},
        impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" } },
    ]);
    vi.spyOn(orderApi, "listMyOrders").mockResolvedValue([
      { id: "o1", clientId: "c", items: [{ productId: "p1", titolo: "Cera", prezzo: 1500, qta: 2 }], totale: 3000, stato: "pronto" },
    ]);
    render(<MyOrdersPage />);
    expect(await screen.findByText(/Cera/)).toBeInTheDocument();
    expect(screen.getByText(/pronto/i)).toBeInTheDocument();
    expect(screen.getByText(/30,00/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/MyOrdersPage.test.tsx`
Expected: FAIL — modulo `./MyOrdersPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/MyOrdersPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { listSalons, type SalonWithId } from "../firebase/salon-repo";
import { listMyOrders, cancelOrder, type OrderWithId } from "../firebase/order";
import { formatEuro } from "../domain/money";
import "./customer.css";

export function MyOrdersPage() {
  const [salons, setSalons] = useState<SalonWithId[]>([]);
  const [salonId, setSalonId] = useState("");
  const [orders, setOrders] = useState<OrderWithId[]>([]);

  useEffect(() => {
    void listSalons().then((s) => {
      setSalons(s);
      if (s.length > 0) setSalonId((cur) => cur || s[0].id);
    });
  }, []);

  async function reload(id: string) {
    setOrders(await listMyOrders(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onCancel(id: string) {
    if (!salonId) return;
    await cancelOrder(salonId, id);
    await reload(salonId);
  }

  return (
    <main className="customer-shell">
      <span className="customer-shell__eyebrow">I miei ordini</span>
      <h1>Ordini</h1>
      <div className="booking-field">
        <label htmlFor="mo-salon">Salone</label>
        <select id="mo-salon" value={salonId} onChange={(e) => setSalonId(e.target.value)}>
          {salons.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      {orders.length === 0 && <p className="customer-booking__meta">Nessun ordine.</p>}
      {orders.map((o) => (
        <div className="customer-booking" key={o.id}>
          <span>
            <strong>{o.items.map((i) => `${i.titolo} ×${i.qta}`).join(", ")}</strong>
            <br />
            <span className="customer-booking__meta">Stato: {o.stato} · € {formatEuro(o.totale)}</span>
          </span>
          {o.stato === "in_attesa" && (
            <button className="customer-button customer-button--secondary" onClick={() => onCancel(o.id)}>Annulla</button>
          )}
        </div>
      ))}
    </main>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/MyOrdersPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/MyOrdersPage.tsx src/pages/MyOrdersPage.test.tsx
git commit -m "feat(2b): MyOrdersPage (ordini del cliente)"
```

---

### Task 9: `OrdersPage` (dashboard) + wiring rotte/menu

**Files:**
- Create: `src/pages/OrdersPage.tsx`, `src/pages/OrdersPage.test.tsx`
- Modify: `src/App.tsx`, `src/app/DashboardLayout.tsx`

- [ ] **Step 1: Scrivi il test che fallisce**

Create `src/pages/OrdersPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrdersPage } from "./OrdersPage";
import * as repo from "../firebase/order-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("OrdersPage", () => {
  it("elenca gli ordini e marca 'pronto'", async () => {
    vi.spyOn(repo, "listSalonOrders").mockResolvedValue([
      { id: "o1", clientId: "c", clientNome: "Mario", items: [{ productId: "p1", titolo: "Cera", prezzo: 1500, qta: 2 }], totale: 3000, stato: "in_attesa" },
    ]);
    const upd = vi.spyOn(repo, "updateOrderStatus").mockResolvedValue();
    render(<OrdersPage />);
    expect(await screen.findByText(/Mario/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /pronto/i }));
    await waitFor(() => expect(upd).toHaveBeenCalledWith("s1", "o1", "pronto"));
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/OrdersPage.test.tsx`
Expected: FAIL — modulo `./OrdersPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/OrdersPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { useAuth } from "../app/auth-context";
import { listSalonOrders, updateOrderStatus, type OrderWithId } from "../firebase/order-repo";
import { formatEuro } from "../domain/money";

export function OrdersPage() {
  const { salonId } = useAuth();
  const [orders, setOrders] = useState<OrderWithId[]>([]);

  async function reload(id: string) {
    setOrders(await listSalonOrders(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function setStatus(id: string, stato: "pronto" | "ritirato" | "annullato") {
    if (!salonId) return;
    await updateOrderStatus(salonId, id, stato);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Ordini</h2>
      {orders.length === 0 && <p style={{ color: "var(--muted)" }}>Nessun ordine.</p>}
      {orders.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              <strong>{o.clientNome ?? "Cliente"}</strong> · € {formatEuro(o.totale)} · <em>{o.stato}</em>
              <br />
              <span style={{ color: "var(--muted)" }}>
                {o.items.map((i) => `${i.titolo} ×${i.qta}`).join(", ")}
              </span>
            </span>
            <span className="row">
              {o.stato === "in_attesa" && (
                <button className="btn" onClick={() => setStatus(o.id, "pronto")}>Pronto</button>
              )}
              {o.stato === "pronto" && (
                <button className="btn" onClick={() => setStatus(o.id, "ritirato")}>Ritirato</button>
              )}
              {(o.stato === "in_attesa" || o.stato === "pronto") && (
                <button className="btn btn--danger" onClick={() => setStatus(o.id, "annullato")}>Annulla</button>
              )}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/OrdersPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wiring rotte + menu + CartProvider**

In `src/App.tsx`:
- import: `import { CartProvider } from "./app/cart-context";`, `import { CatalogPage } from "./pages/CatalogPage";` (già presente), `import { CartPage } from "./pages/CartPage";`, `import { MyOrdersPage } from "./pages/MyOrdersPage";`, `import { OrdersPage } from "./pages/OrdersPage";`
- Avvolgi le rotte dentro `<CartProvider>` (dentro `AuthProvider`/`BrowserRouter`).
- Aggiungi rotte cliente (protette da `RequireClient`): `/carrello` → `CartPage`, `/i-miei-ordini` → `MyOrdersPage`. (`/catalogo` esiste già.)
- Aggiungi nella dashboard: `<Route path="ordini" element={<OrdersPage />} />`.

In `src/app/DashboardLayout.tsx`, aggiungi a `SECTIONS` (dopo "Prodotti"):
```ts
  { to: "/dashboard/ordini", label: "Ordini" },
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
git add src/pages/OrdersPage.tsx src/pages/OrdersPage.test.tsx src/App.tsx src/app/DashboardLayout.tsx
git commit -m "feat(2b): OrdersPage (dashboard) + rotte carrello/ordini + CartProvider"
```

---

## Verifica di completamento Fase 2b

- [ ] `npm run test` → puri/componente verdi
- [ ] `npm run test:emu` → emulatore verdi (createOrder, notifyOrderStatus, rules ordini, repo ordini)
- [ ] `npx tsc -b` e `npm run build` ok
- [ ] Flusso: cliente sfoglia catalogo → aggiunge al carrello → invia ordine → il salone lo vede in "Ordini" → marca "pronto" (il cliente riceve notifica) → "ritirato"

## Cosa NON è in questo incremento

- Pagamento online (Stripe) → 2c
- Persistenza del carrello (localStorage) → eventuale rifinitura successiva
- Notifica su `confermata→annullata` per gli ordini già pronti gestita come `annullato` (già coperta)
