# Backlog revisione prodotto

Data raccolta: 14 settembre 2026  
Stato: idee annotate, da progettare e sviluppare in una fase successiva

Queste note derivano da una revisione rapida della demo. Non rappresentano ancora specifiche definitive: prima dell'implementazione andranno trasformate in wireframe, requisiti dati e criteri di accettazione.

## Agenda

### Vista giorno

- Migliorare gerarchia e leggibilità degli appuntamenti.
- Valutare una rappresentazione più immediata di tempi liberi, sovrapposizioni e stato delle prenotazioni.
- Conservare la lista operativa senza farla competere visivamente con la timeline.

### Vista tre giorni

- Migliorare la scansione comparativa tra le giornate.
- Rendere più leggibili appuntamenti, disponibilità e carico degli operatori senza aumentare eccessivamente la densità.

### Vista settimana

- Ridisegnare la vista, attualmente troppo confusionaria.
- Ridurre il rumore visivo quando sono presenti molte prenotazioni.
- Valutare raggruppamenti, livelli di dettaglio progressivi o apertura del dettaglio su richiesta.

### Riepilogo delle prenotazioni di oggi

- L'informazione principale, per esempio “5 prenotazioni · lunedì 14 settembre”, deve rimanere evidente.
- Ridurre però lo spazio verticale occupato dall'attuale blocco.
- Cercare una soluzione più compatta e distintiva: riepilogo orizzontale, fascia contestuale o KPI integrato nella testata dell'agenda.

## Clienti

- Nessuna modifica richiesta in questa revisione.
- Conservare l'attuale visualizzazione fino a una nuova valutazione con un volume realistico di clienti.

## Operatori

La scheda attuale mostra clienti serviti, fatturato e ticket medio, ma non permette di capire l'andamento nel tempo.

Da aggiungere:

- selezione del periodo: giorno, settimana, mese, intervallo personalizzato;
- prenotazioni e clienti serviti per giorno;
- confronto con il periodo precedente;
- trend che evidenzi crescita, stabilità o calo delle prenotazioni;
- tasso di occupazione rispetto alle ore disponibili;
- cancellazioni e no-show;
- andamento del fatturato e del ticket medio;
- dettaglio dei servizi eseguiti e dei prodotti attribuiti all'operatore.

Obiettivo: permettere al titolare di capire non soltanto quanto produce un operatore, ma se la sua attività sta migliorando o peggiorando e in quali giornate.

## Nuova sezione Statistiche

Creare un'area generale dedicata all'andamento del salone, con filtri temporali e confronto con il periodo precedente.

### Prodotti

- prodotti più venduti e meno venduti;
- quantità e fatturato per prodotto;
- prodotti in crescita o in calo;
- andamento delle vendite nel tempo;
- giorni e fasce orarie in cui vengono acquistati maggiormente;
- possibilità di aprire il dettaglio delle vendite che compongono ogni dato.

### Servizi

- servizi più prenotati e meno prenotati;
- quantità, fatturato e ticket medio per servizio;
- servizi in crescita o in calo;
- andamento delle prenotazioni nel tempo;
- confronto tra prenotazioni, servizi realmente eseguiti, cancellazioni e no-show;
- indicazioni utili a scegliere quali servizi promuovere tramite campagne e coupon.

### Domanda e occupazione

- giorni della settimana con maggiore e minore richiesta;
- fasce orarie più richieste e meno richieste;
- mappa di calore giorno × fascia oraria;
- confronto tra domanda, disponibilità offerta e occupazione effettiva.

## Marketing e coupon

Ampliare il monitoraggio già presente per passare da conteggi complessivi a un'analisi temporale.

Da aggiungere:

- andamento degli utilizzi dalla data di invio alla scadenza;
- distribuzione degli utilizzi nei primi giorni, nella fase centrale e vicino alla scadenza;
- tempo medio tra invio e utilizzo;
- confronto tra coupon e campagne differenti;
- ricerca per nome, email o telefono nelle liste degli utenti;
- ricerca disponibile nelle tab “Inviati”, “Utilizzati”, “Non utilizzati” e “Scaduti”;
- filtri per data di invio, data di utilizzo, stato e segmento destinatario.

Obiettivo: capire se un coupon genera una risposta immediata, distribuita nel tempo oppure soltanto vicino alla scadenza.

## Fidelity

Da aggiungere:

- premi e prodotti del catalogo più riscattati;
- premi meno riscattati o mai riscattati;
- punti emessi, utilizzati e scaduti nel periodo;
- tempo medio necessario per raggiungere un premio;
- andamento dei riscatti nel tempo;
- confronto tra clienti con fidelity attiva e comportamento di prenotazione;
- giorni e fasce orarie preferiti dai clienti fidelity.

Le statistiche su giorni e orari devono derivare dalle prenotazioni e dalle vendite confermate, evitando di contare richieste annullate come attività effettiva.

## Dipendenze dati

Prima dello sviluppo verificare che siano disponibili e affidabili:

- timestamp di invio, utilizzo e scadenza dei coupon;
- elenco dei destinatari per campagna;
- righe prodotto e servizio nelle vendite concluse;
- operatore prenotato e operatore che ha realmente eseguito il servizio;
- ore disponibili per operatore;
- stati conclusivi di prenotazioni, vendite e riscatti fidelity;
- intervalli temporali coerenti con il fuso orario del salone.

Ogni KPI dovrà poter aprire il dettaglio dei dati sorgente che lo compongono.

## Ordine suggerito quando riprenderemo il lavoro

1. Wireframe delle tre viste agenda e del riepilogo “oggi”.
2. Definizione dei KPI e delle query condivise per la sezione Statistiche.
3. Approfondimento della scheda operatore con trend temporali.
4. Analisi temporale dei coupon e ricerca nelle liste destinatari.
5. Statistiche dei riscatti fidelity e mappa di calore di giorni e fasce orarie.

