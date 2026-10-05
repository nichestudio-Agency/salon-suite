# Checklist di distribuzione

## Stato attuale

- Frontend condivisibile: `https://salon-suite-share.pages.dev`
- Progetto Firebase: `salon-suite-fabio-2026`
- Funzioni: pronte e testate in emulatori, distribuzione bloccata finché il progetto non passa a Blaze.
- Notifiche in-app: implementate.
- Push FCM: codice server presente; registrazione token e credenziali native da verificare su dispositivo.
- Email: documenti `mail` generati; serve configurare l'estensione/provider che li consegna.

## Prima del rilascio

```bash
npm ci
npm --prefix functions ci
npm run lint
npm run build
npm test -- --run
npm run test:emu
```

- [ ] `git diff --check` senza errori.
- [ ] Nessun `.env`, file credenziali o accesso demo tracciato.
- [ ] Variabili Firebase di produzione presenti nel sistema di deploy.
- [ ] `VITE_USE_EMULATOR=false` in produzione.
- [ ] `VITE_SHOW_DEMO_ACCESS=false` nell'app destinata a clienti reali.
- [ ] Tag/commit di rilascio creato.

## Frontend

- [ ] Build `dist/` completata.
- [ ] Pubblicazione eseguita con `npm run deploy:pages`.
- [ ] Fallback SPA `_redirects` attivo.
- [ ] Home, presentazioni, accesso, app demo, dashboard e admin apribili da URL diretto.
- [ ] Cache aggiornata dopo il rilascio.
- [ ] Smoke test mobile e desktop sul dominio pubblico.

La pubblicazione viene eseguita dall'interno di `dist/`: è intenzionale. Se Wrangler viene avviato dalla root, può interpretare la cartella Firebase `functions/` come Cloudflare Pages Functions e tentare una compilazione non compatibile.

## Firebase

Con piano Blaze attivo:

```bash
firebase deploy --only firestore:rules,storage,functions --project salon-suite-fabio-2026
```

- [ ] Regole Firestore e Storage pubblicate.
- [ ] Tutte le callable/trigger presenti nella console.
- [ ] Birthday scheduler attivo nel fuso orario previsto.
- [ ] Log privi di errori dopo una prenotazione e un ordine di prova.
- [ ] Indici Firestore richiesti dalle query creati.

## Email e push

- [ ] Provider/estensione legge la raccolta `mail`.
- [ ] Dominio mittente verificato (SPF, DKIM, DMARC secondo provider).
- [ ] Token FCM registrato da iOS/Web e rimosso quando non valido.
- [ ] Push di prenotazione, ordine, campagna, compleanno e coda testate.
- [ ] Notifica in-app resta disponibile se email/push falliscono.

## iOS

```bash
npm run mobile:sync
```

- [ ] Bundle identifier `it.nichestudio.salonsuite` confermato.
- [ ] Team Apple, firma e provisioning configurati.
- [ ] Icone, splash, permessi notifiche e deep link verificati.
- [ ] Test su almeno un iPhone reale oltre al simulatore.

## Dopo il rilascio

- [ ] Registrare commit, data, ambiente e responsabile.
- [ ] Eseguire la checklist QA sul dominio pubblico.
- [ ] Monitorare errori e consegna notifiche per 24 ore.
- [ ] Conservare il riferimento al rilascio precedente per rollback.
