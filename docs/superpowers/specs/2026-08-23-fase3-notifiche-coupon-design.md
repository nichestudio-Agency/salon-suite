# Fase 3 — Notifiche mirate, Compleanno, Coupon — Specifica di Design

**Data:** 2026-08-23
**Stato:** Approvato
**Base:** Fasi 1 e 2 complete su `main`

---

## 1. Obiettivo e ambito

Dare al salone gli strumenti di marketing verso la propria clientela: **coupon** personalizzati, **notifiche mirate** (segmentate per sesso e fascia d'età) e **auguri di compleanno** automatici (con o senza codice sconto). Riusa il canale notifiche della Fase 1 (`mail/` + FCM + doc `notifications`) e i profili clienti (che contengono già `sesso` e `dataNascita`).

Si esegue in sotto-incrementi, ciascuno funzionante e testabile da solo:

- **3a — Coupon:** CRUD coupon in dashboard.
- **3b — Notifiche mirate:** compositore campagna (filtri sesso/età, testo, coupon opzionale) + Cloud Function `sendCampaign` che calcola destinatari e invia lato server.
- **3c — Compleanno:** Cloud Function schedulata giornaliera + configurazione in dashboard.

**Fuori ambito:** riscatto/tracciamento dei coupon (creazione + distribuzione soltanto; il riscatto avviene in salone mostrando il codice); pagamento online (2c); design grafico completo.

## 2. Decisioni approvate

| Tema | Decisione |
|------|-----------|
| Clientela del salone | I clienti con almeno una **prenotazione o ordine** presso quel salone |
| Calcolo destinatari + filtri | **100% lato server** (Cloud Function admin): il salone non legge mai `sesso`/`dataNascita` dei clienti, passa solo i filtri |
| Coupon | Creazione + distribuzione; codice **personalizzato**, tipo `percentuale`/`fisso`, valore, scadenza opzionale, attivo. Riscatto in salone (manuale) |
| Segmentazione | Per **sesso** (maschile/femminile/qualsiasi) e **fascia d'età** (nato da/a) |
| Compleanno | Cloud Function **schedulata** giornaliera; auguri con/senza coupon; configurabile per salone |
| Sicurezza | Coupon/campagne gestiti solo da `isStaffOf`; invii creati solo via Cloud Function |

## 3. Modello dati (Firestore)

```
salons/{salonId}/coupons/{couponId}
  codice: string            # personalizzato dal salone (es. "ESTATE20")
  tipo: "percentuale" | "fisso"
  valore: number            # percentuale: 0-100; fisso: centesimi
  scadenza?: string         # "YYYY-MM-DD", opzionale
  attivo: boolean

salons/{salonId}/campaigns/{campaignId}   # audit, creato dalla Cloud Function
  filtri: { sesso?: "maschile" | "femminile"; natoDa?: string; natoA?: string }
  titolo: string
  testo: string
  couponId?: string
  recipientCount: number
  sentAt: timestamp

salons/{salonId}
  compleanno?: {            # configurazione auguri automatici
    attivo: boolean
    messaggio: string
    couponId?: string
  }
```

I destinatari NON sono materializzati: vengono calcolati a runtime dalle Cloud Function.

## 4. Componenti e responsabilità

- **`sendCampaign`** (callable) — input: `salonId, filtri, titolo, testo, couponId?`. Verifica che il chiamante sia `isStaffOf(salonId)`. Ricava i `clientId` distinti da `bookings` + `orders` del salone, carica i profili (admin), filtra per `sesso`/intervallo `dataNascita`, compone il messaggio (se `couponId`, appende codice+sconto), invia FCM ai token + scrive doc `mail/`, crea il doc `campaigns/{id}` con `recipientCount`. Ritorna `{ campaignId, recipientCount }`.
- **`birthdayNotifications`** (schedulata, giornaliera) — per ogni salone con `compleanno.attivo`, trova i clienti (da bookings+orders) il cui `dataNascita` ha mese-giorno = oggi, invia il messaggio configurato (+ coupon se impostato). La **selezione per mese-giorno** è una funzione pura testabile; il wrapper `onSchedule` la usa.
- **`coupon-repo`** — CRUD coupon (list/create/update/delete).
- **`campaign.ts`** — wrapper client della callable `sendCampaign`.
- **UI dashboard (sezione "Notifiche")** — `CouponsPanel` (CRUD), `CampaignComposer` (filtri + testo + coupon → invia), `BirthdayConfig` (attiva/messaggio/coupon).

## 5. Sicurezza

- **Firestore rules**:
  - `coupons`: lettura e scrittura solo `isStaffOf(salonId)`.
  - `campaigns`: lettura `isStaffOf`; `create: if false` (solo via Cloud Function).
  - Aggiornamento del campo `compleanno` del salone: già coperto da `allow write: if isStaffOf(salonId)` sul doc salone.
- **PII**: `sesso`/`dataNascita` dei clienti sono letti **solo** dalle Cloud Function (admin). Il client dello staff non li legge mai; la regola `users` resta "solo il proprio doc".
- **Autorizzazione invio**: `sendCampaign` verifica `isStaffOf` leggendo il doc dell'utente chiamante (admin) prima di procedere.

## 6. Gestione errori e casi limite

- Codice coupon vuoto/duplicato → validazione (unicità best-effort lato UI; il codice è una stringa libera).
- Coupon scaduto → non selezionabile/segnalato nel compositore (filtra per `attivo` e `scadenza`).
- Filtro senza destinatari → la function ritorna `recipientCount: 0`, la UI mostra "Nessun destinatario".
- Clienti senza token push → ricevono solo email; senza email né token → conteggiati ma non raggiunti (segnalato nel riepilogo).
- Compleanno: nessun cliente in compleanno oggi → nessun invio; idempotenza per `{salonId}_{clientId}_{YYYY-MM-DD}` per non inviare due volte.

## 7. Strategia di test

- **`sendCampaign`** (emulatore functions+firestore+auth): destinatari corretti per filtro sesso; per fascia d'età (natoDa/natoA); solo clienti del salone (non di altri saloni); solo `isStaffOf` può invocarla (un cliente/estraneo è rifiutato); `recipientCount` corretto.
- **Selezione compleanno** (unit test puro): dato un insieme di date di nascita e una data odierna, seleziona i mese-giorno corrispondenti (incluso 29/2 → gestione fallback documentata).
- **`coupon-repo` + rules** (emulatore): CRUD + isolamento multi-salone; `campaigns` non creabili dal client.
- **Componenti** (Testing Library): CouponsPanel CRUD; CampaignComposer invoca `sendCampaign` con i filtri giusti; BirthdayConfig salva la configurazione.

## 8. Impatto sulla struttura

- Nuovi file: `functions/src/sendCampaign.ts`, `functions/src/birthdayNotifications.ts` (+ eventuale `functions/src/birthday-core.ts` per la logica pura); `src/firebase/coupon-repo.ts`, `src/firebase/campaign.ts`; UI `src/pages/NotificationsPage.tsx` (o pannelli dedicati).
- Modifiche: `firestore.rules` (coupons/campaigns), `functions/src/index.ts`, `src/domain/models.ts` (tipi Coupon/Campaign/Compleanno), `src/App.tsx` (rotta), `DashboardLayout` (voce Notifiche).
- La selezione compleanno riusa `weekdayOf`-style helper puri in `src/domain` dove utile; la logica pura vive anche in `functions` (duplicata o condivisa via copia, come già fatto per `booking-core`).
