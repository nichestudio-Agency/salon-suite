# Salon Suite Platform

## Panoramica

Salon Suite Platform è una piattaforma SaaS white-label per barberie e parrucchierie. Ogni attività acquista una licenza e distribuisce ai propri clienti un sito/app con identità e contenuti dedicati.

Il cliente finale non vede un marketplace e non sceglie tra più saloni: accede direttamente all'app del salone di riferimento. La piattaforma multi-tenant rimane dietro le quinte e consente di riutilizzare la stessa infrastruttura per più attività.

Lo stesso codice supporta due verticali, `barberia` e `parrucchieria`. Il campo `tipo` del salone seleziona automaticamente linguaggio, palette, immagini e contenuti, mantenendo separati dati e identità del tenant.

Il progetto comprende tre esperienze distinte:

- **Area cliente**, per prenotare servizi, conoscere gli operatori e ordinare prodotti.
- **Dashboard del salone**, per gestire agenda, cataloghi, team, ordini e comunicazioni.
- **Console di piattaforma**, riservata al gestore SaaS per monitorare saloni, licenze e ricavi ricorrenti.

## Modello white-label e multi-tenant

Ogni installazione pubblica è associata a un solo documento `salons/{salonId}`.

In produzione il tenant viene configurato tramite:

```bash
VITE_SALON_ID=<id-del-salone>
```

Il `SalonTenantProvider` risolve il salone all'avvio e rende disponibili identità e `salonId` a tutta l'area cliente. Servizi, operatori, prodotti, prenotazioni e ordini vengono sempre letti all'interno del tenant risolto.

In sviluppo locale il tenant predefinito è `salone-x`. Il cliente non può visualizzare l'elenco completo dei tenant e non trova selettori per cambiare salone.

## Ruoli

### Cliente

Il cliente può:

- registrarsi e accedere all'app del salone;
- consultare servizi, durata e prezzo;
- consultare gli operatori disponibili;
- cercare gli orari liberi;
- inviare e annullare una prenotazione;
- consultare e acquistare prodotti con pagamento in salone;
- gestire il carrello;
- consultare e annullare gli ordini consentiti.

Il profilo cliente conserva anche il `salonId` del tenant dal quale è avvenuta la registrazione.

### Owner e staff

La dashboard del salone permette di:

- confermare, rifiutare e annullare prenotazioni;
- creare e modificare servizi;
- gestire operatori e disponibilità;
- consultare l’anagrafica clienti con storico sintetico di prenotazioni e acquisti;
- configurare gli orari settimanali;
- gestire prodotti e relative fotografie;
- gestire lo stato degli ordini;
- consultare notifiche;
- configurare campagne, coupon e comunicazioni automatiche di compleanno;
- segmentare le campagne per dati anagrafici, inattività di prenotazione e inattività di acquisto.

### Super Admin

Il gestore della piattaforma può:

- consultare saloni, clienti aggregati e prenotazioni recenti;
- monitorare ricavo mensile ricorrente, piani e scadenze;
- filtrare i tenant per stato della licenza;
- aggiornare piano, canone, scadenza e stato di ogni licenza.
- registrare una nuova attività e creare l'accesso iniziale del titolare;
- scegliere il verticale barberia o parrucchieria;
- configurare palette, logo e fotografie dell'esperienza white-label;
- vedere un'anteprima mobile del brand prima della pubblicazione.

### Identità white-label

Ogni documento `salons/{salonId}` può contenere un oggetto `branding` con tre colori (`backgroundColor`, `foregroundColor`, `accentColor`) e gli asset per logo, immagine principale, trattamento e prodotti. In assenza di personalizzazioni vengono usati i preset editoriali della barberia o della parrucchieria.

Gli asset caricati dal Super Admin vengono salvati in `salons/{salonId}/branding/` su Cloud Storage. L'app cliente applica automaticamente immagini e palette; la dashboard del titolare eredita logo, fotografia e colore d'accento.

## Area cliente

L'area cliente è progettata come una vera app mobile. Anche quando viene aperta da desktop resta racchiusa in un canvas centrato di circa 500 px e conserva la barra di navigazione inferiore. Non si espande quindi in un sito desktop tradizionale.

| Percorso | Funzione |
| --- | --- |
| `/prenota` | Ricerca disponibilità e creazione prenotazioni |
| `/servizi` | Catalogo dei servizi del salone |
| `/operatori` | Presentazione dei barber/operatori |
| `/catalogo` | Catalogo prodotti |
| `/carrello` | Gestione del carrello e invio ordine |
| `/i-miei-ordini` | Storico e stato degli ordini |

## Dashboard del salone

La dashboard del titolare è invece completamente responsive: su smartphone usa una navigazione e una gerarchia compatte, mentre su desktop sfrutta l'intera area disponibile per agenda, KPI, tabelle e strumenti gestionali.

| Percorso | Funzione |
| --- | --- |
| `/dashboard` | Riepilogo operativo con KPI, agenda, incassi e team |
| `/dashboard/prenotazioni` | Gestione dell'agenda |
| `/dashboard/clienti` | Anagrafica e attività dei clienti registrati |
| `/dashboard/servizi` | Gestione dei servizi |
| `/dashboard/operatori` | Gestione del team |
| `/dashboard/orari` | Orari di apertura e disponibilità |
| `/dashboard/prodotti` | Gestione prodotti e immagini |
| `/dashboard/ordini` | Gestione degli ordini |
| `/dashboard/notifiche` | Coupon, campagne segmentate e automazioni |

## Console di piattaforma

| Percorso | Funzione |
| --- | --- |
| `/admin` | Panoramica commerciale, saloni e gestione licenze |

## Autenticazione

Firebase Authentication gestisce registrazione, accesso e sessione. Il documento `users/{uid}` determina il ruolo e, quando applicabile, il tenant di appartenenza.

Le route cliente sono protette da `RequireClient`; la dashboard è protetta da `RequireOwner`. Dopo l'accesso, `RoleHome` indirizza automaticamente l'utente verso l'esperienza corretta.

La registrazione cliente evita account orfani: se la creazione del profilo Firestore fallisce, l'account Authentication appena creato viene eliminato.

## Prenotazioni e disponibilità

La disponibilità viene calcolata considerando:

- orari settimanali del salone;
- eventuali orari personalizzati dell'operatore;
- durata del servizio;
- passo temporale configurato dal salone;
- prenotazioni già in attesa o confermate.

La creazione passa dalla Cloud Function `createBooking`, che esegue i controlli sul server per evitare sovrapposizioni e problemi di concorrenza.

## Ordini e prodotti

I prodotti appartengono a un singolo salone. Il carrello accetta prodotti di un solo tenant alla volta e l'ordine viene creato tramite `createOrder`.

Il pagamento avviene attualmente in salone. Le righe dell'ordine contengono uno snapshot di titolo e prezzo, così le modifiche future al catalogo non alterano gli ordini già creati.

## Stack tecnologico

- React 19
- TypeScript 6
- Vite 8
- React Router 7
- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase
- Cloud Storage
- Vitest e Testing Library
- Firebase Rules Unit Testing
- Oxlint

## Backend e Cloud Functions

Le funzioni esportate da `functions/src/index.ts` sono:

- `createSalon`
- `createBooking`
- `getAvailability`
- `notifyBookingStatus`
- `createOrder`
- `notifyOrderStatus`
- `sendCampaign`
- `listPlatformSalons`
- `updateSalonLicense`
- `createPlatformSalon`
- `updateSalonBranding`
- `runBirthdayGreetings`
- `birthdayNotifications`
- `listSalonClients`

## Struttura dati principale

```text
users/{uid}
salons/{salonId}
  operators/{operatorId}
  services/{serviceId}
  bookings/{bookingId}
  products/{productId}
  orders/{orderId}
  coupons/{couponId}
  campaigns/{campaignId}
  notifications/{notificationId}
```

I prezzi sono memorizzati come centesimi interi. Date anagrafiche e date locali del salone usano il formato `YYYY-MM-DD`; gli orari sono rappresentati come minuti dalla mezzanotte.

## Sicurezza

Le regole Firestore applicano questi principi:

- ogni utente può leggere e aggiornare solo il proprio profilo;
- il ruolo e il tenant non possono essere modificati dal cliente;
- il singolo documento pubblico del salone è leggibile per risolvere il tenant;
- l'elenco completo dei saloni non è esposto al client white-label;
- solo owner e staff del tenant possono modificare servizi, operatori e prodotti;
- prenotazioni e ordini sono leggibili dal relativo cliente o dallo staff del salone;
- le operazioni sensibili di creazione passano dalle Cloud Functions.

Sono presenti regole dedicate anche per Cloud Storage.

## Design system

L'interfaccia segue una direzione premium ed editoriale ispirata al mondo barber:

- palette avorio caldo, grafite e arancio rame;
- titoli ad alto impatto e interfaccia sans-serif;
- fotografia cinematografica usata come elemento identitario;
- superfici aperte e divisori al posto di card annidate;
- navigazione scura per le aree operative;
- layout responsive con priorità ai controlli su mobile.

I principali stili si trovano in:

- `src/index.css`
- `src/pages/customer.css`
- `src/app/dashboard.css`

## Avvio locale

### Requisiti

- Node.js compatibile con il progetto
- Java/OpenJDK per gli emulatori Firebase
- Firebase CLI

### Installazione

```bash
npm install
npm --prefix functions install
```

### Ambiente di sviluppo completo

Avviare gli emulatori Firebase nel primo terminale:

```bash
npm run emu:start
```

Con gli emulatori attivi, caricare il tenant dimostrativo nel secondo terminale:

```bash
npm run emu:seed
```

Avviare infine il frontend collegato agli emulatori:

```bash
VITE_USE_EMULATOR=true npm run dev -- --host 127.0.0.1
```

L'app è disponibile normalmente su `http://127.0.0.1:5173`.

Il seed crea due tenant completi: **Salone X** per la barberia e **Atelier Luce** per la parrucchieria. Entrambi includono orari, servizi, prodotti, team, clienti, appuntamenti e ordini dimostrativi. Crea inoltre gli account locali principali:

| Ruolo | Email | Password |
| --- | --- | --- |
| Cliente barberia | `cliente.test@barberia.local` | `TestBarber26!` |
| Titolare barberia | `titolare.test@barberia.local` | `OwnerBarber26!` |
| Cliente parrucchieria | `cliente.hair@barberia.local` | `HairStudio26!` |
| Titolare parrucchieria | `titolare.hair@barberia.local` | `HairStudio26!` |
| Super Admin | `admin@barberia.local` | `AdminBarber26!` |

I test dell'emulatore possono ripulire Firestore e Authentication; in quel caso è sufficiente rieseguire `npm run emu:seed`.

## Variabili d'ambiente

| Variabile | Descrizione |
| --- | --- |
| `VITE_SALON_ID` | Tenant esposto dall'installazione white-label |
| `VITE_USE_EMULATOR` | Usa gli emulatori Firebase quando vale `true` |
| `VITE_FIREBASE_API_KEY` | API key Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Dominio Authentication |
| `VITE_FIREBASE_PROJECT_ID` | ID progetto Firebase |
| `VITE_FIREBASE_APP_ID` | ID applicazione Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket Cloud Storage |

In assenza delle variabili Firebase, il progetto usa valori demo adatti all'ambiente locale.

## Comandi disponibili

```bash
npm run dev        # frontend Vite
npm run build      # TypeScript + build di produzione
npm run preview    # anteprima della build
npm run lint       # analisi statica
npm run test       # test unitari e componenti
npm run emu:start  # emulatori Firebase
npm run emu:seed   # dati demo Salone X e Atelier Luce
npm run test:emu   # test di integrazione con emulatori
```

## Organizzazione del codice

```text
src/
  app/         provider, layout, guardie e contesti globali
  assets/      immagini e risorse visuali
  components/  componenti condivisi
  domain/      modelli e logica di dominio pura
  firebase/    repository e integrazioni Firebase
  pages/       pagine cliente e dashboard
  test/        configurazione dei test
functions/
  src/         Cloud Functions
  scripts/     utility per l'ambiente locale
```

## Stato del progetto

Sono implementati i flussi principali per cliente e salone, il modello tenant white-label, le regole di sicurezza, gli emulatori e una copertura di test unitari e di integrazione.

Prima della pubblicazione commerciale restano da definire per ogni installazione:

- dominio e `VITE_SALON_ID` del cliente;
- progetto e credenziali Firebase di produzione;
- contenuti reali, identità visuale e fotografie del salone;
- configurazione delle notifiche push e dei processi schedulati;
- eventuale integrazione di pagamenti online;
- policy privacy, cookie e condizioni di servizio.

Il frontend è già predisposto per Vercel tramite `vercel.json`, che inoltra tutte le route della SPA a `index.html`. La pubblicazione richiede le variabili Firebase di produzione; Cloud Functions, Firestore, Authentication e Storage restano distribuiti su Firebase.
