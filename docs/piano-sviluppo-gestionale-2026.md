# Piano di sviluppo — da Salon Suite a gestionale completo

Data: 12 settembre 2026
Stato: in sviluppo — secondo incremento consegnato
Prodotto di partenza: Salon Suite Platform

## Avanzamento

Completato nel primo incremento del 12 settembre 2026:

- stati appuntamento `completata` e `no_show`;
- chiusura server-side idempotente dell'appuntamento;
- vendita autorevole generata dalla prenotazione completata;
- attribuzione all'operatore che ha eseguito il servizio;
- statistiche operatori per 30 giorni, 90 giorni o intero periodo;
- clienti serviti, unici e acquisiti, fatturato, prodotti e ticket medio;
- importazione CSV con anteprima e deduplicazione per clienti, servizi, operatori e prodotti;
- test unitari, build frontend/backend e test sugli emulatori Firebase.

Completato nel secondo incremento del 12 settembre 2026:

- prenotazioni da 1 a 5 servizi, con durata e prezzo aggregati lato server;
- snapshot della sequenza dei servizi salvato nella prenotazione e riportato in agenda;
- vendita finale con una riga distinta per ogni servizio eseguito;
- serie settimanali da 4 o 8 appuntamenti, validate e create atomicamente;
- ricerca dello stesso orario disponibile per tutte le date della serie;
- lista d'attesa cliente idempotente per data, operatore e combinazione di servizi;
- notifica ed e-mail automatica soltanto quando torna disponibile una fascia compatibile;
- regole Firestore e test emulatori per isolamento, atomicità e notifiche.

Prossimo incremento previsto: completamento Agenda 2.0 con modifica serie, drag-and-drop, coda walk-in, risorse e stati operativi; a seguire comunicazioni WhatsApp/SMS.

Le osservazioni emerse dalla revisione della demo del 14 settembre 2026 sono raccolte in [`backlog-revisione-prodotto-2026-09-14.md`](./backlog-revisione-prodotto-2026-09-14.md). Comprendono il redesign delle viste agenda e nuovi approfondimenti statistici per operatori, prodotti, servizi, coupon e fidelity.

## 1. Obiettivo

Portare Salon Suite dall'attuale combinazione di app cliente, prenotazioni, marketing e fidelity a un sistema che possa diventare il gestionale principale di una barberia o di un salone.

Il risultato atteso deve permettere a un titolare di:

- gestire l'intero ciclo dalla prenotazione all'incasso;
- conoscere ricavi, costi, margini e andamento degli operatori;
- gestire scorte, prodotti, pacchetti, crediti e pagamenti;
- ridurre no-show e lavoro telefonico;
- importare i dati dal sistema precedente o collegarlo quando tecnicamente possibile;
- offrire ai clienti un'esperienza realmente white-label.

## 2. Decisioni di perimetro

### Incluse

- statistiche commerciali per operatore;
- disponibilità, ferie e indisponibilità necessarie all'agenda;
- multi-servizio, appuntamenti periodici, lista d'attesa e coda;
- promemoria WhatsApp/SMS/e-mail/push;
- cassa operativa, acconti, sospesi e pagamenti digitali;
- magazzino, consumi, fornitori e inventario;
- pacchetti, abbonamenti, gift card, credito e referral;
- schede tecniche cliente, fotografie e consensi;
- spese, marginalità e report gestionali;
- importazione, esportazione, API e connettori;
- integrazione fiscale tramite fornitori compatibili;
- app native white-label sugli store;
- moduli verticali e funzioni evolute successive.

### Escluse

- timbratura;
- rilevazione presenze;
- paghe e cedolini;
- gestione contrattuale HR;
- ferie intese come processo autorizzativo aziendale;
- controllo invasivo dei dipendenti.

Gli operatori rimangono risorse dell'agenda e centri di ricavo, non diventano dipendenti gestiti da un software HR.

## 3. Principi architetturali

### 3.1 Una vendita come fonte economica unica

Oggi prenotazioni, visite manuali e ordini prodotti sono flussi separati. Prima di costruire statistiche, magazzino e cassa va introdotta l'entità `sale` o `transaction`, che rappresenta una vendita chiusa.

Ogni vendita deve contenere:

- salone e sede;
- cliente, se identificato;
- appuntamento di origine, se presente;
- operatore responsabile;
- righe servizio e righe prodotto;
- quantità, prezzo di listino, sconto e prezzo finale;
- imposte e dati fiscali eventualmente restituiti dal provider;
- uno o più pagamenti;
- eventuali pacchetti, gift card, credito o coupon utilizzati;
- stato: bozza, aperta, pagata, parzialmente pagata, annullata, rimborsata;
- timestamp e utente che ha effettuato ogni operazione.

Da questa entità derivano fatturato, ticket medio, prodotti venduti, performance degli operatori, fidelity e movimenti di magazzino.

### 3.2 Attribuzione esplicita

Per evitare statistiche ambigue si distinguono:

- `bookedOperatorId`: operatore scelto in prenotazione;
- `performedByOperatorId`: operatore che ha realmente eseguito il servizio;
- `soldByOperatorId`: operatore che ha consigliato o venduto il prodotto;
- `acquiredByOperatorId`: operatore a cui viene attribuito un nuovo cliente;
- `createdByUserId`: chi ha registrato materialmente l'operazione.

Una stessa vendita può quindi contribuire correttamente alle statistiche di più persone senza confondere esecuzione, vendita e inserimento in cassa.

### 3.3 Eventi, idempotenza e audit

Pagamenti, messaggi, movimenti di magazzino, punti e pacchetti devono essere aggiornati tramite operazioni server-side idempotenti. Ogni modifica economica deve lasciare una traccia di audit e deve poter essere annullata con un movimento contrario, senza cancellare la storia.

### 3.4 Multi-tenant e autorizzazioni

Tutti i nuovi documenti devono rimanere sotto `salons/{salonId}` o contenere un tenant verificato lato server. Owner e staff operano esclusivamente nel proprio salone; il cliente vede soltanto dati e operazioni che lo riguardano.

### 3.5 Integrazioni sostituibili

WhatsApp, SMS, pagamenti, registratori telematici e gestionali esterni devono essere implementati tramite adapter. Il dominio non deve dipendere direttamente da un unico fornitore.

## 4. Modello dati previsto

Collezioni principali nuove o da estendere:

```text
salons/{salonId}
  locations/{locationId}
  clients/{clientId}
    technicalRecords/{recordId}
    consents/{consentId}
  bookings/{bookingId}
    items/{bookingItemId}
  waitlistEntries/{entryId}
  sales/{saleId}
    payments/{paymentId}
  expenses/{expenseId}
  products/{productId}
  stockMovements/{movementId}
  suppliers/{supplierId}
  purchaseOrders/{purchaseOrderId}
  packages/{packageId}
  packageAccounts/{accountId}
    movements/{movementId}
  giftCards/{giftCardId}
    movements/{movementId}
  subscriptions/{subscriptionId}
  messageJobs/{jobId}
  messageEvents/{eventId}
  integrations/{integrationId}
  importJobs/{jobId}
  auditEvents/{eventId}
  dailyMetrics/{date}
  operatorMetrics/{operatorId_date}
```

La struttura definitiva andrà validata in una specifica tecnica prima di ciascun incremento. Le metriche aggregate non sostituiscono i dati sorgente: possono sempre essere ricalcolate.

## 5. Roadmap di sviluppo

Le stime sono espresse in settimane di lavoro di un singolo sviluppatore full-time già familiare con il progetto. Includono sviluppo, test automatici e correzione, ma non i tempi commerciali dei fornitori esterni o l'approvazione degli store.

### Fase 0 — Fondazioni economiche e osservabilità

Durata stimata: 2–3 settimane
Prerequisiti: nessuno
Sblocca: cassa, pagamenti, magazzino, statistiche, pacchetti

#### Attività

- introdurre il ciclo di vita dell'appuntamento `completato` e `no_show`;
- progettare `sales`, righe vendita e pagamenti;
- collegare prenotazioni, visite manuali e ordini a una vendita;
- introdurre l'attribuzione agli operatori;
- creare audit log per operazioni economiche;
- definire timezone, arrotondamenti, valuta e importi in centesimi;
- predisporre indici Firestore e regole di sicurezza;
- predisporre job ricalcolabili per metriche giornaliere;
- aggiungere emulator test per isolamento tenant, doppio invio e concorrenza.

#### Criteri di completamento

- una visita può essere completata e trasformata una sola volta in vendita;
- una vendita può contenere più servizi e prodotti;
- annullamento e rimborso non cancellano lo storico;
- fatturato e quantità vendute derivano dalla vendita pagata, non dall'appuntamento prenotato;
- ogni operazione sensibile è tracciata.

### Fase 1 — Portabilità dati e onboarding

Durata stimata: 2–3 settimane
Prerequisiti: Fase 0 per l'import delle transazioni; l'anagrafica può partire prima

#### Attività

- importazione guidata CSV/Excel di clienti, servizi, operatori e prodotti;
- modelli scaricabili e mappatura delle colonne;
- anteprima, validazione e report degli errori prima della conferma;
- deduplicazione per e-mail, telefono o identificativo esterno;
- salvataggio di `externalId` e sorgente di provenienza;
- import asincrono riprendibile e idempotente;
- esportazione completa di clienti, servizi, appuntamenti, vendite e prodotti;
- registro degli import con esito e righe rifiutate;
- onboarding iniziale con configurazione assistita.

#### Criteri di completamento

- un titolare può provare l'import senza modificare dati;
- ripetere lo stesso file non crea duplicati;
- gli errori sono scaricabili e correggibili;
- il cliente può esportare i propri dati senza intervento tecnico.

### Fase 2 — Agenda 2.0

Durata stimata: 4–5 settimane
Prerequisiti: Fase 0

#### Attività

- prenotazioni con più servizi;
- sequenza dei servizi anche con operatori differenti;
- appuntamenti periodici con modifica di singola occorrenza o serie;
- duplicazione e drag-and-drop con controllo conflitti server-side;
- lista d'attesa per servizio, operatore, giorno e fascia oraria;
- proposta automatica dello slot liberato;
- coda per clienti senza appuntamento;
- stati `arrivato`, `in_servizio`, `completato`, `no_show`;
- note interne e provenienza della prenotazione;
- politica di cancellazione configurabile;
- preparazione per cabine, postazioni o altre risorse.

#### Criteri di completamento

- non è possibile creare sovrapposizioni anche con richieste concorrenti;
- la durata complessiva rispetta tutti i servizi e le pause;
- una serie ricorrente non lascia prenotazioni parziali in caso di errore;
- il riempimento della lista d'attesa è tracciato;
- spostamenti e modifiche aggiornano disponibilità e comunicazioni.

### Fase 3 — Comunicazioni omnicanale e no-show

Durata stimata: 3–4 settimane
Prerequisiti: Agenda 2.0 consigliata; può iniziare sugli appuntamenti attuali

#### Attività

- motore di template per conferma, promemoria, modifica e cancellazione;
- scheduler server-side con timezone del salone;
- adapter e-mail, push, SMS e WhatsApp Business;
- opt-in, opt-out e preferenze per canale;
- webhook di consegna, errore, lettura e risposta quando disponibili;
- promemoria configurabili, per esempio 48 e 24 ore prima;
- link sicuro per confermare o annullare;
- campagne WhatsApp/SMS oltre alle attuali e-mail/push;
- budget, crediti e limiti per salone;
- dashboard dei costi e dei risultati dei messaggi;
- fallback di canale configurabile;
- automazioni per compleanno, inattività, pacchetto in scadenza e lista d'attesa.

#### Criteri di completamento

- un messaggio non viene inviato due volte;
- il salone vede stato, costo e motivazione degli errori;
- disiscrizione e consenso vengono rispettati;
- ogni link è firmato, ha scadenza e non espone dati personali;
- il costo variabile non può superare il limite configurato.

### Fase 4 — Cassa operativa, pagamenti e acconti

Durata stimata: 4–6 settimane
Prerequisiti: Fase 0; coordinamento con Agenda 2.0

#### Attività

- schermata conto a partire dall'appuntamento;
- aggiunta di servizi e prodotti al banco;
- modifica controllata di prezzi, quantità e sconti;
- pagamenti multipli e misti: contanti, carta, bonifico, gift card, credito;
- acconti e saldo finale;
- pagamenti sospesi e scadenze;
- ricevuta non fiscale interna;
- link di pagamento e checkout cliente;
- pagamento totale o deposito in prenotazione;
- regole per servizio, giornata o cliente a rischio no-show;
- rimborsi totali e parziali;
- riconciliazione webhook del provider;
- integrazione iniziale tramite account connessi, in modo che gli incassi vadano direttamente al salone;
- commissioni e storni visibili.

#### Criteri di completamento

- il server calcola sempre il totale definitivo;
- la vendita non viene pagata due volte se il webhook viene ripetuto;
- acconto, saldo e rimborso sono riconciliabili;
- il denaro del salone non transita impropriamente sul conto della piattaforma;
- le statistiche includono solo vendite contabilmente valide.

### Fase 5 — Magazzino e fornitori

Durata stimata: 4–5 settimane
Prerequisiti: Fasi 0 e 4

#### Attività

- estendere il prodotto con SKU, barcode, costo, prezzo, aliquota, fornitore e soglia minima;
- giacenze per sede;
- movimenti di carico, scarico, vendita, consumo interno, rettifica, reso e scarto;
- scarico automatico da una vendita;
- distinta di consumo opzionale per servizio;
- inventario fisico e rettifiche motivate;
- alert sottoscorta;
- anagrafica fornitori;
- ordini di acquisto e ricezione merce;
- valorizzazione della giacenza e margine lordo;
- import ed esportazione inventario;
- scansione barcode da fotocamera o lettore compatibile.

#### Criteri di completamento

- nessuna cancellazione diretta dei movimenti;
- annullare una vendita genera il movimento inverso;
- consumo e vendita sono distinguibili;
- la giacenza può essere ricostruita dai movimenti;
- quantità negativa bloccata o esplicitamente autorizzata secondo configurazione.

### Fase 6 — Pacchetti, abbonamenti, gift card e credito

Durata stimata: 4–5 settimane
Prerequisiti: Fasi 0 e 4

#### Attività

- pacchetti a numero di sedute;
- pacchetti a valore;
- scadenza e regole di utilizzo;
- scalaggio automatico al completamento del servizio;
- sospensione, rimborso e trasferimento controllati;
- abbonamenti ricorrenti con rinnovo e gestione mancato pagamento;
- gift card a valore o servizio;
- codici e QR monouso o a saldo;
- credito prepagato del cliente;
- cashback opzionale;
- programma “porta un amico” con attribuzione e anti-abuso;
- integrazione con l'attuale fidelity senza doppia premiazione;
- promemoria di credito o pacchetto in scadenza.

#### Criteri di completamento

- due casse non possono scalare contemporaneamente la stessa ultima seduta;
- tutti i residui hanno uno storico immutabile;
- scadenze, rimborsi e rinnovi sono coerenti con la vendita originaria;
- il titolare può vedere valore venduto, utilizzato e ancora da erogare.

### Fase 7 — Controllo economico e statistiche operatori

Durata stimata: 3–4 settimane
Prerequisiti: Fasi 0 e 4; magazzino necessario per margini completi

#### Registro economico

- spese con categoria, fornitore, data, metodo e allegato;
- costi ricorrenti;
- crediti e sospesi;
- chiusura giornaliera per metodo di pagamento;
- fatturato lordo, sconti, rimborsi e incassato;
- margine prodotti e, dove configurabile, margine servizi;
- utile gestionale stimato;
- confronto con periodo precedente;
- esportazione per il commercialista.

#### Scheda statistiche operatore

Per ogni operatore e per periodo selezionato:

- appuntamenti prenotati con lui;
- clienti realmente serviti;
- clienti unici;
- nuovi clienti acquisiti;
- clienti ritornati entro 30, 60 e 90 giorni;
- fatturato dei servizi eseguiti;
- fatturato e margine dei prodotti venduti;
- ticket medio;
- servizi medi per visita;
- tasso di occupazione delle ore disponibili;
- cancellazioni e no-show;
- sconti applicati;
- prodotti per cliente e tasso di cross-selling;
- confronto con periodo precedente;
- contributo percentuale al fatturato del salone.

#### Regole di attribuzione proposte

- un cliente è “acquisito” dall'operatore che esegue la sua prima visita pagata, salvo correzione del titolare;
- il fatturato servizi va all'operatore che esegue il servizio;
- il fatturato prodotti va all'operatore indicato come venditore;
- un appuntamento annullato non genera fatturato;
- un no-show viene conteggiato separatamente;
- un rimborso rettifica il periodo originario o viene mostrato separatamente, secondo il report;
- i costi generali del salone non vengono arbitrariamente assegnati all'operatore;
- il “profitto operatore” viene mostrato soltanto quando esistono costi attendibili, altrimenti si usa la dicitura “fatturato attribuito”.

#### Criteri di completamento

- ogni KPI apre il dettaglio dei dati che lo compongono;
- le metriche possono essere ricalcolate dai dati sorgente;
- cambio operatore, rimborso o annullamento aggiornano correttamente i risultati;
- il report distingue prenotato, servito, incassato e margine;
- il titolare può esportare il report.

### Fase 8 — Scheda cliente professionale e consensi

Durata stimata: 3–4 settimane
Prerequisiti: storage e regole tenant esistenti

#### Attività

- timeline completa di appuntamenti, vendite, prodotti, pacchetti e comunicazioni;
- note tecniche strutturate e campi personalizzabili;
- fotografie prima/dopo;
- formule colore e prodotti utilizzati;
- preferenze, allergie e controindicazioni;
- provenienza e fonte di acquisizione;
- tag e segmenti;
- consensi versionati;
- invio, accettazione e revoca dei consensi;
- firme elettroniche tramite provider dedicato, se richieste;
- policy di conservazione ed eliminazione.

#### Criteri di completamento

- i dati sensibili non sono esposti nell'app pubblica;
- ogni consenso conserva testo, versione, data e prova di accettazione;
- fotografie e allegati rispettano le regole tenant;
- campi eliminati non distruggono lo storico già registrato.

### Fase 9 — API e connettori con gestionali esterni

Durata piattaforma: 3–4 settimane
Durata per connettore: 2–6 settimane, variabile per gestionale
Prerequisiti: modello stabile di clienti, agenda e vendite

#### Attività piattaforma

- catalogo delle integrazioni supportate;
- credenziali cifrate e ruotate;
- adapter per clienti, servizi, operatori, appuntamenti, prodotti e vendite;
- sincronizzazione iniziale e incrementale;
- webhooks in ingresso e in uscita;
- code, retry, dead-letter queue e riconciliazione;
- tabella di mapping degli identificativi;
- log comprensibile dal supporto;
- strumenti per ripetere o risolvere i conflitti;
- modalità sola importazione, monodirezionale o bidirezionale.

#### Processo commerciale obbligatorio

Prima di promettere un collegamento:

1. identificare nome e versione del gestionale;
2. verificare API, webhooks, esportazioni e condizioni commerciali;
3. definire il sistema proprietario per ogni dato;
4. costruire una matrice campi e conflitti;
5. effettuare una prova su ambiente sandbox;
6. quotare attivazione e manutenzione separatamente.

#### Criteri di completamento

- ripetere una sincronizzazione non duplica i dati;
- cancellazioni e modifiche concorrenti hanno regole esplicite;
- errori e record non sincronizzati sono visibili;
- una disconnessione non blocca l'agenda principale;
- è disponibile una procedura di uscita e riesportazione.

### Fase 10 — Fiscale e registratore telematico

Durata stimata: 4–8 settimane per la prima integrazione
Prerequisiti: Fase 4
Dipendenza esterna: produttore o provider fiscale

#### Attività

- selezione di un provider o di modelli RT ufficialmente compatibili;
- adapter fiscale separato dalla vendita interna;
- invio dello scontrino e ricezione esito;
- stampa, annullamento e gestione errori;
- memorizzazione dei riferimenti restituiti dal dispositivo/provider;
- riconciliazione tra vendite e documenti fiscali;
- chiusura e report giornaliero dove supportati;
- esportazione verso fatturazione elettronica o commercialista;
- permessi e audit rafforzati;
- modalità degradata quando il dispositivo è offline.

#### Criteri di completamento

- il software non dichiara una vendita fiscalizzata senza esito positivo;
- i retry non generano doppi documenti;
- annullamenti e rimborsi seguono il flusso previsto dal provider;
- compatibilità, prerequisiti hardware e responsabilità sono documentati.

Nota: la logica fiscale non va reinventata internamente. Deve essere demandata a dispositivi e fornitori compatibili, con verifica normativa prima della commercializzazione.

### Fase 11 — App native white-label e automazione store

Durata piattaforma iniziale: 5–7 settimane
Durata operativa per nuovo salone dopo l'automazione: 1–3 giorni più revisione store
Prerequisiti: app cliente stabile e processo di branding consolidato

#### Attività

- contenitore mobile della web app o client nativo condiviso;
- configurazione remota per tenant;
- bundle identifier, nome, icone, splash screen e deep link per salone;
- notifiche push e registrazione token robuste;
- pipeline di build, firma e pubblicazione;
- account sviluppatore della piattaforma o del cliente secondo il modello scelto;
- privacy label, schermate store e metadati;
- aggiornamenti centralizzati e monitoraggio versioni;
- strategia di conformità contro app troppo simili o duplicate;
- fallback PWA qualora una pubblicazione venga rifiutata.

#### Criteri di completamento

- nessun dato di un salone compare nell'app di un altro;
- deep link e notifiche aprono il tenant corretto;
- chiavi e certificati non sono nel repository;
- esiste una checklist ripetibile per pubblicazione e aggiornamento;
- i costi annuali e le responsabilità dell'account sono espliciti nel contratto.

### Fase 12 — Multi-sede, risorse e verticali professionali

Durata stimata: 5–7 settimane
Prerequisiti: Fasi 0, 2, 4 e 5

#### Attività

- più sedi sotto la stessa organizzazione;
- operatori assegnabili a una o più sedi;
- listini, magazzini e orari per sede;
- trasferimenti di stock;
- report consolidati e per sede;
- cabine, poltrone, postazioni e macchinari prenotabili;
- tempi di posa e intervalli tra fasi del servizio;
- distinta prodotti per trattamento;
- preventivi con accettazione e conversione in vendita/pacchetto;
- moduli verticali attivabili senza appesantire le barberie semplici.

### Fase 13 — Acquisizione e automazione avanzata

Durata stimata: 4–8 settimane, dipendente dai partner
Prerequisiti: agenda e API stabili

#### Attività

- widget incorporabile nel sito;
- link prenotazione per social;
- integrazione con profilo Google e canali supportati;
- richiesta recensione dopo la visita;
- tracciamento della fonte di acquisizione;
- campagne automatiche basate su comportamento e valore cliente;
- assistente WhatsApp per disponibilità, prezzi e prenotazione;
- eventuale assistente telefonico;
- passaggio a un operatore umano;
- guardrail: nessuna conferma senza verifica server-side della disponibilità.

Il marketplace multi-salone resta opzionale. Non è necessario per competere come soluzione white-label e potrebbe indebolire la promessa di esclusività.

## 6. Ordine di rilascio commerciale

### Milestone A — Migrazione e riduzione no-show

Contenuto:

- import/export;
- appuntamenti periodici;
- lista d'attesa;
- WhatsApp/SMS;
- completato e no-show;
- prime metriche operatore su prenotazioni e clienti serviti.

Valore: elimina molto lavoro manuale e rende più semplice provare Salon Suite senza perdere l'anagrafica precedente.

### Milestone B — PRO Gestionale Core

Contenuto:

- vendita unica;
- cassa operativa;
- pagamenti e acconti;
- magazzino;
- pacchetti e gift card;
- statistiche operatori complete;
- spese e report economici.

Valore: permette a molti piccoli e medi saloni di usare Salon Suite come gestionale principale.

### Milestone C — Gestionale connesso

Contenuto:

- API;
- primo connettore esterno;
- integrazione fiscale;
- app store white-label automatizzata.

Valore: copre clienti già strutturati e sostiene attivazione e canone premium.

### Milestone D — Scala e verticali

Contenuto:

- multi-sede;
- risorse e cabine;
- schede tecniche evolute;
- preventivi;
- automazioni AI e acquisizione.

## 7. Sequenza suggerita e stima complessiva

| Ordine | Incremento | Stima |
|---:|---|---:|
| 1 | Fondazioni economiche | 2–3 settimane |
| 2 | Import/export | 2–3 settimane |
| 3 | Agenda 2.0 | 4–5 settimane |
| 4 | Comunicazioni e WhatsApp | 3–4 settimane |
| 5 | Cassa e pagamenti | 4–6 settimane |
| 6 | Magazzino | 4–5 settimane |
| 7 | Pacchetti, gift card e abbonamenti | 4–5 settimane |
| 8 | Controllo economico e operator analytics | 3–4 settimane |
| 9 | Schede tecniche e consensi | 3–4 settimane |
| 10 | Piattaforma integrazioni | 3–4 settimane |
| 11 | Primo connettore esterno | 2–6 settimane |
| 12 | Prima integrazione fiscale | 4–8 settimane |
| 13 | Automazione app native | 5–7 settimane |
| 14 | Multi-sede e verticali | 5–7 settimane |
| 15 | Acquisizione e AI | 4–8 settimane |

Non tutte le fasi devono essere completate prima di vendere il prodotto. Il primo traguardo realmente commerciale è la Milestone A; il traguardo per presentarsi come gestionale è la Milestone B.

Stima indicativa:

- Milestone A: 10–15 settimane sviluppatore;
- Milestone B cumulativa: 25–35 settimane sviluppatore;
- gestionale esteso con fiscale, store e primo connettore: 39–56 settimane sviluppatore;
- roadmap completa: 50–75 settimane sviluppatore.

Con un solo sviluppatore è ragionevole prevedere 10–15 mesi per il gestionale esteso, mantenendo nel frattempo il prodotto in produzione. Con due sviluppatori e responsabilità ben separate, la durata di calendario può scendere indicativamente a 6–9 mesi, ma pagamenti, fiscale e store rimangono dipendenti da soggetti esterni.

## 8. Strategia di test per ogni fase

Ogni incremento deve includere:

- test unitari delle regole di dominio;
- test delle Cloud Functions;
- test con emulatori Firebase e almeno due tenant;
- test di concorrenza per disponibilità, stock, punti e residui;
- test di idempotenza per webhooks, messaggi e pagamenti;
- test delle Firestore e Storage Rules;
- test UI dei flussi critici;
- migrazione o compatibilità dei dati esistenti;
- logging strutturato e procedura di rollback;
- dati demo aggiornati;
- documentazione operativa e commerciale aggiornata.

Nessuna funzione economica è completata se è stata verificata soltanto attraverso l'interfaccia grafica.

## 9. Metriche di prodotto

Per misurare il valore delle nuove funzioni:

- percentuale saloni che completano l'import;
- prenotazioni online sul totale;
- tempo medio impiegato a creare o spostare un appuntamento;
- tasso di conferma dei reminder;
- no-show prima e dopo l'attivazione;
- slot riempiti dalla lista d'attesa;
- percentuale appuntamenti trasformati in vendite;
- fatturato medio per visita;
- prodotti per vendita;
- utilizzo e rinnovo dei pacchetti;
- scarti e differenze inventariali;
- tempo di chiusura cassa;
- clienti nuovi e tasso di ritorno per operatore;
- utilizzo effettivo dei report operatori;
- errori di sincronizzazione per connettore;
- costo messaggi e pagamenti per salone;
- conversione da prova a piano pagante.

## 10. Decisioni da prendere prima dello sviluppo esterno

Prima di iniziare pagamenti, WhatsApp, fiscale e app store devono essere scelti:

- provider di pagamento e modello di account connessi;
- provider WhatsApp Business e SMS;
- modelli di registratore telematico o partner fiscale supportati;
- primo gestionale da integrare, scelto da una reale opportunità commerciale;
- titolarità degli account Apple e Google;
- trattamento contrattuale di commissioni, costi messaggi e hardware;
- criteri privacy e tempi di conservazione di schede tecniche, fotografie e consensi.

Queste decisioni non devono bloccare Fondazioni, Import/export e Agenda 2.0.

## 11. Primo incremento consigliato

Il primo ciclo di lavoro dovrebbe consegnare insieme:

1. stati `completato` e `no_show`;
2. modello vendita minimo per servizi e prodotti;
3. attribuzione dell'operatore effettivo e del venditore;
4. import clienti, servizi, operatori e prodotti;
5. dashboard operatore iniziale con clienti serviti, clienti unici, fatturato attribuito e ticket medio.

In questo modo si costruiscono subito le fondamenta corrette e si rende visibile la funzionalità operatori richiesta, senza implementare timbrature o moduli HR.
