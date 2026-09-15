# Backlog revisione prodotto

Data raccolta: 15 settembre 2026  
Stato: osservazioni registrate, sviluppo non ancora avviato

Queste note derivano da un controllo diretto della demo dopo il rinnovamento grafico. Le modifiche elencate in questo documento devono essere affrontate in un ciclo successivo. L'obiettivo è migliorare leggibilità, profondità dei dati e operatività senza cambiare la struttura generale già approvata.

## Dashboard iniziale

- La sezione nel complesso è approvata.
- Correggere il grafico **Settimana corrente**: la barra del martedì, associata a € 106,00, arriva sopra la cifra e ne riduce la leggibilità.
- Garantire sempre uno spazio di sicurezza tra barre, etichette e valori, anche quando un giorno ha un valore molto più alto degli altri.
- Ricontrollare overflow e sovrapposizioni con valori più lunghi o picchi molto elevati.

## Agenda

- Le tre viste sono complessivamente approvate, ma serve un controllo degli allineamenti.
- Gli appuntamenti molto brevi, per esempio dalle 14:00 alle 14:20, non hanno abbastanza spazio verticale per mostrare correttamente le informazioni.
- Non lasciare testi tagliati senza un modo per recuperarli.
- Soluzione preferita da valutare: anteprima completa al passaggio del mouse su desktop e al tocco su mobile.
- L'anteprima deve mostrare almeno orario completo, cliente, servizio, operatore e stato.
- Valutare anche una modalità compatta per gli eventi brevi: orario e iniziali nella timeline, dettaglio completo nell'anteprima.
- Controllare che eventi adiacenti, sovrapposti o di durata minima non provochino disallineamenti.

## Statistiche

- Conservare i periodi da 30, 90 e 180 giorni.
- Aggiungere un'opzione **Periodo personalizzato** con data iniziale e data finale.
- Il periodo personalizzato deve aggiornare KPI, servizi, prodotti, mappa della domanda e Fidelity.
- Le sezioni approfondite devono poter ricevere un filtro proveniente dalle pagine Team, Servizi e Prodotti.

## Clienti

- Il numero totale di prenotazioni non è sufficiente come dettaglio cliente.
- Cliccando su un cliente deve aprirsi una scheda con lo storico cronologico delle attività.
- Mostrare almeno:
  - date delle visite e delle prenotazioni;
  - servizi eseguiti;
  - prodotti acquistati;
  - importi spesi;
  - operatore che ha eseguito il servizio;
  - eventuali coupon utilizzati;
  - punti Fidelity guadagnati e riscattati;
  - visite registrate manualmente al banco.
- Prevedere filtri nello storico per periodo e tipologia di attività.

## Servizi

- Aggiungere il pulsante **Modifica** su ogni servizio.
- Consentire di modificare titolo, descrizione, immagine, durata e prezzo senza dover eliminare e ricreare il servizio.
- Aggiungere un comando **Attiva / Disattiva** distinto dall'eliminazione.
- Un servizio disattivato deve rimanere nello storico e nelle statistiche, ma non deve essere prenotabile dal cliente.
- Inserire nella pagina un riepilogo sintetico delle prestazioni del servizio.
- Il riepilogo deve essere cliccabile e aprire la sezione Statistiche con quel servizio già selezionato.

## Team

- Rendere esplicito il periodo a cui si riferiscono clienti serviti, fatturato e ticket medio.
- Conservare nella pagina Team un riepilogo compatto delle statistiche di ogni operatore.
- Il riepilogo deve essere cliccabile e aprire la sezione Statistiche con l'operatore già selezionato.
- Nella sezione Statistiche creare un approfondimento operatore con:
  - prenotazioni e visite concluse;
  - andamento rispetto al periodo precedente;
  - fatturato servizi e prodotti;
  - ticket medio;
  - occupazione;
  - cancellazioni e no-show;
  - servizi più eseguiti;
  - prodotti più venduti;
  - clienti acquisiti e clienti ritornati.

## Orari

- La pagina è approvata e non richiede modifiche in questo ciclo.

## Prodotti

- Inserire nella pagina un riepilogo sintetico delle prestazioni di ogni prodotto.
- Il riepilogo deve essere cliccabile e aprire la sezione Statistiche con il prodotto già selezionato.
- Valutare gli stessi comandi gestionali dei servizi: modifica e attivazione/disattivazione, mantenendo lo storico delle vendite.

## Ordini

- La pagina nel complesso è approvata.
- Aggiungere una data di ritiro indicativa all'ordine.
- Consentire al salone di inserire o aggiornare la data prevista.
- Mostrare la data sia nel dettaglio ordine sia, in forma compatta, nella lista.
- La data deve essere presentata come indicativa e distinta dallo stato dell'ordine.

## Marketing

### Riempi agenda

- Correggere contrasto, leggibilità e allineamenti dei testi e dei campi.
- Oltre allo sconto percentuale su un servizio, aggiungere più tipi di promozione:
  - sconto percentuale su un prodotto;
  - sconto fisso su un prodotto;
  - prodotto in omaggio;
  - prodotto in omaggio al raggiungimento di una spesa minima.
- Rendere sempre chiari giorno, fascia oraria, servizio o prodotto coinvolto e condizioni dell'offerta.

### Clienti specifici

- Eliminare il lungo elenco completo di clienti dalla schermata principale.
- Sostituirlo con un campo di ricerca adatto anche a 1.000–2.000 clienti.
- Cercare per nome, email e telefono.
- Mostrare risultati progressivi e consentire la selezione multipla.
- Mantenere visibili i clienti già selezionati come elementi rimovibili, senza perdere la ricerca corrente.

### Controllo UI

- Rivedere allineamenti, distanze e gerarchia di tutta la pagina Marketing.
- Verificare il contrasto di ogni testo sui pannelli colorati e scuri.

## Fidelity

- La sezione è approvata al primo controllo.
- Nessuna modifica prioritaria in questo ciclo.

## Cassa e integrazioni

- La sezione è approvata per la demo.
- Le integrazioni reali con casse e sistemi fiscali verranno affrontate più avanti.

## Importazione dati

- La sezione è approvata al primo controllo.

## Assistenza

- La sezione è approvata al primo controllo.

## Onboarding, tutorial e documentazione

Da progettare in una fase successiva:

- tutorial guidato al primo accesso del titolare;
- possibilità di saltare il tutorial e riaprirlo successivamente;
- tour contestuale delle sezioni principali;
- checklist iniziale per configurare salone, orari, servizi, team, prodotti, Fidelity e notifiche;
- manuale completo di utilizzo;
- manuale consultabile per argomento e ricercabile;
- contenuti aggiornabili senza dover pubblicare una nuova versione dell'app;
- collegamenti diretti dal manuale alle sezioni interessate;
- eventuali brevi video o animazioni per le operazioni più complesse.

## Ordine suggerito per il prossimo ciclo

1. Correzioni visive rapide: grafico settimanale, testi Marketing e allineamenti Agenda.
2. Gestione degli appuntamenti brevi con anteprima desktop/mobile.
3. Periodo personalizzato e navigazione contestuale verso Statistiche.
4. Scheda cliente con storico completo.
5. Modifica e attivazione/disattivazione di servizi e prodotti.
6. Data di ritiro degli ordini.
7. Nuovi tipi di promozione e ricerca scalabile dei clienti.
8. Progettazione del tutorial e del manuale d'uso.
