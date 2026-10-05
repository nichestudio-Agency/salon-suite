# Salon Suite — Pilot v1

## Cosa include

- esperienza cliente mobile-first con codice salone e branding personalizzato;
- accesso, profilo, servizi, team, prenotazioni, ricorrenze e coupon;
- lista d'attesa su slot occupati con offerta automatica dopo una disdetta;
- conferma prenotazioni automatica o manuale configurabile dal salone;
- shop, carrello, ordini e data indicativa di ritiro;
- fidelity con card/QR, punti, catalogo premi e convalida;
- notifiche in-app per prenotazioni, ordini, campagne, compleanni e coda;
- dashboard unificata per titolari con agenda, clienti, operatori, servizi, orari, prodotti, ordini, marketing, statistiche e assistenza;
- pannello Niche per saloni, branding, piani, prezzi, funzionalità e prove temporanee;
- blocchi di abbonamento con anteprima e invito all'upgrade;
- presentazioni live atelier/barber personalizzabili e configuratore commerciale dei prezzi;
- progetto iOS Capacitor e simulazione iPhone.

## Verifiche automatiche del 5 ottobre 2026

- build frontend: superata;
- lint: nessun errore bloccante;
- unit/component test: **103/103 superati**;
- suite Firebase emulator: **105/105 superati**;
- build Cloud Functions: superata;
- audit dipendenze runtime frontend: nessuna vulnerabilità nota;
- audit funzioni: nessuna vulnerabilità alta, restano avvisi moderati in dipendenze Google transitive.

## Limitazioni note del pilot

- Le Cloud Functions non possono essere distribuite finché Firebase non passa al piano Blaze.
- La consegna email richiede un provider/estensione esterna configurata.
- La push nativa richiede credenziali, permessi e test su dispositivo reale.
- Informativa privacy, consensi e accordi contrattuali richiedono validazione legale.
- Il bundle web principale è ancora ampio; il code splitting è un miglioramento successivo, non un blocco del pilot controllato.
- Integrazione cassa è predisposta come area progettuale, non come connettore universale già operativo.

## Criterio di utilizzo

Questa versione è destinata a una dimostrazione commerciale e a un pilot ristretto con supervisione. Non è ancora dichiarata pronta per distribuzione pubblica su larga scala.
