# Salon Suite — Pilot runbook

Stato: **pronto per un pilot controllato**, non ancora per un lancio pubblico generalizzato.

## Obiettivo del pilot

Validare con un'attività reale, per 2–4 settimane, il flusso completo: accesso al salone, registrazione cliente, prenotazione, gestione agenda, ordini, fidelity, marketing, assistenza e amministrazione dell'abbonamento.

## Perimetro consigliato

- 1 salone pilota.
- 1 titolare e massimo 3 operatori.
- 20–50 clienti invitati.
- Catalogo iniziale limitato a 5–10 servizi e 5–10 prodotti.
- Notifiche marketing solo a utenti con consenso verificato.
- Un referente Niche e un referente del salone.

## Prerequisiti prima dell'avvio

- [ ] Piano Firebase **Blaze** attivo sul progetto `salon-suite-fabio-2026`.
- [ ] Cloud Functions distribuite in produzione.
- [ ] Dominio e mittente email configurati tramite un provider/estensione compatibile con la raccolta `mail`.
- [ ] Credenziali Apple e configurazione push disponibili se il pilot usa l'app iOS installabile.
- [ ] Informativa privacy, termini del servizio e nomina a responsabile del trattamento approvati da un consulente.
- [ ] Nome, logo, palette, orari, servizi, operatori e regole di conferma del salone caricati.
- [ ] Backup/esportazione iniziale verificata.

## Preparazione tecnica

```bash
npm ci
npm run build
npm run lint
npm test -- --run
npm run test:emu
npm run mobile:sync
```

Distribuzione backend, dopo l'attivazione di Blaze:

```bash
firebase deploy --only functions,firestore:rules,storage --project salon-suite-fabio-2026
```

## Preparazione del salone

1. Creare il salone dal pannello Niche.
2. Assegnare piano, eventuali funzionalità in prova e data di scadenza.
3. Configurare identità visiva e codice salone.
4. Inserire titolare e operatori, con orari e indisponibilità.
5. Inserire servizi, durata, prezzo e disponibilità.
6. Inserire prodotti, disponibilità e modalità di ritiro.
7. Scegliere conferma prenotazioni automatica o manuale.
8. Configurare fidelity, premi e regole punti.
9. Eseguire una prenotazione, un annullamento, una coda e un ordine completi.

## Avvio controllato

### Giorno 0

- Registrare un cliente di prova reale.
- Verificare accesso, notifica, email, prenotazione e agenda.
- Verificare che un secondo salone non possa leggere i dati del primo.
- Annotare versione e ora del rilascio.

### Prima settimana

- Controllo giornaliero di errori, prenotazioni duplicate, notifiche non consegnate e feedback.
- Nessuna modifica strutturale durante l'orario di apertura.
- Correzioni urgenti prima su ambiente locale/emulato, poi rilascio.

### Settimane successive

- Revisione settimanale con il titolare.
- Misurare prenotazioni online, slot riempiti, no-show, uso fidelity e campagne.
- Aggiungere utenti e catalogo solo dopo stabilità del nucleo iniziale.

## Criteri di stop

Sospendere il pilot se si verifica uno dei seguenti casi:

- accesso incrociato ai dati di saloni diversi;
- prenotazioni duplicate o perdita di prenotazioni;
- impossibilità per il titolare di vedere o gestire l'agenda;
- invii marketing a utenti non autorizzati;
- errore ripetuto nei conteggi punti o nei riscatti;
- indisponibilità prolungata senza procedura manuale alternativa.

## Rollback

1. Disattivare temporaneamente nuove registrazioni/campagne.
2. Informare il salone e passare alla gestione manuale concordata.
3. Ripristinare il precedente commit/tag stabile.
4. Ripubblicare frontend e funzioni.
5. Verificare dati e regole prima di riaprire.

## Contatti da compilare

- Referente Niche: `[nome, telefono, email]`
- Referente salone: `[nome, telefono, email]`
- Consulente privacy: `[nome, contatto]`
- Provider email/push: `[provider, account]`
