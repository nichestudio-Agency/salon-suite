# Fase 1 · Increment 3 — Dashboard salone — Specifica di Design

**Data:** 2026-08-23
**Stato:** Approvato
**Parte di:** [Fase 1 — Piattaforma Saloni](2026-08-21-barbershop-booking-mvp-design.md)

---

## 1. Obiettivo e ambito

Costruire la **dashboard del salone**: l'area in cui il titolare (owner) configura il proprio salone. Prima parte del progetto con interfaccia utente visibile, servita dalla PWA (Vite + React + TS) e appoggiata a Firebase (Auth, Firestore, Cloud Functions).

Si esegue in **due sotto-incrementi**, ciascuno funzionante e testabile da solo:

- **3a — Guscio + Onboarding**: routing, contesto di autenticazione, onboarding del salone (registrazione owner + Cloud Function che crea salone e promuove l'utente), guscio della dashboard con barra laterale.
- **3b — CRUD di configurazione**: sezioni Servizi, Operatori, Orari con i relativi repository e form.

**Fuori ambito (incrementi successivi):** vista prenotazioni in arrivo + conferma/rifiuto (Increment 4, insieme al flusso di prenotazione cliente); prodotti, coupon, notifiche mirate (fasi successive); account staff aggiuntivi oltre all'owner.

## 2. Decisioni approvate

| Tema | Decisione |
|------|-----------|
| Accesso salone | Onboarding ora: l'owner si registra e una Cloud Function crea salone + account owner |
| Operatori | Risorse prenotabili (nome, orari, attivo), **senza login proprio**; per ora accede solo l'owner |
| Navigazione dashboard | **Barra laterale** (collassa a menu/barra inferiore su mobile) |
| Onboarding | Raccoglie nome salone + fuso orario + orari di apertura di default; gli orari si rifiniscono poi nella sezione Orari |
| Elevazione a owner | Solo lato server via Cloud Function con `firebase-admin` (le rules bloccano l'auto-promozione client) |
| Routing | React Router |
| Form/stato | Form React controllati, hook + un piccolo auth context; nessuna libreria form/stato (YAGNI) |
| Vista prenotazioni + conferma/rifiuto | Rimandata all'Increment 4 |

## 3. Architettura

- **`functions/`** (nuova cartella, TypeScript, `firebase-functions` + `firebase-admin`): ospita la callable `createSalon`. Gira nell'emulatore Functions. È la prima parte backend del progetto (servirà anche per la transazione anti doppia-prenotazione dell'Increment 4).
- **Repository** in `src/firebase/`: moduli sottili che incapsulano lettura/scrittura Firestore per salone, servizi, operatori. I componenti UI usano i repository, mai Firestore direttamente.
- **Auth context** (`src/app/`): espone utente corrente, ruolo, `salonId`; deriva da `onAuthStateChanged` + lettura del doc `users/{uid}`.
- **UI**: guscio con barra laterale + pagine per sezione. Componenti piccoli e focalizzati.

### Componenti e responsabilità

- `createSalon` (Cloud Function callable) — input: nome salone, timezone, orari default. Effetto: crea `salons/{salonId}`, imposta `users/{uid}` a `ruolo:'owner'` + `salonId`. Rifiuta se l'utente è già owner/staff di un salone.
- `salonRepo` / `serviceRepo` / `operatorRepo` — CRUD tipizzato sulle rispettive collezioni.
- `AuthProvider` / `useAuth` — stato di autenticazione e profilo.
- `RequireOwner` — guardia di rotta: se non owner, redirect ad accesso/onboarding.
- Guscio `DashboardLayout` (barra laterale) + pagine `ServicesPage`, `OperatorsPage`, `HoursPage`, `OnboardingPage`, `LoginPage`.

## 4. Flussi principali

### 4.1 Onboarding (3a)
1. L'owner apre `/registrati-salone`, inserisce email/password + nome salone + fuso + (orari default precompilati, es. Lun–Sab 9:00–19:00).
2. Registrazione auth (riusa il layer auth dell'Increment 2, ma **senza** creare un profilo `cliente`).
3. Chiamata a `createSalon` → crea salone + eleva l'utente a owner.
4. L'auth context si aggiorna; redirect a `/dashboard/servizi`.

### 4.2 CRUD configurazione (3b)
- **Servizi**: lista dei servizi del salone; form crea/modifica (titolo, descrizione, prezzo in centesimi, durataMin, attivo); elimina.
- **Operatori**: lista; aggiungi/rimuovi; attiva/disattiva; editor orari personalizzati (override settimanale).
- **Orari**: editor degli orari di apertura del salone (`orariApertura`).

## 5. Sicurezza (aggiornamento rules)

- Le rules continuano a impedire l'auto-promozione client (Increment 2). La creazione del salone e l'elevazione a owner avvengono **solo** nella Cloud Function via `firebase-admin` (che bypassa le rules in modo controllato e validato).
- Scrittura di servizi/operatori/orari: consentita allo staff/owner del salone (già coperto da `isStaffOf` dell'Increment 2).
- `createSalon` valida che il chiamante sia autenticato e non sia già legato a un salone, per evitare che si impossessi o duplichi saloni.

## 6. Gestione errori e casi limite

- Email già registrata in onboarding → messaggio chiaro, nessun salone creato.
- Nome salone mancante / fuso non valido → validazione lato form e lato function.
- Fallimento di `createSalon` dopo la registrazione auth → l'utente resta registrato ma senza salone; alla riapertura l'onboarding riprende dal passo "crea salone" (idempotenza: la function rifiuta se già owner, altrimenti riprova la creazione).
- Prezzo/durata negativi o non numerici → bloccati dal form.
- Accesso a `/dashboard/...` senza essere owner → redirect (guardia `RequireOwner`).

## 7. Strategia di test

- **`createSalon`** (test emulatore functions+auth+firestore): crea salone + eleva l'utente; un secondo tentativo dello stesso utente viene rifiutato; un utente non autenticato viene rifiutato.
- **Repository** (test emulatore): CRUD servizi/operatori/orari rispettando le rules; isolamento multi-salone (owner del salone A non scrive nel salone B).
- **Componenti chiave** (Testing Library + jsdom): il form Servizio invoca il repository con i dati corretti; `RequireOwner` reindirizza un non-owner; il guscio elenca le sezioni. Si aggiunge l'ambiente `jsdom` a Vitest (per i soli test componente).

## 8. Impatto sulla struttura

- Nuova cartella `functions/` (progetto Cloud Functions).
- Nuove cartelle `src/app/` (routing, auth context, guscio) e `src/pages/` (pagine), oltre ai repository in `src/firebase/`.
- Aggiunta dipendenze: `react-router-dom`; dev: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`. Nell'emulatore si abilita anche `functions`.
