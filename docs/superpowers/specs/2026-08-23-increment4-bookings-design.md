# Fase 1 · Incremento 4 — Prenotazioni end-to-end

**Data:** 2026-08-23  
**Stato:** In implementazione  
**Base:** specifica approvata della Fase 1

## Obiettivo

Permettere a un cliente autenticato di vedere gli slot disponibili e inviare una
richiesta di prenotazione; permettere al salone di confermarla o rifiutarla.

L'incremento viene consegnato in tre parti:

1. **4a — Backend autorevole:** disponibilità e creazione transazionale senza
   doppie prenotazioni.
2. **4b — Flusso cliente:** scelta salone, servizio, operatore, data e slot;
   elenco e annullamento delle proprie prenotazioni.
3. **4c — Dashboard richieste:** elenco richieste, conferma e rifiuto.

## Decisioni tecniche

- Il client non può creare direttamente documenti `bookings`: usa una callable
  Cloud Function, che ricava identità e durata del servizio da fonti autorevoli.
- Ogni coppia operatore/giorno ha un documento mutex in `_bookingDays`. La
  creazione aggiorna quel documento nella stessa transazione della prenotazione,
  serializzando richieste concorrenti anche quando la query iniziale è vuota.
- La funzione rilegge salone, operatore, servizio e prenotazioni attive; applica
  orari del salone, override dell'operatore, durata e passo configurato.
- `in_attesa` e `confermata` occupano lo slot; `rifiutata` e `annullata` lo
  liberano.
- Le modifiche dirette alle prenotazioni sono limitate al solo stato e a
  transizioni valide. Campi temporali, cliente, servizio e operatore sono
  immutabili dopo la creazione.

## Criteri di accettazione 4a

- Uno slot valido crea una prenotazione `in_attesa` con durata presa dal servizio.
- Due richieste concorrenti per lo stesso slot producono una sola prenotazione.
- Slot fuori orario, sovrapposti, operatori/servizi disattivati e utenti non
  cliente vengono rifiutati.
- La scrittura diretta del client viene bloccata dalle Security Rules.
