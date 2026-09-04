# Barberia — Design system cliente

## Direzione

Il sito è progettato come versione web dell’app del singolo salone. Il cliente non vede una piattaforma multi-salone: nome, contenuti, servizi, team e catalogo appartengono sempre al tenant corrente.

La gerarchia nasce dal telefono e si espande sul desktop senza cambiare linguaggio: navigazione persistente, azioni vicine al pollice, fotografia barber in bianco e nero, griglia editoriale e un solo colore d’accento.

## Fondamenta visive

- Sfondo: grafite `#181817`
- Superficie: `#1E1E1C`
- Testo: avorio `#F2EFE8`
- Secondario: `#99958E`
- Accento: arancio `#F04A12`
- Bordi strutturali: `#504E49`
- Titoli: carattere condensato ad alto impatto, sempre molto compatto
- Metadati: monospace tecnico, maiuscolo e di piccola dimensione
- Geometria: bordi netti, raggi minimi e separatori da 1 px
- Immagini: prevalentemente monocromatiche, con contrasto deciso
- Effetti: texture appena visibile; niente gradienti decorativi o ombre soffici

## Struttura cliente

- Mobile: bottom navigation a cinque voci con Prenota centrale e prominente.
- Desktop: la stessa navigazione diventa una barra orizzontale editoriale.
- Home: headline monumentale, mosaico fotografico, CTA arancio, listino, team e prodotti.
- Prenotazione: tre passaggi visibili — servizio, barber, orario — disposti su una griglia lineare.
- Servizi: listino tipografico con righe, prezzo, durata e immagine editoriale.
- Operatori e prodotti: moduli netti e scansionabili, senza pannelli annidati.

## Separazione dall’area titolare

Il redesign industriale è applicato esclusivamente a `.customer-app`. Dashboard, agenda e gestionali del titolare mantengono il sistema operativo chiaro già esistente.

## Accessibilità e comportamento

- Target tattili da almeno 44 px.
- Contrasto elevato e arancio non usato come unico segnale di stato.
- Focus visibile su link, input e pulsanti.
- Safe area rispettata nella navigazione mobile.
- Scroll orizzontale limitato a raccolte naturali: categorie, card e calendario.
- Nessuna dipendenza da hover per completare un’azione.

## Concept di riferimento

- `customer-industrial-home-concept.png`
- `customer-industrial-services-concept.png`
- `customer-industrial-booking-mobile-concept.png`
- `owner-agenda-concept.png`

I concept definiscono direzione e gerarchia; l’interfaccia reale usa dati e funzionalità esistenti del progetto.
