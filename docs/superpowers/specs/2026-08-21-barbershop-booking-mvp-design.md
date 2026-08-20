# Piattaforma Saloni — Specifica di Design (Fase 1: Prenotazioni)

**Data:** 2026-08-21
**Stato:** Approvato
**Autore:** Fabio (fabiofp1996@gmail.com) + Claude

---

## 1. Contesto e visione

Piattaforma **multi-salone (SaaS rivendibile)** per barbieri/parrucchieri, distribuita come **PWA** (installabile su Android e iPhone, nessuno store richiesto). Ogni salone gestisce prenotazioni, vendita prodotti e marketing verso i propri clienti registrati.

Il prodotto completo è composto da 7 moduli:

1. Account & profili clienti
2. Multi-salone (multi-tenant)
3. Prenotazioni + calendario a durata
4. Prodotti + pagamenti (online + in salone)
5. Notifiche mirate (sesso, fascia d'età, compleanno)
6. Coupon
7. Involucro PWA

**Approccio approvato:** costruzione **a fasi**. Questo documento specifica la **Fase 1**.

### Ambito Fase 1

**Dentro:**
- Account & profili (modulo 1) — con raccolta di **sesso** e **data di nascita** in registrazione (necessari per le notifiche mirate delle fasi successive).
- Fondamenta multi-salone (modulo 2).
- Prenotazioni + calendario a durata (modulo 3).
- Dashboard salone di base (servizi, operatori, orari, gestione richieste).
- Involucro PWA di base (modulo 7) con notifiche push per gli avvisi transazionali.

**Fuori (fasi successive):** prodotti + pagamenti, notifiche mirate per sesso/età, notifiche compleanno, coupon.

---

## 2. Decisioni approvate

| Tema | Decisione |
|------|-----------|
| Distribuzione | PWA installabile (Android + iPhone), nessuno store |
| Login cliente | Email + password, con Google opzionale |
| Dati profilo | Nome, email, **sesso**, **data di nascita** (raccolti alla registrazione) |
| Orari di lavoro | **Ibrido**: orari di apertura del salone + override individuale per operatore |
| Passo del calendario | **15 minuti** |
| Canale avvisi | **Push (FCM) + Email** di riserva |
| Conferma prenotazione | **Manuale** del salone (in futuro configurabile in auto-conferma) |
| Slot "in attesa" | **Blocca** lo slot per evitare doppie prenotazioni |
| Pagamenti | Online + in salone → **Fase 2**, non in Fase 1 |
| Scala | Multi-salone (rivendibile) fin dalle fondamenta |

### Stack tecnico (scelto dall'utente: Firebase)

- **Firebase Auth** — email/password + Google
- **Cloud Firestore** — database, multi-tenant via `salonId` + Security Rules
- **Cloud Functions** — logica calendario, transazioni prenotazione, invio notifiche, job schedulati (fasi future)
- **Firebase Cloud Messaging (FCM)** — notifiche push
- **Cloud Storage** — foto prodotti (Fase 2)
- **Firebase Hosting** — serve la PWA
- **Email transazionale** — agganciata alle Cloud Functions (es. estensione "Trigger Email" via SMTP, o servizio tipo Resend/SendGrid)

**Nota di rischio:** Firestore è non-relazionale, quindi la logica di **calcolo disponibilità** va implementata in Cloud Functions anziché in query SQL. Fattibile e collaudato; è il punto su cui concentrare test e cura.

---

## 3. Modello dati (Firestore)

```
users/{uid}
  nome: string
  email: string
  sesso: "maschile" | "femminile" | "altro"
  dataNascita: timestamp
  ruolo: "cliente" | "staff" | "owner"
  salonId?: string            # solo per staff/owner
  fcmTokens: string[]         # token push dei dispositivi
  createdAt: timestamp

salons/{salonId}
  nome: string
  orariApertura: {            # per giorno della settimana
    lun: [{ start: "09:00", end: "19:00" }], ...
  }
  impostazioni: {
    passoMinuti: 15
    modalitaConferma: "manuale" | "auto"   # default "manuale"
  }
  createdAt: timestamp

salons/{salonId}/operators/{operatorId}
  nome: string
  attivo: boolean
  orariPersonalizzati?: {     # override; se assente usa quelli del salone
    lun: [{ start, end }], ...
  }

salons/{salonId}/services/{serviceId}
  titolo: string
  descrizione: string
  prezzo: number              # in centesimi (interi), per evitare errori di arrotondamento
  durataMin: number
  attivo: boolean

salons/{salonId}/bookings/{bookingId}
  clientId: string            # uid del cliente
  operatorId: string
  serviceId: string
  inizio: timestamp
  fine: timestamp             # inizio + durataMin
  stato: "in_attesa" | "confermata" | "rifiutata" | "annullata"
  createdAt: timestamp
```

**Isolamento multi-tenant:** i dati operativi di un salone vivono sotto `salons/{salonId}/...`. Le Security Rules garantiscono che lo staff acceda solo al proprio `salonId` e che un cliente possa creare/leggere solo le proprie prenotazioni.

---

## 4. Componenti e responsabilità

Unità isolate, ciascuna con uno scopo unico:

- **Auth & Profilo** — registrazione/login, raccolta sesso e data di nascita, gestione token FCM.
- **Motore di disponibilità** (Cloud Function pura, senza effetti collaterali) — input: `salonId, operatorId, giorno, durataMin`; output: elenco orari di inizio disponibili. È l'unità più critica e va testata a fondo in isolamento.
- **Servizio prenotazione** (Cloud Function transazionale) — crea la prenotazione verificando atomicamente che lo slot sia libero.
- **Servizio notifiche** (Cloud Function trigger su cambio stato) — invia push (FCM) + email su conferma/rifiuto.
- **Dashboard salone** (UI) — CRUD servizi, CRUD operatori, orari, gestione richieste.
- **App cliente** (UI PWA) — sfoglia salone, flusso prenotazione, stato prenotazioni.

---

## 5. Flussi principali

### 5.1 Motore di disponibilità
Data una richiesta `(operatorId, giorno, durataMin)`:
1. Determina gli orari di lavoro dell'operatore per quel giorno (orari personalizzati se presenti, altrimenti orari del salone).
2. Recupera le prenotazioni **in_attesa + confermata** dell'operatore per quel giorno → intervalli occupati.
3. Calcola gli intervalli liberi (orari di lavoro − intervalli occupati).
4. Enumera gli orari di inizio con **passo 15 min** e tiene solo quelli in cui `[inizio, inizio+durataMin]` rientra interamente in un intervallo libero.

### 5.2 Creazione prenotazione (anti doppia-prenotazione)
1. Il cliente sceglie servizio → operatore → giorno → orario (dagli slot proposti dal motore).
2. Cloud Function in **transazione Firestore**: rilegge le prenotazioni dell'operatore in quella fascia; se lo slot è ancora libero crea la prenotazione con `stato = in_attesa` (che blocca lo slot), altrimenti restituisce errore "orario non più disponibile".
3. Notifica al salone della nuova richiesta.

### 5.3 Conferma / rifiuto
1. Lo staff apre la dashboard e sceglie **Conferma** o **Rifiuta**.
2. Aggiornamento `stato` → trigger Cloud Function invia **push + email** al cliente.
3. Se `rifiutata` o `annullata`, lo slot torna libero (non essendo più in_attesa/confermata).

---

## 6. Gestione errori e casi limite

- **Doppia prenotazione** → transazione Firestore; il perdente riceve "orario non più disponibile".
- **Buchi più corti della durata** → esclusi dal motore.
- **Confini turno / giorno libero** → rispettati (il servizio deve stare interamente dentro l'intervallo di lavoro).
- **Push non recapitata** (iPhone senza PWA installata, permessi negati, token scaduto) → l'**email** garantisce comunque l'avviso.
- **PWA offline** → l'utente riceve un messaggio chiaro; nessuna prenotazione "silenziosamente persa".
- **Fuso orario** → tutte le date memorizzate in modo coerente; il salone opera nel proprio fuso.

---

## 7. Strategia di test

- **Unit test del motore di disponibilità** (priorità massima): prenotazioni adiacenti, buchi stretti, inizio/fine turno, giorno libero, servizi di durata diversa, override orari operatore.
- **Test della transazione** di prenotazione: due richieste concorrenti sullo stesso slot → una sola vince.
- **Test delle Security Rules**: isolamento multi-salone (staff A non legge dati salone B; cliente legge solo le proprie prenotazioni).
- **Test trigger notifiche**: cambio stato genera push + email.

---

## 8. Roadmap fasi successive (non in questo spec)

- **Fase 2** — Prodotti + carrello + pagamenti (Stripe/PayPal, online + in salone) + Cloud Storage foto.
- **Fase 3** — Motore notifiche mirate (segmentazione per sesso e fascia d'età).
- **Fase 4** — Notifiche compleanno (job schedulato, auguri con/senza codice sconto) + Coupon.

Ogni fase avrà il proprio ciclo spec → piano → implementazione.
