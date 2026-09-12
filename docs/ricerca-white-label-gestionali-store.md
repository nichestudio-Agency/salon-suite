# App white-label e gestionali per barberie: modello distributivo e proposta commerciale

## Risposta breve

Le app personalizzate per singolo salone possono essere pubblicate sugli store. Il problema non è il riuso dello stesso codice: è **chi pubblica l'app, quanto ogni versione è realmente distinta e quale valore offre oltre a un semplice sito incapsulato**.

La strada più solida per Salon Suite è questa:

1. mantenere la PWA personalizzata come prodotto standard, senza dipendenza dagli store;
2. offrire l'app nativa con nome e icona del salone come servizio premium separato;
3. far aprire al cliente i propri account Apple e Google e farsi invitare come amministratori tecnici;
4. pubblicare da quegli account una build configurata per il singolo salone, con contenuti, scheda store e documentazione specifici;
5. non promettere un collegamento generico a “qualsiasi gestionale”: vendere prima un'analisi di compatibilità e poi connettori per sistemi supportati.

Il pacchetto più alto non deve essere descritto come “costruiamo un gestionale” partendo da zero. Salon Suite possiede già agenda, servizi, operatori, clienti, prodotti, ordini, campagne, coupon, fidelity e report. È più corretto posizionarlo come **gestionale operativo Salon Suite**, distinguendolo dalla componente fiscale e contabile, che richiede integrazioni e responsabilità ulteriori.

## Che cosa fanno realmente i due concorrenti

### BeautyCheck

BeautyCheck dichiara un'app con logo, immagini e colori del salone, disponibile su App Store e Google Play, collegata al proprio gestionale per prenotazioni, promozioni, novità e area personale.^1

Le tracce pubbliche confermano che esistono app separate per singole attività. Su Google Play, per esempio, “Gentleman Jack Barber shop”, “Beauty Bar”, “Irene M” e altre app sono pubblicate dallo stesso sviluppatore, Info-lan/BeautyCheck.^2 Su App Store è presente “Salone Lido”, anch'essa pubblicata da InfoLan e con identità e contenuti del salone.^3

Questo indica un'architettura white-label classica: una base di codice comune, configurazioni o build diverse per cliente, un backend multi-tenant e una pipeline di pubblicazione che genera icona, nome, immagini, identificativo dell'app e contenuti specifici.

### BarberApp Pro

BarberApp Pro dispone anzitutto di una sola app gestionale principale, pubblicata da Micrologic/Softwareline, con prenotazioni, analisi, pagamenti e marketing.^4 Nel listino, però, offre anche un'“App Personalizzata” su richiesta, con nome, logo e colori del salone, pubblicazione e aggiornamenti inclusi.^5

Esistono inoltre schede App Store dedicate a singoli saloni. “Acconciature Claudio”, per esempio, è pubblicata da Micrologic, offre prenotazione e notifiche per quella specifica attività ed esiste dal 2017, con aggiornamenti successivi.^6 La lunga anzianità della scheda può aver facilitato la continuità del prodotto; non prova che ogni nuova app identica verrebbe approvata oggi.

Il listino pubblico di BarberApp Pro parte da €24,90/mese, arriva a €69,90/mese per cassa, magazzino e shop, e quota separatamente l'app personalizzata. La stampante fiscale è proposta a €750 una tantum.^5 Questo è un segnale commerciale importante: persino un concorrente strutturato non include la pubblicazione white-label negli abbonamenti standard.

## Perché gli store possono approvare queste app

### Apple App Store

La regola Apple 4.2.6 non vieta in assoluto i template. Dice che un'app creata tramite template commerciale o servizio di generazione verrà rifiutata **a meno che sia presentata direttamente dal fornitore dei contenuti dell'app**. Apple aggiunge due indicazioni:

- il servizio non dovrebbe pubblicare app per conto dei clienti dal proprio account;
- in alternativa può pubblicare un'unica app aggregatrice che ospita più clienti.^7

La lettura operativa più prudente è quindi:

- il salone apre un account Apple Developer come propria organizzazione;
- il salone rimane titolare dell'app e del marchio;
- Salon Suite viene invitata nel team e cura build, invio, aggiornamenti e assistenza;
- l'app deve avere funzionalità adeguate, contenuti reali e un'esperienza che vada oltre una semplice WebView o materiale promozionale.^7

L'iscrizione Apple Developer costa attualmente 99 USD l'anno; per un'organizzazione serve la verifica della persona giuridica e normalmente un numero D‑U‑N‑S.^8 Questo costo dovrebbe essere a carico del salone o esplicitamente ribaltato nel canone.

Una sola app “Salon Suite”, nella quale l'utente seleziona o apre direttamente il proprio salone, è la variante con il rischio minore di duplicazione. Ha però uno svantaggio commerciale: nello store non compare il marchio del singolo barbiere come app autonoma.

Le app non elencate tramite link diretto non risolvono il problema: passano comunque da App Review e devono rispettare le stesse regole. Le Custom Apps tramite Apple Business Manager sono pensate soprattutto per distribuzione privata a organizzazioni e dipendenti, non per i clienti consumer di una barberia.^9

### Google Play

Google ha pubblicato una guida specifica per gli sviluppatori white-label. Riconosce sia il modello centralizzato sia quello decentralizzato, ma raccomanda il secondo: **un account sviluppatore per ogni cliente**, sul quale il fornitore white-label può mantenere accesso amministrativo.^10

La ragione è anche di contenimento del rischio. Se molte app sono nello stesso account e una genera una violazione, le conseguenze possono estendersi a tutte le altre. Google richiede inoltre schede store uniche, icone, immagini, screenshot e descrizioni specifiche, e valore derivante da contenuti o servizi realmente distinti.^10

La registrazione Google Play costa attualmente 25 USD una tantum nell'area SEE.^11

### Perché BeautyCheck e BarberApp possono usare account centralizzati

Dall'esterno non è possibile conoscere le comunicazioni intercorse durante la revisione, le autorizzazioni consegnate, gli accordi con i saloni o eventuali eccezioni. Le spiegazioni plausibili, che possono coesistere, sono:

- le app sono considerate abbastanza specifiche per contenuti e servizi;
- il fornitore documenta le licenze sui marchi e l'autorizzazione dei saloni;
- alcune schede sono storiche e sono state mantenute nel tempo;
- le regole vengono applicate caso per caso e non in modo perfettamente uniforme;
- su Google il modello centralizzato è ammesso, anche se sconsigliato.

La presenza di un concorrente nello store dimostra che la pubblicazione è possibile, ma **non garantisce** che una nuova serie di cloni con solo logo e colori diversi venga approvata o resti al sicuro nel tempo.

## Architettura consigliata per Salon Suite

### Prodotto standard: PWA per singolo salone

Il progetto è già predisposto come SaaS multi-tenant e ogni installazione pubblica può risolvere un solo `salonId`. La PWA può avere dominio, logo, colori, immagini e manifest dedicati. È installabile dalla schermata iniziale e consente aggiornamenti immediati senza revisione degli store.

Questo deve rimanere il prodotto con margine migliore e minore complessità operativa.

### Add-on premium: app nativa white-label

La PWA React può essere confezionata con un contenitore nativo, per esempio Capacitor, mantenendo il backend condiviso. Ogni cliente avrà:

- bundle identifier/package name distinto;
- configurazione fissa del tenant;
- nome, icona, splash screen e palette propri;
- Universal Link/App Link dal dominio del salone;
- notifiche push e permessi configurati per quella build;
- scheda store, privacy policy e screenshot propri;
- account sviluppatore intestato al cliente.

La build non dovrebbe limitarsi a una WebView. Conviene integrare almeno notifiche native, deep link, condivisione, gestione offline minima, biometria o Wallet/QR dove utile. Questo rafforza il valore “app-like” richiesto da Apple.

### Alternativa economica: app unica Salon Suite

Una sola app nativa può aprire automaticamente il tenant tramite link o codice del salone e applicarne il branding dopo l'accesso. Riduce drasticamente costi, revisioni e manutenzione, ma non offre al salone nome e icona autonomi nello store. È adatta come seconda fase, quando il numero di clienti rende poco sostenibile mantenere molte build.

## Collegamento al gestionale esistente

La proposta è valida, ma non va inserita nel piano medio come promessa illimitata. “Collegamento al gestionale” può significare tre lavori molto diversi:

| Livello | Cosa fa | Complessità |
|---|---|---|
| Importazione iniziale | Importa clienti, servizi, operatori e appuntamenti da CSV/Excel | Bassa |
| Sincronizzazione singola | Il gestionale resta fonte principale; Salon Suite legge disponibilità e invia nuove prenotazioni | Media |
| Sincronizzazione bidirezionale | Creazioni, spostamenti, cancellazioni e anagrafiche viaggiano in entrambe le direzioni | Alta |

La sincronizzazione è fattibile solo se il fornitore del gestionale mette a disposizione almeno uno tra API documentate, webhook, accesso autorizzato al database o export/import affidabili. Senza questi strumenti si rischiano automazioni fragili, doppie prenotazioni e dipendenza da modifiche non controllabili del software terzo.

Prima di fare un prezzo bisogna chiedere:

1. nome e versione esatta del gestionale;
2. documentazione API e contatto tecnico del fornitore;
3. disponibilità di un ambiente di test;
4. quali dati possono essere letti e scritti;
5. costi o limiti API;
6. quale sistema è la fonte ufficiale per agenda, clienti, servizi e pagamenti;
7. modalità di recupero in caso di errore o disallineamento.

Il connettore deve usare identificativi esterni, operazioni idempotenti, log di sincronizzazione, tentativi automatici e una schermata di riconciliazione. Per i dati personali vanno inoltre chiariti ruoli privacy, autorizzazioni, conservazione e cancellazione.

## Il “gestionale interno” è già in buona parte costruito

Salon Suite dispone già di:

- agenda e prenotazioni;
- servizi, prezzi, operatori e orari;
- anagrafica clienti e storico sintetico;
- catalogo prodotti e ordini;
- fidelity, coupon e campagne;
- segmentazione e recupero clienti;
- KPI e console multi-salone.

Per il mercato questo è già un gestionale operativo. Le lacune rispetto ai concorrenti più maturi sono soprattutto:

- giacenze, carichi/scarichi, fornitori e barcode;
- cassa operativa, chiusure e metodi di pagamento;
- integrazione con registratore telematico certificato;
- fatture/corrispettivi o esportazione verso il commercialista;
- turni, presenze, commissioni e obiettivi del personale;
- pacchetti prepagati, gift card e abbonamenti;
- migrazione dati e connettori verso sistemi esterni;
- audit, backup, esportazione e assistenza operativa da prodotto maturo.

È opportuno chiamare il prodotto “gestionale operativo” finché non sono completate e certificate le funzioni fiscali. La cassa fiscale non è solo una schermata: coinvolge hardware certificato, integrazione, assistenza e continuità di servizio.

## Proposta commerciale consigliata

### START — €49/mese

- PWA personalizzata con dominio, logo, colori e immagini;
- prenotazione, agenda, servizi e operatori;
- limiti attuali di operatori/clienti;
- report essenziali.

### STUDIO CONNECT — €79/mese + attivazione

- tutto START;
- fidelity, prodotti, ordini e campagne;
- importazione iniziale standard CSV inclusa;
- **analisi di compatibilità** con il gestionale esistente inclusa;
- connettore disponibile solo per gestionali già supportati;
- sviluppo di un nuovo connettore quotato separatamente.

Formula contrattuale suggerita:

> Integrazione con gestionali compatibili tramite API o procedure di scambio dati disponibili. La compatibilità viene verificata prima dell'attivazione. Eventuali connettori personalizzati, licenze del fornitore terzo e attività di migrazione straordinaria sono quotati separatamente.

Una fascia ragionevole da validare sul primo progetto è €490–€1.500 una tantum per un connettore semplice, più €20–€60/mese per monitoraggio e manutenzione. Un'integrazione bidirezionale complessa va preventivata a progetto, non assorbita nel canone da €79.

### PRO MANAGEMENT — €129/mese + attivazione

- gestionale operativo Salon Suite come fonte principale;
- clienti e operatori senza i limiti del piano medio;
- magazzino e movimenti quando completati;
- cassa operativa e report avanzati;
- pacchetti, gift card, commissioni e funzioni gestionali evolute man mano che vengono rilasciate;
- esportazioni per commercialista;
- priorità nell'assistenza.

L'integrazione fiscale o con registratore telematico va mantenuta come modulo separato fino a quando esiste un partner/hardware certificato e un processo di assistenza definito.

### APP STORE WHITE-LABEL — add-on separato

Non conviene includerlo automaticamente in STUDIO o PRO. Una struttura sostenibile può essere:

- attivazione, preparazione asset e pubblicazione: da €790–€1.490 una tantum;
- manutenzione store e build: €25–€50/mese oppure €300–€600/anno;
- account Apple e Google intestati e pagati dal salone;
- approvazione soggetta alle regole degli store, mai garantita contrattualmente;
- tempi di revisione e richieste di modifica esclusi dagli SLA ordinari.

## Cambiamento consigliato nel processo vendita

Il primo incontro non è stato un fallimento: ha rivelato una domanda di qualificazione che deve arrivare nei primi cinque minuti.

Prima della demo chiedere sempre:

> Oggi usate già un gestionale o un sistema di prenotazione? Quale? Volete sostituirlo oppure mantenerlo e collegarlo?

Da qui partono tre percorsi:

- **nessun gestionale** → vendita diretta di Salon Suite;
- **gestionale sostituibile** → demo più piano di migrazione;
- **gestionale da mantenere** → verifica API e proposta di integrazione.

In questo modo il gestionale esistente non emerge come obiezione finale: diventa il criterio con cui si sceglie la proposta corretta.

## Conclusione

Salon Suite può offrire app personalizzate sugli store, ma dovrebbe farlo con account decentralizzati intestati ai saloni e come servizio premium. Copiare il modello centralizzato visibile in alcuni concorrenti espone l'intero portafoglio a un rischio evitabile.

Sul piano commerciale, la priorità non è costruire un altro prodotto da zero. È:

1. presentare correttamente le funzioni gestionali già esistenti;
2. creare un processo di compatibilità e integrazione;
3. completare gradualmente magazzino, cassa operativa ed export;
4. separare l'add-on store dal normale abbonamento.

## Fonti

1. BeautyCheck, [App personalizzata per centri estetici, saloni e centri medici](https://www.beautycheck.it/app-personalizzata/); [Software per parrucchieri e barber shop](https://www.beautycheck.it/software-parrucchieri/).
2. Google Play, [Gentleman Jack Barber shop](https://play.google.com/store/apps/details?id=it.infolan.gentlemanjack); [Beauty Suite](https://play.google.com/store/apps/details?id=it.infolan.beautysuite).
3. Apple App Store, [Salone Lido](https://apps.apple.com/it/app/salone-lido/id6748604718).
4. Apple App Store, [BarberApp Pro](https://apps.apple.com/it/app/barberapp-pro/id1491592321); Google Play, [BarberApp Pro](https://play.google.com/store/apps/details?id=com.softwareline.barberappserver).
5. BarberApp Pro, [Prezzi](https://www.barberapppro.it/prezzi.html); [Funzionalità](https://www.barberapppro.it/funzionalita.html).
6. Apple App Store, [Acconciature Claudio](https://apps.apple.com/it/app/barbiere/id1227016966).
7. Apple Developer, [App Review Guidelines, sezione 4.2 e regola 4.2.6](https://developer.apple.com/app-store/review/guidelines/).
8. Apple Developer, [Apple Developer Program — iscrizione e costi](https://developer.apple.com/programs/enroll/).
9. Apple Developer, [Unlisted App Distribution](https://developer.apple.com/support/unlisted-app-distribution); [Set distribution methods](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/set-distribution-methods).
10. Google Play Console Help, [Best Practices for White Label Developers](https://support.google.com/googleplay/android-developer/answer/15884185?hl=en).
11. Google Play Console Help, [General conditions of access for Google Play in the EEA](https://support.google.com/googleplay/android-developer/answer/14659200?hl=en).
