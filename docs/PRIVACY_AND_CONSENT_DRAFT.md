# Privacy e consensi — bozza operativa

> **Bozza tecnica, non consulenza legale.** Non pubblicare come informativa definitiva. Deve essere adattata e approvata da un professionista prima del pilot con clienti reali.

Riferimenti ufficiali consultati:

- [Regolamento (UE) 2016/679 — GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [Garante Privacy — comunicazioni e marketing](https://www.garanteprivacy.it/temi/marketing-e-comunicazioni-indesiderate)

## Ruoli da formalizzare

Configurazione probabile, da confermare contrattualmente:

- il **salone** decide finalità e modalità del rapporto con i propri clienti ed è normalmente titolare del trattamento;
- **Niche / Salon Suite** tratta i dati per fornire la piattaforma ed è normalmente responsabile del trattamento;
- Firebase/Google, provider email, hosting e assistenza possono essere sub-responsabili da elencare.

Servono un contratto del servizio, un accordo sul trattamento dati ex art. 28 GDPR e un elenco aggiornato dei sub-responsabili.

## Finalità da separare

### Operatività del servizio

Account, prenotazioni, variazioni, ordini, assistenza, fidelity richiesta dal cliente e comunicazioni strettamente necessarie al servizio. Definire per ciascuna voce base giuridica, dati, destinatari e conservazione.

### Marketing

Compleanni promozionali, riattivazione clienti inattivi, coupon, offerte su slot liberi e promozione prodotti. Il consenso, quando utilizzato, deve essere libero, specifico, informato, inequivocabile, dimostrabile e revocabile. La revoca deve essere semplice e non deve impedire l'uso delle funzioni essenziali.

Non usare una singola casella obbligatoria per accettare insieme servizio e marketing.

## Dati trattati da censire

- identificativi e contatti;
- data di nascita, se realmente necessaria;
- salone di appartenenza e ruolo;
- prenotazioni, visite registrate al banco e preferenze;
- ordini, prodotti, coupon, punti e riscatti;
- consensi con versione del testo, data, canale e revoca;
- ticket, allegati e log tecnici;
- token push e metadati di consegna.

Evitare note libere contenenti informazioni sanitarie o altri dati particolari, salvo un progetto giuridico e tecnico specifico.

## Requisiti da completare prima del pilot reale

- [ ] Informativa cliente con identità del titolare, contatti, finalità, basi giuridiche, conservazione, destinatari, trasferimenti e diritti.
- [ ] Informativa e contratto per titolare/operatori del salone.
- [ ] Consenso marketing separato e facoltativo.
- [ ] Registro della versione del consenso e della revoca.
- [ ] Meccanismo di opposizione/disiscrizione dalle comunicazioni promozionali.
- [ ] Procedura per accesso, rettifica, portabilità, limitazione e cancellazione.
- [ ] Tempi di conservazione definiti per account, prenotazioni, ordini, ticket e log.
- [ ] Processo di data breach con ruoli e tempi di escalation.
- [ ] Valutazione dei trasferimenti internazionali e dei sub-responsabili.
- [ ] Verifica età minima e gestione minori, se il servizio è rivolto anche a minori.

## Schema tecnico consigliato per il consenso

Per ogni profilo cliente conservare, senza sovrascrivere la cronologia:

- `privacyNoticeVersion`
- `privacyAcceptedAt`
- `marketingConsent` (`true`/`false`)
- `marketingConsentAt`
- `marketingConsentVersion`
- `marketingConsentSource` (`registration`, `profile`, `salon_import`)
- `marketingRevokedAt`

Le campagne devono filtrare lato server i destinatari in base allo stato valido più recente, non soltanto nascondere il pulsante nell'interfaccia.

## Decisioni ancora necessarie

- ragione sociale e contatti privacy di Niche;
- ragione sociale e contatti di ogni salone;
- durata di conservazione per categoria;
- provider email/push definitivo;
- modalità di esercizio dei diritti;
- politica per importazioni di anagrafiche preesistenti;
- eventuale DPO e autorità di controllo competente.
