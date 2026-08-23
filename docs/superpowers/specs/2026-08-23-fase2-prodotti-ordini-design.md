# Fase 2 — Prodotti & Ordini — Specifica di Design

**Data:** 2026-08-23
**Stato:** Approvato
**Base:** Fase 1 completa (auth, prenotazioni, dashboard) su `main`

---

## 1. Obiettivo e ambito

Aggiungere la vendita di prodotti alla piattaforma: il salone gestisce un catalogo, il cliente ordina dall'app, **ritira e paga in salone**. Riusa i pattern della Fase 1 (Cloud Functions server-autorevoli, repository, Security Rules multi-tenant, notifiche push+email, auth context).

Si esegue in sotto-incrementi, ciascuno funzionante e testabile da solo:

- **2a — Catalogo prodotti:** CRUD prodotti in dashboard (con foto opzionale su Cloud Storage) + vetrina prodotti lato cliente.
- **2b — Carrello + ordini:** carrello e checkout lato cliente (pagamento/ritiro in salone), creazione ordine server-autorevole, dashboard ordini per il salone con stati, notifica "pronto" al cliente.

**Fuori ambito (successivo):**
- **2c — Pagamento online (Stripe):** richiede account/chiavi del cliente e non è testabile sull'emulatore; rimandato.
- Spedizione a domicilio (deciso: solo ritiro in salone).
- Gestione scorte/magazzino (solo `attivo`/non attivo).
- Rifinitura grafica in stile mockup (rimandata: si costruisce con lo stile base attuale).

## 2. Decisioni approvate

| Tema | Decisione |
|------|-----------|
| Consegna | Solo **ritiro in salone** (nessuna spedizione) |
| Pagamento | **In salone al ritiro** ora; online (Stripe) rimandato a 2c |
| Foto prodotto | **Opzionale**, su Cloud Storage |
| Scorte | Non gestite ora (solo `attivo`) |
| Carrello | Per singolo salone, lato client fino al checkout |
| Creazione ordine | **Cloud Function** server-autorevole (prezzi/totale dal server) |
| Item ordine | **Snapshot** di titolo+prezzo al momento dell'ordine (immutabili) |
| Stati ordine | `in_attesa → pronto → ritirato`; `annullato` |
| Notifiche | Push+email al cliente su `pronto` e `annullato` (riusa il canale Fase 1) |

## 3. Modello dati (Firestore)

```
salons/{salonId}/products/{productId}
  titolo: string
  descrizione: string
  prezzo: number            # centesimi interi
  fotoUrl?: string          # URL pubblico/scaricabile da Cloud Storage; assente se senza foto
  fotoPath?: string         # path in Storage (per eventuale eliminazione)
  attivo: boolean

salons/{salonId}/orders/{orderId}
  clientId: string
  items: Array<{ productId: string; titolo: string; prezzo: number; qta: number }>  # snapshot
  totale: number            # centesimi, calcolato dal server = somma prezzo*qta
  stato: "in_attesa" | "pronto" | "ritirato" | "annullato"
  createdAt: timestamp
```

Cloud Storage: le foto vivono sotto `salons/{salonId}/products/{productId}/{filename}`.

## 4. Componenti e responsabilità

- **`createOrder`** (Cloud Function callable) — input: `salonId`, `items: [{productId, qta}]`. Rilegge i prodotti autorevoli del salone, verifica che esistano e siano `attivo`, costruisce gli item snapshot (titolo+prezzo dal doc), calcola `totale`, crea l'ordine `in_attesa` con `clientId = auth.uid`. Rifiuta: non autenticato, non `cliente`, carrello vuoto, prodotto inesistente/inattivo.
- **`notifyOrderStatus`** (Cloud Function trigger `onDocumentUpdated` su `orders`) — sul cambio a `pronto` o `annullato`, invia push+email al cliente (sul modello di `notifyBookingStatus`), idempotente per `orderId_stato`.
- **`product-repo`** — CRUD prodotti (list/create/update/delete) + `uploadProductPhoto(salonId, productId, file)` su Storage che ritorna `{fotoUrl, fotoPath}`.
- **`order-repo`** — cliente: `createOrder` (via callable), `listMyOrders`; salone: `listSalonOrders`, `updateOrderStatus`.
- **UI dashboard** — `ProductsPage` (CRUD + foto), `OrdersPage` (elenco ordini, azioni `pronto`/`ritirato`/`annulla`).
- **UI cliente** — `CatalogPage` (vetrina prodotti del salone), carrello (stato client), checkout (invia ordine), `MyOrdersPage`.

## 5. Sicurezza

- **Firestore rules** (estensione):
  - `products`: lettura autenticata; scrittura solo `isStaffOf(salonId)`.
  - `orders`: `create: if false` (solo via Cloud Function admin); lettura per il `clientId` proprietario o `isStaffOf`; update limitato al solo campo `stato` con transizioni valide — staff `in_attesa→{pronto,annullato}`, `pronto→{ritirato,annullato}`; cliente solo `in_attesa→annullato`. Campi item/totale/cliente immutabili.
- **Cloud Storage rules:** lettura foto per utenti autenticati; scrittura/eliminazione solo `isStaffOf(salonId)` sul path del salone; limiti di dimensione/content-type immagine.
- Prezzi e totale sempre dal server (mai da input client).

## 6. Gestione errori e casi limite

- Carrello vuoto → `createOrder` rifiuta.
- Prodotto rimosso/disattivato tra vetrina e checkout → rifiutato con messaggio chiaro.
- Foto: upload fallito → il prodotto si salva comunque senza foto; formati non-immagine o troppo grandi bloccati dalle Storage rules.
- Doppio invio ordine (doppio click) → il pulsante si disabilita durante l'invio.
- Cambio stato non valido (es. cliente che marca `pronto`) → negato dalle rules.

## 7. Strategia di test

- **`createOrder`** (emulatore functions+firestore+auth): totale corretto dai prezzi autorevoli; snapshot item corretti; prodotto inattivo/inesistente rifiutato; carrello vuoto rifiutato; non-cliente rifiutato.
- **`notifyOrderStatus`** (emulatore): notifica creata su `pronto`/`annullato`, idempotente, tenant-corretta.
- **Repository + rules** (emulatore): CRUD prodotti e isolamento multi-salone; ordini leggibili solo dal proprietario/staff; transizioni di stato valide/invalide; Storage rules (staff scrive, altri no).
- **Componenti** (Testing Library): catalogo elenca prodotti; carrello aggiunge/rimuove e calcola totale; checkout invoca `createOrder`; dashboard prodotti/ordini eseguono le azioni corrette (repos mockati).

## 8. Impatto sulla struttura

- Nuovi file: `functions/src/createOrder.ts`, `functions/src/notifyOrderStatus.ts`; `src/firebase/product-repo.ts`, `src/firebase/order-repo.ts`; pagine `ProductsPage`, `OrdersPage` (dashboard), `CatalogPage`, `MyOrdersPage` (cliente) + un piccolo stato carrello.
- Modifiche: `firestore.rules` (products/orders), nuova `storage.rules`, `firebase.json` (storage + emulatore storage), `src/firebase/app.ts` (aggancio Storage emulator), `src/App.tsx` (rotte), `DashboardLayout` (voci Prodotti/Ordini).
- Emulatore Storage aggiunto (gira sulla Java già installata).
