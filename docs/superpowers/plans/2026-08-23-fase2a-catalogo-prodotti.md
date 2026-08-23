# Fase 2a — Catalogo prodotti + Cloud Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Il salone gestisce un catalogo prodotti (titolo, descrizione, prezzo, foto opzionale, attivo) con foto su Cloud Storage; il cliente sfoglia i prodotti attivi di un salone.

**Architecture:** Riusa i pattern esistenti: repository sottile `product-repo` (CRUD Firestore + upload foto su Cloud Storage), pagine React che usano `useAuth().salonId`, Security Rules multi-tenant. Le foto vivono in Cloud Storage sotto `salons/{salonId}/products/...`, protette da Storage rules che leggono il ruolo dell'utente da Firestore. Tutto testabile sull'emulatore Firebase (Firestore + Auth + Functions + **Storage**).

**Tech Stack:** Firebase Firestore + Cloud Storage, React, React Router, Vitest (jsdom) + Testing Library.

**Convenzioni preesistenti:** `useAuth()` → `{loading,user,role,salonId}`; repos in `src/firebase/`; prezzi in centesimi; `listSalons()`/`SalonWithId` già in `salon-repo`; test `test` (puri/jsdom) e `test:emu` (`*.emu.test.ts(x)`, avvia emulatori; Firestore su 8085, Homebrew OpenJDK su PATH). Rotte cliente: `/prenota`, `/area`; rotte dashboard sotto `/dashboard` (guardia `RequireOwner`), cliente sotto `RequireClient`.

---

## Struttura file (Fase 2a)

- Modify: `firebase.json` (storage + emulatore storage), `storage.rules` (create), `src/firebase/app.ts` (export `storage` + emulatore), `package.json` (script emu con `storage`)
- Modify: `src/domain/models.ts` (tipo `Product`)
- Create: `src/firebase/product-repo.ts` (+ `product-repo.emu.test.ts`)
- Modify: `firestore.rules` (regole `products`) + `src/firebase/rules.emu.test.ts` (test isolamento prodotti)
- Create: `src/pages/ProductsPage.tsx` (+ `ProductsPage.test.tsx`); Modify `src/App.tsx` (rotta), `src/app/DashboardLayout.tsx` (voce Prodotti)
- Create: `src/pages/CatalogPage.tsx` (+ `CatalogPage.test.tsx`); Modify `src/App.tsx` (rotta cliente)

---

### Task 1: Cloud Storage — config, rules, init, emulatore

**Files:**
- Modify: `firebase.json`, `src/firebase/app.ts`, `package.json`
- Create: `storage.rules`

- [ ] **Step 1: Aggiungi Storage a `firebase.json`**

Aggiungi la sezione `"storage"` e l'emulatore `storage` (porta 9199). Risultato:
```json
{
  "firestore": { "rules": "firestore.rules" },
  "functions": { "source": "functions" },
  "storage": { "rules": "storage.rules" },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [{ "source": "**", "destination": "/index.html" }]
  },
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8085 },
    "functions": { "port": 5001 },
    "storage": { "port": 9199 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 2: Crea `storage.rules`**

Create `storage.rules`:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isSignedIn() {
      return request.auth != null;
    }
    function isStaffOf(salonId) {
      return isSignedIn()
        && firestore.exists(/databases/(default)/documents/users/$(request.auth.uid))
        && firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.salonId == salonId
        && firestore.get(/databases/(default)/documents/users/$(request.auth.uid)).data.ruolo in ['owner', 'staff'];
    }

    match /salons/{salonId}/products/{allPaths=**} {
      allow read: if isSignedIn();
      allow write: if isStaffOf(salonId)
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }

    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: Esporta `storage` e aggancia l'emulatore in `src/firebase/app.ts`**

Aggiungi import:
```ts
import { getStorage, connectStorageEmulator, type FirebaseStorage } from "firebase/storage";
```
Aggiungi `storageBucket` alla `config` (serve a `getStorage`):
```ts
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET ?? "demo-barbershop.appspot.com",
```
Dopo `export const functions`:
```ts
export const storage: FirebaseStorage = getStorage(app);
```
Dentro `connectEmulators`, dopo l'aggancio functions:
```ts
  connectStorageEmulator(storage, host, 9199);
```

- [ ] **Step 4: Aggiungi `storage` agli script emulatore in `package.json`**

Aggiorna i due script includendo `storage`:
```json
"emu:start": "PATH=\"/opt/homebrew/opt/openjdk/bin:$PATH\" firebase emulators:start --only auth,firestore,functions,storage --project demo-barbershop",
"test:emu": "npm --prefix functions run build && PATH=\"/opt/homebrew/opt/openjdk/bin:$PATH\" firebase emulators:exec --only auth,firestore,functions,storage --project demo-barbershop \"vitest run --config vitest.emu.config.ts\""
```

- [ ] **Step 5: Verifica che l'emulatore Storage parta**

Run:
```bash
cd "/Users/fabio_pace/App Barber Shop"
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" firebase emulators:exec --only firestore,storage --project demo-barbershop "echo STORAGE_OK"
```
Expected: output con `STORAGE_OK`, l'emulatore Storage si avvia senza errori (può scaricare il JAR la prima volta). Se fallisce per Java/porta, riporta il problema.
Poi: `npx tsc -b` → clean (app.ts compila con i nuovi import).

- [ ] **Step 6: Commit**

```bash
git add firebase.json storage.rules src/firebase/app.ts package.json
git commit -m "chore(2a): Cloud Storage — config, rules, init, emulatore"
```

---

### Task 2: Tipo `Product`

**Files:**
- Modify: `src/domain/models.ts`

- [ ] **Step 1: Aggiungi il tipo**

In `src/domain/models.ts`, aggiungi:
```ts
/** Documento in `salons/{salonId}/products/{id}`. */
export interface Product {
  titolo: string;
  descrizione: string;
  /** Prezzo in centesimi interi. */
  prezzo: number;
  /** URL scaricabile della foto (assente se senza foto). */
  fotoUrl?: string;
  /** Path in Cloud Storage della foto (per eventuale eliminazione). */
  fotoPath?: string;
  attivo: boolean;
}
```

- [ ] **Step 2: Verifica**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npx tsc -b`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/domain/models.ts
git commit -m "feat(2a): tipo Product"
```

---

### Task 3: `product-repo` (CRUD)

**Files:**
- Create: `src/firebase/product-repo.ts`
- Test: `src/firebase/product-repo.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/product-repo.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import {
  listProducts, createProduct, updateProduct, deleteProduct,
} from "./product-repo";
import type { Product } from "../domain/models";

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

const sample: Product = {
  titolo: "Cera modellante", descrizione: "Tenuta forte", prezzo: 1500, attivo: true,
};

describe("product-repo", () => {
  it("crea, elenca, aggiorna ed elimina un prodotto", async () => {
    const salonId = await newSalon();

    const id = await createProduct(salonId, sample);
    expect(id).toBeTruthy();

    let list = await listProducts(salonId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, titolo: "Cera modellante", prezzo: 1500 });

    await updateProduct(salonId, id, { prezzo: 1800, attivo: false });
    list = await listProducts(salonId);
    expect(list[0].prezzo).toBe(1800);
    expect(list[0].attivo).toBe(false);

    await deleteProduct(salonId, id);
    expect(await listProducts(salonId)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `cd "/Users/fabio_pace/App Barber Shop" && npm run test:emu`
Expected: FAIL — modulo `./product-repo` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/firebase/product-repo.ts`:
```ts
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
import type { Product } from "../domain/models";

export type ProductWithId = Product & { id: string };

const productsCol = (salonId: string) =>
  collection(db, "salons", salonId, "products");

export async function listProducts(salonId: string): Promise<ProductWithId[]> {
  const snap = await getDocs(productsCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Product) }));
}

export async function createProduct(salonId: string, data: Product): Promise<string> {
  const ref = await addDoc(productsCol(salonId), data);
  return ref.id;
}

export async function updateProduct(
  salonId: string, id: string, data: Partial<Product>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "products", id), data);
}

export async function deleteProduct(salonId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "salons", salonId, "products", id));
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/product-repo.ts src/firebase/product-repo.emu.test.ts
git commit -m "feat(2a): product-repo (CRUD prodotti)"
```

---

### Task 4: Upload foto su Cloud Storage

**Files:**
- Modify: `src/firebase/product-repo.ts`
- Test: `src/firebase/product-photo.emu.test.ts`

- [ ] **Step 1: Scrivi il test emulatore che fallisce**

Create `src/firebase/product-photo.emu.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { signOut } from "firebase/auth";
import { auth, connectEmulators } from "./app";
import { registerOwner } from "./onboarding";
import { registerClient } from "./auth";
import { createProduct, uploadProductPhoto } from "./product-repo";

beforeAll(() => connectEmulators());
afterEach(async () => { await signOut(auth); });

describe("uploadProductPhoto", () => {
  it("carica una foto e restituisce fotoUrl + fotoPath", async () => {
    const email = `own_${Date.now()}@ex.com`;
    const { salonId } = await registerOwner({
      email, password: "password123", nomeSalone: "S",
      timezone: "Europe/Rome", orariApertura: {},
    });
    const productId = await createProduct(salonId, {
      titolo: "Shampoo", descrizione: "", prezzo: 900, attivo: true,
    });

    const file = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    const res = await uploadProductPhoto(salonId, productId, file, "foto.png");

    expect(res.fotoPath).toBe(`salons/${salonId}/products/${productId}/foto.png`);
    expect(res.fotoUrl).toContain(productId);
  });

  it("un cliente (non staff) NON può caricare foto prodotto", async () => {
    await registerClient({
      email: `cli_${Date.now()}@ex.com`, password: "password123",
      nome: "Cliente", sesso: "maschile", dataNascita: "1990-01-01",
    });
    const file = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" });
    await expect(
      uploadProductPhoto("salonX", "prodX", file, "foto.png")
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npm run test:emu`
Expected: FAIL — `uploadProductPhoto` non esportata.

- [ ] **Step 3: Implementazione**

In `src/firebase/product-repo.ts`, aggiungi import in cima:
```ts
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./app";
```
e in fondo:
```ts
export interface ProductPhoto {
  fotoUrl: string;
  fotoPath: string;
}

/** Carica la foto del prodotto su Cloud Storage e ne restituisce URL e path. */
export async function uploadProductPhoto(
  salonId: string,
  productId: string,
  file: Blob,
  filename: string
): Promise<ProductPhoto> {
  const fotoPath = `salons/${salonId}/products/${productId}/${filename}`;
  const storageRef = ref(storage, fotoPath);
  await uploadBytes(storageRef, file);
  const fotoUrl = await getDownloadURL(storageRef);
  return { fotoUrl, fotoPath };
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npm run test:emu`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/firebase/product-repo.ts src/firebase/product-photo.emu.test.ts
git commit -m "feat(2a): upload foto prodotto su Cloud Storage"
```

---

### Task 5: Security Rules per i prodotti

**Files:**
- Modify: `firestore.rules`
- Test: `src/firebase/rules.emu.test.ts`

- [ ] **Step 1: Scrivi i test che falliscono**

In `src/firebase/rules.emu.test.ts`, aggiungi un nuovo blocco `describe` (usa gli helper `client(uid)`, `anon()` e i dati seed esistenti nel file — `salonA`, `salonB`, `staffA`; segui esattamente i pattern già presenti per i `services`):
```ts
describe("prodotti", () => {
  it("un utente autenticato può leggere i prodotti del salone", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "salons/salonA/products/p1"), {
        titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true,
      });
    });
    await assertSucceeds(getDoc(doc(client("cli1"), "salons/salonA/products/p1")));
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
```
(Se il file importa i simboli di firestore in cima — `doc`, `getDoc`, `setDoc` — riusali; non aggiungere import duplicati.)

- [ ] **Step 2: Esegui i test per verificare che falliscano**

Run: `npm run test:emu`
Expected: FAIL — le regole attuali non hanno un match per `products`, quindi lettura/scrittura sono negate di default: i due `assertSucceeds` (lettura cliente, scrittura staff) falliranno.

- [ ] **Step 3: Aggiungi le regole prodotti**

In `firestore.rules`, dentro `match /salons/{salonId}`, accanto ai blocchi `operators`/`services`, aggiungi:
```
      match /products/{productId} {
        allow read: if isSignedIn();
        allow write: if isStaffOf(salonId);
      }
```

- [ ] **Step 4: Esegui i test per verificare che passino**

Run: `npm run test:emu`
Expected: PASS (tutti i test rules verdi, inclusi i nuovi).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/firebase/rules.emu.test.ts
git commit -m "feat(2a): Security Rules prodotti (lettura auth, scrittura staff)"
```

---

### Task 6: `ProductsPage` (dashboard)

**Files:**
- Create: `src/pages/ProductsPage.tsx`
- Test: `src/pages/ProductsPage.test.tsx`
- Modify: `src/App.tsx`, `src/app/DashboardLayout.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/pages/ProductsPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsPage } from "./ProductsPage";
import * as repo from "../firebase/product-repo";
import * as authCtx from "../app/auth-context";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(authCtx, "useAuth").mockReturnValue({
    loading: false, user: {} as never, role: "owner", salonId: "s1",
  });
});

describe("ProductsPage", () => {
  it("elenca i prodotti esistenti", async () => {
    vi.spyOn(repo, "listProducts").mockResolvedValue([
      { id: "a", titolo: "Cera", descrizione: "", prezzo: 1500, attivo: true },
    ]);
    render(<ProductsPage />);
    expect(await screen.findByText("Cera")).toBeInTheDocument();
    expect(screen.getByText(/15,00/)).toBeInTheDocument();
  });

  it("crea un prodotto convertendo il prezzo in centesimi", async () => {
    vi.spyOn(repo, "listProducts").mockResolvedValue([]);
    const create = vi.spyOn(repo, "createProduct").mockResolvedValue("newid");
    render(<ProductsPage />);
    await userEvent.type(screen.getByLabelText("Titolo"), "Balsamo");
    await userEvent.type(screen.getByLabelText("Prezzo (€)"), "12");
    await userEvent.click(screen.getByRole("button", { name: /aggiungi prodotto/i }));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ titolo: "Balsamo", prezzo: 1200, attivo: true })
      )
    );
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/ProductsPage.test.tsx`
Expected: FAIL — modulo `./ProductsPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/ProductsPage.tsx`:
```tsx
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listProducts, createProduct, updateProduct, deleteProduct, uploadProductPhoto,
  type ProductWithId,
} from "../firebase/product-repo";

function euro(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 });
}

export function ProductsPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<ProductWithId[]>([]);
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [prezzoEuro, setPrezzoEuro] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(id: string) {
    setItems(await listProducts(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setBusy(true);
    try {
      const id = await createProduct(salonId, {
        titolo,
        descrizione,
        prezzo: Math.round(parseFloat(prezzoEuro || "0") * 100),
        attivo: true,
      });
      if (file) {
        const { fotoUrl, fotoPath } = await uploadProductPhoto(salonId, id, file, file.name);
        await updateProduct(salonId, id, { fotoUrl, fotoPath });
      }
      setTitolo(""); setDescrizione(""); setPrezzoEuro(""); setFile(null);
      await reload(salonId);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteProduct(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Prodotti</h2>
      {items.map((p) => (
        <div className="card row" key={p.id} style={{ justifyContent: "space-between" }}>
          <span className="row">
            {p.fotoUrl && (
              <img src={p.fotoUrl} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: "cover" }} />
            )}
            <span><strong>{p.titolo}</strong> · € {euro(p.prezzo)}{!p.attivo && " (non attivo)"}</span>
          </span>
          <button className="btn btn--danger" onClick={() => onDelete(p.id)}>Elimina</button>
        </div>
      ))}
      <form className="card" onSubmit={onSubmit}>
        <h3>Nuovo prodotto</h3>
        <div className="field"><label htmlFor="pt">Titolo</label>
          <input id="pt" aria-label="Titolo" value={titolo} onChange={(e) => setTitolo(e.target.value)} required /></div>
        <div className="field"><label htmlFor="pd">Descrizione</label>
          <textarea id="pd" aria-label="Descrizione" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} /></div>
        <div className="field"><label htmlFor="pp">Prezzo (€)</label>
          <input id="pp" aria-label="Prezzo (€)" type="number" min="0" step="0.01" value={prezzoEuro} onChange={(e) => setPrezzoEuro(e.target.value)} required /></div>
        <div className="field"><label htmlFor="pf">Foto (opzionale)</label>
          <input id="pf" aria-label="Foto (opzionale)" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <button className="btn" type="submit" disabled={busy}>Aggiungi prodotto</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/ProductsPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Aggancia rotta e voce di menu**

In `src/App.tsx`, aggiungi l'import `import { ProductsPage } from "./pages/ProductsPage";` e, dentro le rotte `/dashboard`, aggiungi:
```tsx
<Route path="prodotti" element={<ProductsPage />} />
```
In `src/app/DashboardLayout.tsx`, aggiungi alla lista `SECTIONS` la voce (dopo "Orari"):
```ts
  { to: "/dashboard/prodotti", label: "Prodotti" },
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/ProductsPage.tsx src/pages/ProductsPage.test.tsx src/App.tsx src/app/DashboardLayout.tsx
git commit -m "feat(2a): ProductsPage (catalogo dashboard + foto)"
```

---

### Task 7: `CatalogPage` (cliente)

**Files:**
- Create: `src/pages/CatalogPage.tsx`
- Test: `src/pages/CatalogPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Scrivi il test componente che fallisce**

Create `src/pages/CatalogPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogPage } from "./CatalogPage";
import * as salonRepo from "../firebase/salon-repo";
import * as productRepo from "../firebase/product-repo";

beforeEach(() => vi.restoreAllMocks());

describe("CatalogPage", () => {
  it("mostra i prodotti attivi del salone selezionato", async () => {
    vi.spyOn(salonRepo, "listSalons").mockResolvedValue([
      { id: "s1", nome: "Salone Uno", timezone: "Europe/Rome", orariApertura: {},
        impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" } },
    ]);
    vi.spyOn(productRepo, "listProducts").mockResolvedValue([
      { id: "p1", titolo: "Cera", descrizione: "Tenuta forte", prezzo: 1500, attivo: true },
      { id: "p2", titolo: "Vecchio", descrizione: "", prezzo: 500, attivo: false },
    ]);
    render(<MemoryRouter><CatalogPage /></MemoryRouter>);
    expect(await screen.findByText("Cera")).toBeInTheDocument();
    // il prodotto non attivo non viene mostrato
    expect(screen.queryByText("Vecchio")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/pages/CatalogPage.test.tsx`
Expected: FAIL — modulo `./CatalogPage` non trovato.

- [ ] **Step 3: Implementazione**

Create `src/pages/CatalogPage.tsx`:
```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSalons, type SalonWithId } from "../firebase/salon-repo";
import { listProducts, type ProductWithId } from "../firebase/product-repo";
import "./customer.css";

function euro(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 });
}

export function CatalogPage() {
  const [salons, setSalons] = useState<SalonWithId[]>([]);
  const [salonId, setSalonId] = useState<string>("");
  const [products, setProducts] = useState<ProductWithId[]>([]);

  useEffect(() => {
    void listSalons().then((s) => {
      setSalons(s);
      if (s.length > 0) setSalonId((cur) => cur || s[0].id);
    });
  }, []);

  useEffect(() => {
    if (!salonId) return;
    void listProducts(salonId).then((list) =>
      setProducts(list.filter((p) => p.attivo))
    );
  }, [salonId]);

  return (
    <main className="customer-shell">
      <div className="customer-shell__header">
        <div>
          <span className="customer-shell__eyebrow">Prodotti</span>
          <h1>Acquista in salone</h1>
        </div>
        <Link className="customer-button customer-button--secondary" to="/prenota">Prenota</Link>
      </div>

      <div className="booking-field">
        <label htmlFor="cat-salon">Salone</label>
        <select id="cat-salon" value={salonId} onChange={(e) => setSalonId(e.target.value)}>
          {salons.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>

      <div className="booking-slots" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {products.map((p) => (
          <div className="booking-panel" key={p.id}>
            {p.fotoUrl && (
              <img src={p.fotoUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />
            )}
            <strong>{p.titolo}</strong>
            <p className="customer-booking__meta">{p.descrizione}</p>
            <p><strong>€ {euro(p.prezzo)}</strong></p>
          </div>
        ))}
        {products.length === 0 && <p className="customer-booking__meta">Nessun prodotto disponibile.</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/pages/CatalogPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Aggancia la rotta cliente**

In `src/App.tsx`, aggiungi l'import `import { CatalogPage } from "./pages/CatalogPage";` e una rotta protetta da `RequireClient`:
```tsx
<Route
  path="/catalogo"
  element={
    <RequireClient>
      <CatalogPage />
    </RequireClient>
  }
/>
```

- [ ] **Step 6: Verifica finale**

```bash
cd "/Users/fabio_pace/App Barber Shop"
npm run test        # puri/componente verdi
npm run test:emu    # emulatore (repo, foto, rules) verdi
npx tsc -b          # clean
npm run build       # ok
```

- [ ] **Step 7: Commit**

```bash
git add src/pages/CatalogPage.tsx src/pages/CatalogPage.test.tsx src/App.tsx
git commit -m "feat(2a): CatalogPage (vetrina prodotti cliente)"
```

---

## Verifica di completamento Fase 2a

- [ ] `npm run test` → puri/componente verdi
- [ ] `npm run test:emu` → emulatore verdi (product-repo, foto su Storage, rules prodotti)
- [ ] `npx tsc -b` e `npm run build` ok
- [ ] Nella dashboard: creare/eliminare prodotti con foto opzionale; nel cliente: vedere il catalogo dei prodotti attivi di un salone

## Cosa NON è in questo incremento (arriva in 2b)

- Carrello, checkout, creazione ordine (`createOrder`), dashboard ordini, notifica "pronto"
- Eliminazione della foto da Storage quando si elimina il prodotto (cleanup) → valutare in 2b
- Modifica in-place dei prodotti (ora: crea + elimina)
