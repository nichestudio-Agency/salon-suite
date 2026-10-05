import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
import type { LicensePlan, SubscriptionFeatureKey, SubscriptionPlansConfig } from "../domain/models";
import { calculateCommercialQuote } from "../domain/pricing-calculator";
import { DEFAULT_SUBSCRIPTION_PLANS, getSubscriptionPlansConfig } from "../firebase/platform-admin";
import "./pricing-presentation.css";

type PlanKey = LicensePlan;

const PLAN_META: Record<PlanKey, {
  eyebrow: string;
  promise: string;
  bestFor: string;
  extras: string[];
}> = {
  start: {
    eyebrow: "Per partire bene",
    promise: "Porta online agenda, clienti e prenotazioni senza complicare il lavoro quotidiano.",
    bestFor: "Attività che vogliono digitalizzare l’operatività essenziale.",
    extras: ["Configurazione guidata", "Supporto standard", "App cliente personalizzata"],
  },
  studio: {
    eyebrow: "Più scelto",
    promise: "Trasforma ogni visita in una relazione: vendite, marketing e fidelizzazione lavorano insieme.",
    bestFor: "Saloni che vogliono aumentare ritorno e valore medio del cliente.",
    extras: ["Setup assistito", "Campagne e coupon", "Fidelity con QR e catalogo premi"],
  },
  pro: {
    eyebrow: "Per decidere con i dati",
    promise: "Controlla performance, marginalità e crescita con tutti gli strumenti della piattaforma.",
    bestFor: "Attività strutturate, team in crescita e più punti vendita.",
    extras: ["Assistenza prioritaria", "Accesso anticipato alle nuove funzioni", "Importazione e integrazioni"],
  },
};

const FEATURE_LABELS: Array<{ key: SubscriptionFeatureKey; label: string; note: string }> = [
  { key: "agenda", label: "Agenda e prenotazioni online", note: "Lista d’attesa intelligente e conferme automatiche" },
  { key: "clienti", label: "Schede e storico clienti", note: "Visite, acquisti, preferenze e note" },
  { key: "servizi_team", label: "Servizi, team e disponibilità", note: "Listino, operatori e orari" },
  { key: "app_cliente", label: "App cliente personalizzata", note: "Il salone sempre a portata di mano" },
  { key: "prodotti_ordini", label: "Prodotti e ordini", note: "Catalogo, carrello e ritiro" },
  { key: "marketing", label: "Marketing mirato", note: "Coupon, compleanni e riattivazione" },
  { key: "fidelity", label: "Fidelity con QR", note: "Punti, premi e convalida" },
  { key: "statistiche", label: "Statistiche avanzate", note: "Servizi, prodotti, team e domanda" },
  { key: "integrazioni", label: "Cassa e integrazioni", note: "Predisposizione ai flussi esterni" },
  { key: "importazione", label: "Importazione dati", note: "Partenza più rapida dal gestionale attuale" },
];

const PLAN_ORDER: PlanKey[] = ["start", "studio", "pro"];
const formatPrice = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
const formatQuotePrice = (cents: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(cents / 100);
const formatNumber = (value: number) => new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);

interface SavedCommercialQuote {
  id: string;
  createdAt: string;
  clientName: string;
  plan: PlanKey;
  monthlyPrice: number;
  billingCycle: "monthly" | "annual";
  locations: number;
  locationDiscount: number;
  commercialDiscount: number;
  setupFee: number;
  minimumMonthly: number;
  averageTicket: number;
  validityDays: number;
}

const QUOTES_STORAGE_KEY = "salon-suite-commercial-quotes-v1";

export function PricingPresentationPage() {
  const [config, setConfig] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("studio");
  const [appointments, setAppointments] = useState(180);
  const [averageTicket, setAverageTicket] = useState(35);
  const [recoveryRate, setRecoveryRate] = useState(4);
  const [quotePlan, setQuotePlan] = useState<PlanKey>("studio");
  const [clientName, setClientName] = useState("");
  const [offerMonthlyPrice, setOfferMonthlyPrice] = useState(79);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [locations, setLocations] = useState(1);
  const [locationDiscount, setLocationDiscount] = useState(20);
  const [commercialDiscount, setCommercialDiscount] = useState(0);
  const [setupFee, setSetupFee] = useState(0);
  const [minimumMonthly, setMinimumMonthly] = useState(45);
  const [quoteAverageTicket, setQuoteAverageTicket] = useState(35);
  const [validityDays, setValidityDays] = useState(14);
  const [savedQuotes, setSavedQuotes] = useState<SavedCommercialQuote[]>([]);
  const [quoteFeedback, setQuoteFeedback] = useState("");

  useEffect(() => {
    let active = true;
    void getSubscriptionPlansConfig().then((next) => {
      if (!active) return;
      setConfig(next);
      setOfferMonthlyPrice(next.piani.studio.prezzoMensile / 100);
      setMinimumMonthly(Math.round(next.piani.studio.prezzoMensile / 100 * .57));
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(QUOTES_STORAGE_KEY) ?? "[]") as SavedCommercialQuote[];
      if (Array.isArray(stored)) setSavedQuotes(stored.slice(0, 12));
    } catch { /* Un salvataggio precedente non valido non blocca il configuratore. */ }
  }, []);

  const selectedPrice = config.piani[selectedPlan].prezzoMensile;
  const annualPrice = selectedPrice * 10;
  const recoveredMonthly = Math.max(1, Math.round(appointments * recoveryRate / 100));
  const additionalYear = recoveredMonthly * averageTicket * 12;
  const netBenefit = additionalYear - annualPrice / 100;
  const roi = annualPrice ? additionalYear / (annualPrice / 100) : 0;
  const breakEvenBookings = Math.ceil((annualPrice / 100) / averageTicket);
  const breakEvenMonthly = breakEvenBookings / 12;
  const planName = config.piani[selectedPlan].nome;
  const themeStyle = { "--pp-plan-index": PLAN_ORDER.indexOf(selectedPlan) } as CSSProperties;
  const quoteResult = useMemo(() => calculateCommercialQuote({
    monthlyPriceCents: Math.round(offerMonthlyPrice * 100),
    billingCycle,
    locations,
    additionalLocationDiscountPercent: locationDiscount,
    commercialDiscountPercent: commercialDiscount,
    setupFeeCents: Math.round(setupFee * 100),
    minimumMonthlyPerLocationCents: Math.round(minimumMonthly * 100),
    averageTicketCents: Math.round(quoteAverageTicket * 100),
  }), [billingCycle, commercialDiscount, locationDiscount, locations, minimumMonthly, offerMonthlyPrice, quoteAverageTicket, setupFee]);

  const comparison = useMemo(() => FEATURE_LABELS.map((feature) => ({
    ...feature,
    plans: PLAN_ORDER.map((plan) => config.piani[plan].funzionalita.includes(feature.key)),
  })), [config]);

  function selectQuotePlan(plan: PlanKey) {
    const monthly = config.piani[plan].prezzoMensile / 100;
    setQuotePlan(plan);
    setOfferMonthlyPrice(monthly);
    setMinimumMonthly(Math.round(monthly * .57));
    setQuoteFeedback("");
  }

  function saveQuote() {
    const next: SavedCommercialQuote = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      clientName: clientName.trim() || "Proposta senza nome",
      plan: quotePlan,
      monthlyPrice: offerMonthlyPrice,
      billingCycle,
      locations,
      locationDiscount,
      commercialDiscount,
      setupFee,
      minimumMonthly,
      averageTicket: quoteAverageTicket,
      validityDays,
    };
    const updated = [next, ...savedQuotes].slice(0, 12);
    setSavedQuotes(updated);
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(updated));
    setQuoteFeedback("Preventivo salvato su questo dispositivo.");
  }

  function restoreQuote(quote: SavedCommercialQuote) {
    setClientName(quote.clientName);
    setQuotePlan(quote.plan);
    setOfferMonthlyPrice(quote.monthlyPrice);
    setBillingCycle(quote.billingCycle);
    setLocations(quote.locations);
    setLocationDiscount(quote.locationDiscount);
    setCommercialDiscount(quote.commercialDiscount);
    setSetupFee(quote.setupFee);
    setMinimumMonthly(quote.minimumMonthly);
    setQuoteAverageTicket(quote.averageTicket);
    setValidityDays(quote.validityDays);
    setQuoteFeedback(`Proposta “${quote.clientName}” riaperta.`);
  }

  function removeQuote(id: string) {
    const updated = savedQuotes.filter((quote) => quote.id !== id);
    setSavedQuotes(updated);
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(updated));
  }

  async function copyQuoteSummary() {
    const text = [
      `Proposta ${clientName.trim() || config.piani[quotePlan].nome}`,
      `Piano: ${config.piani[quotePlan].nome} · ${locations} ${locations === 1 ? "sede" : "sedi"}`,
      `Pagamento: ${billingCycle === "annual" ? "annuale" : "mensile"}`,
      `Totale primo anno: ${formatQuotePrice(quoteResult.firstYearCents)}`,
      `Rinnovo annuale: ${formatQuotePrice(quoteResult.recurringAnnualCents)}`,
      `Equivalente mensile: ${formatQuotePrice(quoteResult.effectiveMonthlyCents)}`,
      `Vantaggio complessivo: ${formatQuotePrice(quoteResult.totalDiscountCents)} (${quoteResult.totalDiscountPercent.toFixed(1).replace(".", ",")}%)`,
      `Validità: ${validityDays} giorni`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setQuoteFeedback("Riepilogo copiato negli appunti.");
    } catch {
      setQuoteFeedback("Copia non disponibile: puoi usare il riepilogo qui accanto.");
    }
  }

  return <main className="pricing-presentation" style={themeStyle}>
    <header className="pp-nav">
      <a className="pp-brand" href="#inizio"><span>NI</span><div><strong>Niche</strong><small>Proposta commerciale</small></div></a>
      <nav aria-label="Presentazione prezzi"><a href="#pacchetti">Pacchetti</a><a href="#confronto">Confronto</a><a href="#ritorno">Ritorno</a><a className="pp-nav-cta" href="#offerta">Configura offerta</a></nav>
    </header>

    <section className="pp-hero" id="inizio">
      <div className="pp-orbit pp-orbit-one" /><div className="pp-orbit pp-orbit-two" />
      <div className="pp-hero-copy"><p>Salon Suite · Listino 2026</p><h1>Non è un costo.<br /><em>È capacità in più.</em></h1><span>Più tempo per il team, più libertà per il cliente e più controllo per chi guida il salone.</span><div><a href="#pacchetti">Scopri i pacchetti <AppIcon name="arrow" size={18} /></a><small>Da 49 € al mese · nessuna commissione sulle prenotazioni</small></div></div>
      <aside className="pp-hero-price"><span>A partire da</span><strong>49<sup>€</sup></strong><p>al mese</p><i>oppure 490 € l’anno</i></aside>
    </section>

    <section className="pp-context">
      <header><p>Il mercato ha già scelto la comodità</p><h2>Il prezzo si vede subito.<br />Il valore si misura ogni giorno.</h2></header>
      <div className="pp-context-grid">
        <article className="is-dark"><strong>80%</strong><h3>vuole prenotare da mobile</h3><p>Essere disponibili quando il cliente decide riduce l’attrito tra intenzione e appuntamento.</p></article>
        <article><strong>64%</strong><h3>delle prenotazioni arriva fuori dal classico 9–17</h3><p>Il sistema continua a ricevere richieste anche quando il telefono del salone non può rispondere.</p></article>
        <article className="is-accent"><strong>57%</strong><h3>di vendite annue in più</h3><p>È il divario osservato da Square tra attività beauty che vendono servizi e prodotti e quelle concentrate solo sui servizi.</p></article>
      </div>
      <p className="pp-source-note">Dati di contesto: Zenoti Consumer Survey 2025 e analisi Square Beauty & Personal Care 2024. Non costituiscono una previsione garantita per la singola attività.</p>
    </section>

    <section className="pp-plans" id="pacchetti">
      <header><p>Tre livelli, una piattaforma</p><h2>Scegli quanto vuoi far lavorare il sistema per te.</h2><span>Tutti i prezzi sono IVA esclusa. Con il pagamento annuale sono inclusi due mesi.</span></header>
      <div className="pp-plan-grid">
        {PLAN_ORDER.map((key, index) => {
          const plan = config.piani[key];
          const annual = plan.prezzoMensile * 10;
          const featured = key === "studio";
          return <article className={featured ? "is-featured" : ""} key={key}>
            <div className="pp-plan-top"><span>0{index + 1}</span><b>{PLAN_META[key].eyebrow}</b></div>
            <h3>{plan.nome}</h3><p>{PLAN_META[key].promise}</p>
            <div className="pp-plan-price"><strong>{formatPrice(plan.prezzoMensile)}</strong><span>/ mese</span></div>
            <div className="pp-plan-annual"><b>{formatPrice(annual)} / anno</b><span>Risparmi {formatPrice(plan.prezzoMensile * 2)}</span></div>
            <ul>{PLAN_META[key].extras.map((extra) => <li key={extra}><AppIcon name="check" size={16} />{extra}</li>)}</ul>
            <button type="button" onClick={() => { setSelectedPlan(key); document.querySelector("#ritorno")?.scrollIntoView({ behavior: "smooth" }); }}>Calcola il ritorno</button>
          </article>;
        })}
      </div>
    </section>

    <section className="pp-comparison" id="confronto">
      <header><div><p>Confronto trasparente</p><h2>Cosa cambia davvero tra un piano e l’altro.</h2></div><span>Le funzioni non incluse restano visibili nella dashboard: il titolare può scoprirle e richiederne una prova.</span></header>
      <div className="pp-table" role="table" aria-label="Confronto pacchetti">
        <div className="pp-table-head" role="row"><span>Funzione</span>{PLAN_ORDER.map((key) => <strong key={key}>{config.piani[key].nome}<small>{formatPrice(config.piani[key].prezzoMensile)}/mese</small></strong>)}</div>
        {comparison.map((row) => <div className="pp-table-row" role="row" key={row.key}><span><b>{row.label}</b><small>{row.note}</small></span>{row.plans.map((included, index) => <i className={included ? "is-included" : ""} aria-label={included ? "Incluso" : "Non incluso"} key={PLAN_ORDER[index]}>{included ? <AppIcon name="check" size={18} /> : "—"}</i>)}</div>)}
      </div>
    </section>

    <section className="pp-advantages">
      <header><p>Non solo più funzioni</p><h2>Salire di piano significa aumentare la leva.</h2></header>
      <div><article><span>Start → Studio</span><h3>Da organizzare a far tornare.</h3><p>Aggiungi prodotti, ordini, campagne mirate e fidelity. Il sistema non gestisce soltanto l’appuntamento: lavora sul valore futuro del cliente.</p></article><article><span>Studio → Pro</span><h3>Da agire a decidere.</h3><p>Statistiche, importazione e integrazioni rendono misurabili team, servizi, prodotti e campagne.</p></article><article className="is-pro"><span>Vantaggi Pro</span><h3>Prima gli strumenti, poi il mercato.</h3><p>Assistenza prioritaria, accesso anticipato alle nuove funzioni e possibilità di testare le evoluzioni più importanti.</p></article></div>
    </section>

    <section className="pp-offers">
      <header><p>Condizioni che aiutano a scegliere</p><h2>Più continuità, più vantaggio.</h2></header>
      <div><article><b>−17%</b><span>Annuale</span><h3>Due mesi inclusi</h3><p>Paghi dieci mesi e utilizzi la piattaforma per dodici.</p></article><article><b>0 €</b><span>Avvio annuale</span><h3>Configurazione inclusa</h3><p>Impostazione iniziale di salone, servizi, team e identità visiva.</p></article><article><b>−20%</b><span>Seconda sede</span><h3>La rete costa meno</h3><p>Sconto ricorrente sulla licenza aggiuntiva dello stesso titolare.</p></article></div>
    </section>

    <section className="pp-deal" id="offerta">
      <header><p>Cabina regia commerciale</p><h2>Decidi lo sconto.<br />Senza perdere il controllo.</h2><span>Costruisci la proposta durante l’incontro, verifica subito la soglia minima e salva ogni scenario sul tuo dispositivo.</span></header>
      <div className="pp-deal-layout">
        <div className="pp-deal-controls">
          <div className="pp-deal-name"><label><span>Cliente o attività</span><input type="text" value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Es. Atelier Aurora" /></label><label><span>Validità proposta</span><select value={validityDays} onChange={(event) => setValidityDays(Number(event.target.value))}><option value="7">7 giorni</option><option value="14">14 giorni</option><option value="30">30 giorni</option><option value="60">60 giorni</option></select></label></div>

          <fieldset className="pp-deal-fieldset"><legend>01 · Piano di partenza</legend><div className="pp-deal-plan-selector">{PLAN_ORDER.map((key) => <button className={quotePlan === key ? "is-active" : ""} type="button" onClick={() => selectQuotePlan(key)} key={key}><span>{config.piani[key].nome}</span><b>{formatPrice(config.piani[key].prezzoMensile)}</b></button>)}</div></fieldset>

          <fieldset className="pp-deal-fieldset"><legend>02 · Struttura dell’offerta</legend><div className="pp-deal-fields">
            <label><span>Prezzo listino mensile</span><div className="pp-money-input"><b>€</b><input type="number" min="0" step="1" value={offerMonthlyPrice} onChange={(event) => setOfferMonthlyPrice(Math.max(0, Number(event.target.value)))} /></div></label>
            <label><span>Fatturazione</span><div className="pp-cycle-switch"><button className={billingCycle === "monthly" ? "is-active" : ""} type="button" onClick={() => setBillingCycle("monthly")}>Mensile</button><button className={billingCycle === "annual" ? "is-active" : ""} type="button" onClick={() => setBillingCycle("annual")}>Annuale</button></div></label>
            <label><span>Numero sedi</span><input type="number" min="1" max="20" step="1" value={locations} onChange={(event) => setLocations(Math.max(1, Number(event.target.value)))} /></label>
            <label><span>Sconto sedi aggiuntive</span><div className="pp-suffix-input"><input type="number" min="0" max="60" step="1" value={locationDiscount} onChange={(event) => setLocationDiscount(Math.min(60, Math.max(0, Number(event.target.value))))} /><b>%</b></div></label>
            <label><span>Avviamento una tantum</span><div className="pp-money-input"><b>€</b><input type="number" min="0" step="10" value={setupFee} onChange={(event) => setSetupFee(Math.max(0, Number(event.target.value)))} /></div></label>
            <label><span>Ticket medio del salone</span><div className="pp-money-input"><b>€</b><input type="number" min="1" step="1" value={quoteAverageTicket} onChange={(event) => setQuoteAverageTicket(Math.max(1, Number(event.target.value)))} /></div></label>
          </div></fieldset>

          <fieldset className="pp-deal-fieldset pp-discount-control"><legend>03 · Trattativa</legend><label><span>Sconto commerciale extra <b>{commercialDiscount}%</b></span><input type="range" min="0" max="35" step="1" value={commercialDiscount} onChange={(event) => setCommercialDiscount(Number(event.target.value))} /></label><div className="pp-deal-fields"><label><span>Soglia minima mensile / sede</span><div className="pp-money-input"><b>€</b><input type="number" min="0" step="1" value={minimumMonthly} onChange={(event) => setMinimumMonthly(Math.max(0, Number(event.target.value)))} /></div></label><div className={`pp-discount-health is-${quoteResult.health}`}><span>{quoteResult.health === "healthy" ? "Spazio di trattativa" : quoteResult.health === "attention" ? "Vicino alla soglia" : "Sotto la soglia"}</span><strong>{quoteResult.health === "below_floor" ? "Rivedi l’offerta" : `${quoteResult.remainingNegotiationPercent.toFixed(1).replace(".", ",")}% disponibile`}</strong><small>Sconto extra massimo stimato: {quoteResult.maximumCommercialDiscountPercent.toFixed(1).replace(".", ",")}%</small></div></div></fieldset>

          <div className="pp-deal-actions"><button className="is-primary" type="button" onClick={saveQuote}><AppIcon name="check" size={18} />Salva preventivo</button><button type="button" onClick={() => void copyQuoteSummary()}><AppIcon name="paperclip" size={18} />Copia riepilogo</button></div>
          {quoteFeedback && <p className="pp-deal-feedback" role="status">{quoteFeedback}</p>}

          {savedQuotes.length > 0 && <div className="pp-saved-quotes"><div><span>Preventivi salvati</span><small>Restano disponibili su questo dispositivo</small></div><ul>{savedQuotes.map((quote) => <li key={quote.id}><button type="button" onClick={() => restoreQuote(quote)}><strong>{quote.clientName}</strong><span>{config.piani[quote.plan].nome} · {quote.locations} {quote.locations === 1 ? "sede" : "sedi"}</span></button><button type="button" onClick={() => removeQuote(quote.id)} aria-label={`Elimina preventivo ${quote.clientName}`}>Elimina</button></li>)}</ul></div>}
        </div>

        <aside className="pp-deal-summary">
          <div className="pp-deal-summary-top"><span>Proposta {config.piani[quotePlan].nome}</span><b className={`is-${quoteResult.health}`}>{quoteResult.health === "healthy" ? "Sostenibile" : quoteResult.health === "attention" ? "Da valutare" : "Sotto soglia"}</b></div>
          <p>{clientName.trim() || "Simulazione commerciale"}</p>
          <div className="pp-deal-total"><small>Totale primo anno</small><strong>{formatQuotePrice(quoteResult.firstYearCents)}</strong><span>{billingCycle === "annual" ? "pagamento annuale" : "12 pagamenti mensili"}{setupFee > 0 ? " · avviamento incluso" : ""}</span></div>
          <dl className="pp-deal-breakdown"><div><dt>Valore di listino</dt><dd>{formatQuotePrice(quoteResult.listAnnualCents)}</dd></div>{quoteResult.annualPaymentDiscountCents > 0 && <div><dt>Due mesi inclusi</dt><dd>− {formatQuotePrice(quoteResult.annualPaymentDiscountCents)}</dd></div>}{quoteResult.locationDiscountCents > 0 && <div><dt>Vantaggio multisede</dt><dd>− {formatQuotePrice(quoteResult.locationDiscountCents)}</dd></div>}{quoteResult.commercialDiscountCents > 0 && <div><dt>Sconto commerciale</dt><dd>− {formatQuotePrice(quoteResult.commercialDiscountCents)}</dd></div>}{setupFee > 0 && <div><dt>Avviamento</dt><dd>+ {formatQuotePrice(setupFee * 100)}</dd></div>}<div className="is-total"><dt>Rinnovo annuale</dt><dd>{formatQuotePrice(quoteResult.recurringAnnualCents)}</dd></div></dl>
          <div className="pp-deal-metrics"><div><span>Equivalente mensile</span><strong>{formatQuotePrice(quoteResult.effectiveMonthlyCents)}</strong></div><div><span>Per sede / mese</span><strong>{formatQuotePrice(quoteResult.effectiveMonthlyPerLocationCents)}</strong></div><div><span>Vantaggio totale</span><strong>{quoteResult.totalDiscountPercent.toFixed(1).replace(".", ",")}%</strong></div><div><span>Per ripagarsi</span><strong>{quoteResult.breakEvenBookings} servizi</strong></div></div>
          <footer><AppIcon name="spark" size={20} /><p>Il cliente riceve un vantaggio di <b>{formatQuotePrice(quoteResult.totalDiscountCents)}</b> rispetto al listino pieno. La proposta resta valida per {validityDays} giorni.</p></footer>
        </aside>
      </div>
    </section>

    <section className="pp-roi" id="ritorno">
      <div className="pp-roi-copy"><p>Simulatore prudente</p><h2>Quanti appuntamenti servono per ripagare il piano?</h2><span>Non stimiamo miracoli. Partiamo da tre dati del salone e calcoliamo uno scenario trasparente.</span>
        <div className="pp-plan-selector" aria-label="Piano da simulare">{PLAN_ORDER.map((key) => <button className={selectedPlan === key ? "is-active" : ""} type="button" onClick={() => setSelectedPlan(key)} key={key}>{config.piani[key].nome}</button>)}</div>
        <label><span>Appuntamenti al mese <b>{appointments}</b></span><input type="range" min="60" max="500" step="10" value={appointments} onChange={(event) => setAppointments(Number(event.target.value))} /></label>
        <label><span>Ticket medio <b>{averageTicket} €</b></span><input type="range" min="20" max="100" step="5" value={averageTicket} onChange={(event) => setAverageTicket(Number(event.target.value))} /></label>
        <label><span>Appuntamenti recuperati <b>{recoveryRate}%</b></span><input type="range" min="1" max="10" step="1" value={recoveryRate} onChange={(event) => setRecoveryRate(Number(event.target.value))} /></label>
      </div>
      <div className="pp-roi-result">
        <div className="pp-roi-label"><span>Scenario {planName}</span><b>pagamento annuale</b></div>
        <strong>+ {formatNumber(additionalYear)} €</strong><p>ricavi aggiuntivi potenziali in 12 mesi</p>
        <dl><div><dt>Appuntamenti recuperati</dt><dd>{recoveredMonthly} / mese</dd></div><div><dt>Costo annuale</dt><dd>{formatPrice(annualPrice)}</dd></div><div><dt>Beneficio al netto del piano</dt><dd>+ {formatNumber(netBenefit)} €</dd></div><div><dt>Rapporto valore / costo</dt><dd>{roi.toFixed(1).replace(".", ",")}×</dd></div></dl>
        <aside><AppIcon name="spark" size={20} /><p>Per coprire il piano bastano <b>{breakEvenBookings} appuntamenti l’anno</b>, circa {breakEvenMonthly.toFixed(1).replace(".", ",")} al mese, con un ticket medio di {averageTicket} €.</p></aside>
        <small>Simulazione matematica basata sui valori inseriti. Non è una garanzia di fatturato: il risultato dipende da utilizzo, domanda, prezzi e gestione dell’attività.</small>
      </div>
    </section>

    <section className="pp-choice" id="scelta">
      <header><p>Una regola semplice</p><h2>Il piano giusto non è il più economico.<br />È quello che viene usato davvero.</h2></header>
      <div><article><span>Se vuoi ordine</span><strong>{config.piani.start.nome}</strong><p>Digitalizza il lavoro essenziale e offre al cliente una prenotazione moderna.</p></article><article className="is-selected"><span>Se vuoi crescita</span><strong>{config.piani.studio.nome}</strong><p>È il miglior equilibrio tra costo, ritorno, vendite e fidelizzazione.</p></article><article><span>Se vuoi controllo</span><strong>{config.piani.pro.nome}</strong><p>Usa dati, integrazioni e accesso anticipato per guidare le decisioni.</p></article></div>
      <Link to="/presentazione/atelier">Torna alla presentazione prodotto <AppIcon name="arrow" size={18} /></Link>
    </section>

    <footer className="pp-footer"><div><span>NI</span><strong>Niche Studio</strong></div><p>Listino e condizioni configurabili dal pannello amministrativo.</p><a href="#inizio">Torna all’inizio ↑</a></footer>
  </main>;
}
