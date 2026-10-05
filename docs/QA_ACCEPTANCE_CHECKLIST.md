# Checklist QA e accettazione pilot

Usare questa checklist su smartphone reale, simulatore iPhone e browser desktop. Registrare per ogni anomalia: ambiente, utente, salone, ora, passaggi, risultato atteso, screenshot/video.

## Identità e isolamento

- [ ] Un codice salone valido apre il salone corretto.
- [ ] Un codice non valido restituisce un messaggio comprensibile.
- [ ] Logo, nome e colori restano leggibili anche con palette bianco/nero.
- [ ] Un cliente vede esclusivamente i dati del proprio salone.
- [ ] Staff e titolare non possono operare su un altro salone modificando l'URL.
- [ ] Il pannello Niche è accessibile soltanto agli amministratori piattaforma.

## Accesso cliente

- [ ] Registrazione completa e accesso funzionante.
- [ ] Errori credenziali visibili, senza schermate bloccate.
- [ ] Logout mostra soltanto “Esci” e torna al flusso corretto.
- [ ] Profilo: nome, data di nascita e preferenze sono leggibili e modificabili.
- [ ] Input iOS non causano zoom o perdita del layout.

## Prenotazioni e coda

- [ ] Scelta servizio, operatore, data e ora in passaggi chiari.
- [ ] Gli slot occupati non sono prenotabili direttamente.
- [ ] È possibile mettersi in coda su uno slot occupato.
- [ ] Una disdetta genera l'offerta allo user in coda una sola volta.
- [ ] L'utente può accettare o rifiutare lo slot liberato.
- [ ] Modalità automatica: la prenotazione entra confermata.
- [ ] Modalità manuale: la prenotazione entra in attesa.
- [ ] Modifica stato in dashboard genera una notifica cliente.
- [ ] Nessuna doppia prenotazione nello stesso slot.

## Dashboard salone

- [ ] Agenda giorno, 3 giorni e settimana sono leggibili.
- [ ] Appuntamenti brevi mostrano dettagli tramite hover/tap.
- [ ] Ricerca e scheda cliente mostrano storico e periodo personalizzato.
- [ ] Servizi, operatori e prodotti si creano, modificano, disattivano e riattivano.
- [ ] Orari e indisponibilità rispettano le disponibilità reali.
- [ ] Ordini sono apribili e includono prodotti, totale, punti e ritiro.
- [ ] Le scorciatoie superiori non vengono tagliate e restano personalizzabili.

## Marketing e notifiche

- [ ] Ricerca cliente specifico funziona senza mostrare liste ingestibili.
- [ ] Campagna per segmento e per singoli clienti crea destinatari corretti.
- [ ] Coupon percentuale, importo fisso, prodotto scontato e omaggio sono distinguibili.
- [ ] Coupon compleanno è personale e monouso.
- [ ] Dettagli inviati/usati/scaduti sono ricercabili.
- [ ] Notifica in-app è consegnata al destinatario corretto.
- [ ] Email e push reali sono testate su almeno due dispositivi/account.
- [ ] Revoca del consenso marketing esclude l'utente dalle campagne successive.

## Fidelity

- [ ] Card virtuale e QR identificano il cliente corretto.
- [ ] I punti maturano solo dopo conferma del servizio/ordine.
- [ ] Un premio riscattato viene convalidato e bruciato una sola volta.
- [ ] Premi modificabili, disattivabili e rimovibili.
- [ ] Statistiche prodotti/premi più e meno riscattati coerenti.

## Abbonamenti e pannello Niche

- [ ] Piani, nomi, prezzi e funzionalità sono modificabili.
- [ ] Piano personalizzato e prova temporanea sbloccano solo le feature previste.
- [ ] Funzione non inclusa resta visibile con anteprima, lucchetto e invito alla prova.
- [ ] Scadenza della prova richiude la funzione.
- [ ] Branding scelto si propaga a presentazione, app e dashboard.

## Assistenza

- [ ] Cliente apre ticket e salone risponde.
- [ ] Salone apre ticket verso Niche e allega media.
- [ ] Campo testo resta leggibile con tastiera mobile aperta.
- [ ] Stato e cronologia del ticket sono coerenti.

## Presentazioni e responsive

- [ ] Presentazione atelier e barber corrette su mobile e desktop.
- [ ] Mockup iPhone non tagliati, non scrollabili internamente se non previsto.
- [ ] CTA demo apre direttamente dashboard o app previste.
- [ ] Presentazione personalizzata mantiene contrasto WCAG leggibile.
- [ ] Configuratore prezzi ricalcola sconti e totali senza errori.

## Accettazione

- [ ] Nessun problema critico aperto.
- [ ] Problemi medi hanno workaround concordato.
- [ ] Titolare ha completato il percorso base senza assistenza.
- [ ] Referente Niche e referente salone approvano l'avvio.
