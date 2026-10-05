# Salon Suite

Piattaforma multi-salone con app cliente, dashboard del titolare e pannello amministrativo. Il frontend e sviluppato con React, TypeScript e Vite; la versione iOS usa Capacitor per eseguire la stessa esperienza web dentro un'app nativa.

## Avvio web locale

```bash
npm install
npm run dev
```

## Demo con dati locali

In due terminali separati:

```bash
npm run emu:start
```

```bash
npm run emu:seed
```

Credenziali cliente demo:

- Barber: codice `SALONEX26`, quindi `cliente.test@barberia.local` / `TestBarber26!`
- Hair studio: codice `ATELIER26`, quindi `cliente.hair@barberia.local` / `HairStudio26!`

## Simulazione iPhone

Sono necessari Xcode e almeno un runtime iOS Simulator installato.

Per aprire il progetto nativo:

```bash
npm run ios:open
```

In Xcode selezionare un iPhone Simulator, ad esempio **iPhone 17 Pro**, e premere **Run**. La finestra Simulator supporta tap, tastiera, rotazione e gesti come su un dispositivo.

Dopo ogni modifica al frontend, sincronizzare la build nell'app iOS:

```bash
npm run mobile:sync
```

Per compilare e scegliere il simulatore dal terminale:

```bash
npm run ios:run
```

Il progetto iOS si trova in `ios/App/App.xcodeproj`. Il bundle identifier e `it.nichestudio.salonsuite`.

## Controlli

```bash
npm run lint
npm test -- --run
npm run build
npm run test:emu
```

## Preparazione del pilot

- [Pilot runbook](docs/PILOT_RUNBOOK.md)
- [Checklist QA e accettazione](docs/QA_ACCEPTANCE_CHECKLIST.md)
- [Checklist di distribuzione](docs/DEPLOYMENT_CHECKLIST.md)
- [Privacy e consensi — bozza operativa](docs/PRIVACY_AND_CONSENT_DRAFT.md)
- [Scheda feedback pilot](docs/PILOT_FEEDBACK_TEMPLATE.md)
- [Note di rilascio Pilot v1](docs/RELEASE_NOTES_PILOT_V1.md)
