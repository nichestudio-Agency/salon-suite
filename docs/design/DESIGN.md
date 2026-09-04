# Barberia — Design system mobile-first

## Direzione

Il sito è progettato come versione web dell’app del singolo salone. Il cliente non vede una piattaforma multi-salone: nome, contenuti, servizi, team e catalogo appartengono sempre al tenant corrente.

La gerarchia nasce dal telefono e si espande sul desktop senza cambiare linguaggio: navigazione persistente, azioni vicine al pollice, contenuto fotografico caldo, superfici avorio e un solo colore d’accento.

## Fondamenta visive

- Sfondo app: `#F8F5F0`
- Superficie: `#FFFDFA`
- Testo: `#191816`
- Secondario: `#716C66`
- Accento: `#FF6427`
- Bordi: `#E2DCD5`
- Tipografia: Avenir Next / Inter / Segoe UI / system UI
- Raggi: 12 px controlli, 18–22 px card, 24–28 px hero
- Ombre: leggere e riservate alle azioni o agli elementi in primo piano

## Struttura cliente

- Mobile: bottom navigation a cinque voci con Prenota centrale e prominente.
- Desktop: la stessa navigazione diventa una rail laterale compatta.
- Home: hero fotografico, azioni rapide, servizi più richiesti, team e prodotti.
- Prenotazione: tre passaggi visibili — servizio, barber, orario — con selezione e conferma chiare.
- Servizi, operatori e prodotti: card semplici e scansionabili, senza pannelli annidati.

## Struttura titolare

- Mobile: navigazione operativa persistente in basso.
- Desktop: rail laterale, contenuto centrale con larghezza controllata.
- Agenda: settimana, metriche essenziali, appuntamenti in ordine cronologico e stati cromatici.
- Form e gestionali: campi da almeno 44 px, superfici chiare, azioni primarie arancio.

## Accessibilità e comportamento

- Target tattili da almeno 44 px.
- Contrasto elevato e arancio non usato come unico segnale di stato.
- Focus visibile su link, input e pulsanti.
- Safe area rispettata nella navigazione mobile.
- Scroll orizzontale limitato a raccolte naturali: categorie, card e calendario.
- Nessuna dipendenza da hover per completare un’azione.

## Concept di riferimento

- `customer-home-concept.png`
- `customer-booking-concept.png`
- `owner-agenda-concept.png`

I concept definiscono direzione e gerarchia; l’interfaccia reale usa dati e funzionalità esistenti del progetto.
