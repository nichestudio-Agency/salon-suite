import { useMemo, useState, type CSSProperties, type ChangeEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
import "./live-presentation.css";

const ASSET_ROOT = "/presentazione-live";
const SAVED_PRESENTATIONS_KEY = "niche.saved-presentations.v1";
type PresentationVariant = "atelier" | "barber";
type SavedPresentation = { id: string; name: string; variant: PresentationVariant; url: string; updatedAt: number };

const VARIANTS = {
  atelier: {
    label: "Atelier", salonName: "Atelier Luce", code: "ATELIER26",
    hero: `${ASSET_ROOT}/hair-hero.webp`, treatment: `${ASSET_ROOT}/trattamento-colore.webp`, products: `${ASSET_ROOT}/hair-products.webp`, closing: `${ASSET_ROOT}/hair-stylist-editoriale.webp`,
    appHome: `${ASSET_ROOT}/atelier-app-home-iphone.webp`, appBooking: `${ASSET_ROOT}/atelier-app-booking-iphone.webp`, appFidelity: `${ASSET_ROOT}/atelier-app-fidelity-iphone.webp`,
    heroKicker: "L’esperienza del tuo atelier diventa digitale",
    heroTitle: <>La relazione continua.<br />Anche dopo l’appuntamento.</>,
    mobileTitle: <>Il tuo atelier.<br />Sempre disponibile.</>,
    heroLead: "Prenotazioni, clienti, vendite e fedeltà in un’unica esperienza firmata dal tuo atelier.",
    appLabel: "App Atelier",
    detail: "Dalla scelta del trattamento al prossimo appuntamento: un percorso semplice per la cliente e ordinato per il salone.",
  },
  barber: {
    label: "Barber", salonName: "Salone X", code: "SALONEX26",
    hero: `${ASSET_ROOT}/barber-hero.webp`, treatment: `${ASSET_ROOT}/beard-treatment.webp`, products: `${ASSET_ROOT}/barber-tools.webp`, closing: `${ASSET_ROOT}/barber-hero.webp`,
    appHome: `${ASSET_ROOT}/barber-app-home-iphone.webp`, appBooking: `${ASSET_ROOT}/barber-app-booking-iphone.webp`, appFidelity: `${ASSET_ROOT}/barber-app-fidelity-iphone.webp`,
    heroKicker: "L’esperienza del tuo barber shop diventa digitale",
    heroTitle: <>Più controllo.<br />Più clienti che tornano.</>,
    mobileTitle: <>Il tuo barber shop.<br />Sempre attivo.</>,
    heroLead: "Agenda, clienti, prodotti e fedeltà in un’unica esperienza costruita intorno al tuo marchio.",
    appLabel: "App Barber",
    detail: "Dalla prenotazione al prossimo taglio: tutto diventa più semplice per il cliente e più ordinato per il team.",
  },
} as const;

const MARKET_STATS = [
  { value: "80%", title: "vuole prenotare online", text: "Il tuo salone non deve smettere di ricevere prenotazioni quando chiude la porta. L’app resta disponibile in ogni momento.", source: "Zenoti Beauty & Wellness Benchmark 2024", href: "https://www.zenoti.com/thecheckin/inside-the-data-top-5-beauty-industry-trends-for-2024" },
  { value: "52%", title: "non aspetta più di 3 minuti al telefono", text: "Se il team è occupato, il cliente non deve rinunciare. Può scegliere e prenotare da solo, senza attese.", source: "Zenoti Salon and Spa Consumer Survey 2024", href: "https://www.zenoti.com/wp-content/uploads/2025/08/2024-Salon-and-Spa-Survey.pdf" },
  { value: "77%", title: "sceglie più volentieri un salone con programma fedeltà", text: "La qualità conquista il cliente. Punti e premi gli danno un motivo concreto per tornare proprio da te.", source: "Zenoti Salon and Spa Consumer Survey 2024", href: "https://www.zenoti.com/wp-content/uploads/2025/08/2024-Salon-and-Spa-Survey.pdf" },
  { value: "78%", title: "acquista i prodotti consigliati almeno qualche volta", text: "Il consiglio dato durante il servizio può diventare un ordine dall’app e una vendita in più per il salone.", source: "Zenoti Salon and Spa Consumer Survey 2024", href: "https://www.zenoti.com/wp-content/uploads/2025/08/2024-Salon-and-Spa-Survey.pdf" },
  { value: "97%", title: "considera importante un servizio personalizzato", text: "Ricordare preferenze, acquisti e servizi precedenti fa percepire attenzione e rende l’esperienza difficile da sostituire.", source: "Zenoti Salon and Spa Consumer Survey 2024", href: "https://www.zenoti.com/wp-content/uploads/2025/08/2024-Salon-and-Spa-Survey.pdf" },
] as const;

const BENEFITS = [
  { feature: "Prenotazione online", detail: "Scelta guidata di servizio, professionista, giorno e orario, con gestione di appuntamenti singoli o ricorrenti.", salon: "Meno telefonate, meno interruzioni e agenda sempre aggiornata", client: "Prenota in autonomia, a qualsiasi ora" },
  { feature: "Promemoria e notifiche", detail: "Conferme, promemoria, aggiornamenti e comunicazioni automatiche prima e dopo l’appuntamento.", salon: "Meno appuntamenti dimenticati e più occasioni per recuperare gli orari liberi", client: "Riceve tutte le informazioni al momento giusto" },
  { feature: "Scheda cliente completa", detail: "Contatti, compleanno, storico di visite e acquisti, preferenze, note, punti e data dell’ultima visita.", salon: "Il team ritrova subito ciò che serve per riconoscere e seguire ogni cliente", client: "Riceve un servizio più attento, coerente e personale" },
  { feature: "Marketing mirato", detail: "Campagne per compleanni, clienti assenti da 30, 60 o 90 giorni, fasce libere, acquisti e singoli contatti selezionati.", salon: "Invia coupon, sconti o prodotti omaggio alle persone giuste e ne misura l’utilizzo", client: "Riceve proposte utili, legate alle sue abitudini" },
  { feature: "Tessera fedeltà con QR", detail: "Regole punti configurabili, catalogo premi, buoni, prodotti o servizi riscattabili e convalida tramite QR.", salon: "Premia il ritorno senza introdurre pagamenti obbligatori nell’app", client: "Controlla punti e premi e li riscatta con semplicità" },
  { feature: "Prodotti e ordini", detail: "Catalogo con immagini e prezzi, carrello, dettaglio ordine, data indicativa di ritiro e stato della preparazione.", salon: "Trasforma il consiglio professionale in nuove occasioni di vendita", client: "Ordina con calma e ritira quando è più comodo" },
  { feature: "Statistiche operative", detail: "Andamento di servizi, prodotti, operatori, campagne, giorni e fasce orarie più o meno richiesti.", salon: "Capisce cosa sta crescendo, cosa rallenta e dove intervenire", client: "Trova servizi e proposte più vicini alle sue esigenze" },
  { feature: "Assistenza organizzata", detail: "Ticket cliente-salone e salone-Niche con messaggi, immagini, video e materiali utili a descrivere il problema.", salon: "Tutte le richieste restano tracciate e ordinate in un unico spazio", client: "Riceve assistenza senza telefonare o ripetere il problema" },
] as const;

const RETENTION_STATS = [
  { value: "33%", title: "riprenota entro 24 ore nelle attività con i risultati migliori", text: "La media di settore è molto più bassa. Chiedere il prossimo appuntamento al momento giusto può trasformare una visita in una relazione continuativa.", source: "Zenoti Beauty and Wellness Industry Statistics 2024", href: "https://www.zenoti.com/thecheckin/beauty-wellness-industry-statistics-2024" },
  { value: "81%", title: "è più propenso a riprenotare dopo un’offerta personalizzata", text: "Un messaggio costruito sulle reali abitudini del cliente vale più di una promozione uguale per tutti.", source: "Zenoti Salon and Spa Consumer Survey 2024", href: "https://www.zenoti.com/wp-content/uploads/2025/08/2024-Salon-and-Spa-Survey.pdf" },
] as const;

function PresentationMark() {
  return <span className="lp-mark" aria-hidden="true"><span /><span /></span>;
}

function validHex(value: string | null, fallback: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function relativeLuminance(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  }) ?? [0, 0, 0];
  return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
}

function contrastRatio(first: string, second: string) {
  const a = relativeLuminance(first);
  const b = relativeLuminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function textOnColour(background: string) {
  return contrastRatio(background, "#121310") >= contrastRatio(background, "#ffffff") ? "#121310" : "#ffffff";
}

function readableAccent(accent: string, background: "light" | "dark") {
  const surface = background === "light" ? "#fafafa" : "#121310";
  if (contrastRatio(accent, surface) >= 3.5) return accent;
  return background === "light" ? "#242522" : "#ffffff";
}

function readPresentationParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    editing: params.get("personalizza") === "1",
    name: params.get("nome")?.slice(0, 60) || "",
    logo: params.get("logo") || "",
    accent: params.get("accento") || "",
    support: params.get("supporto") || "",
    savedId: params.get("salvata") || "",
  };
}

function readSavedPresentations(): SavedPresentation[] {
  try {
    const stored = JSON.parse(localStorage.getItem(SAVED_PRESENTATIONS_KEY) || "[]");
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

async function optimiseLogo(file: File) {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const scale = Math.min(1, 360 / image.width, 180 / image.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/webp", .76);
}

function DemoPhoneScreen({ variant, path, title, brandQuery }: { variant: PresentationVariant; path: "/home" | "/prenota" | "/fidelity"; title: string; brandQuery: string }) {
  const params = new URLSearchParams(brandQuery);
  params.set("phone", "1");
  params.set("next", path);
  return <iframe loading="lazy" tabIndex={-1} title={title} src={`/demo/access/${variant}/client?${params.toString()}`} />;
}

export function LivePresentationPage() {
  const { variant: routeVariant } = useParams();
  const variant: PresentationVariant = routeVariant === "barber" ? "barber" : "atelier";
  const config = VARIANTS[variant];
  const initial = useMemo(readPresentationParams, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editorOpen, setEditorOpen] = useState(initial.editing);
  const defaultAccent = variant === "atelier" ? "#d6869d" : "#f0642f";
  const defaultSupport = variant === "atelier" ? "#aab4bb" : "#9a8a72";
  const [salonName, setSalonName] = useState(initial.name || config.salonName);
  const [salonLogo, setSalonLogo] = useState(initial.logo);
  const [accent, setAccent] = useState(validHex(initial.accent, defaultAccent));
  const [support, setSupport] = useState(validHex(initial.support, defaultSupport));
  const [shareCopied, setShareCopied] = useState(false);
  const [savedPresentations, setSavedPresentations] = useState<SavedPresentation[]>(readSavedPresentations);
  const [currentSavedId, setCurrentSavedId] = useState(initial.savedId);
  const [saveMessage, setSaveMessage] = useState("");
  const accentContrast = textOnColour(accent);
  const themeStyle = ({
    "--lp-accent": accent,
    "--lp-accent-contrast": accentContrast,
    "--lp-accent-on-light": readableAccent(accent, "light"),
    "--lp-accent-on-dark": readableAccent(accent, "dark"),
    "--lp-sage": support,
  } as CSSProperties);

  function presentationUrl(withEditor = false, nextVariant = variant) {
    const params = new URLSearchParams();
    if (withEditor) params.set("personalizza", "1");
    if (salonName !== VARIANTS[nextVariant].salonName) params.set("nome", salonName);
    if (salonLogo) params.set("logo", salonLogo);
    params.set("accento", accent);
    params.set("supporto", support);
    return `${window.location.origin}/presentazione/${nextVariant}?${params.toString()}`;
  }

  function brandQuery() {
    const params = new URLSearchParams();
    params.set("nome", salonName.trim() || config.salonName);
    if (salonLogo) params.set("logo", salonLogo);
    params.set("accento", accent);
    params.set("supporto", support);
    return params.toString();
  }

  function demoUrl(role: "client" | "owner") {
    return `/demo/access/${variant}/${role}?${brandQuery()}`;
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSalonLogo(await optimiseLogo(file));
    event.target.value = "";
  }

  async function copyPresentationLink() {
    await navigator.clipboard.writeText(presentationUrl(false));
    setShareCopied(true);
    window.setTimeout(() => setShareCopied(false), 1800);
  }

  function resetPresentation() {
    setSalonName(config.salonName);
    setSalonLogo("");
    setAccent(defaultAccent);
    setSupport(defaultSupport);
    setCurrentSavedId("");
  }

  function savePresentation() {
    const id = currentSavedId || (typeof crypto.randomUUID === "function" ? crypto.randomUUID() : String(Date.now()));
    const record: SavedPresentation = {
      id,
      name: salonName.trim() || config.salonName,
      variant,
      url: presentationUrl(false),
      updatedAt: Date.now(),
    };
    const next = [record, ...savedPresentations.filter((item) => item.id !== id)].slice(0, 40);
    try {
      localStorage.setItem(SAVED_PRESENTATIONS_KEY, JSON.stringify(next));
      setSavedPresentations(next);
      setCurrentSavedId(id);
      setSaveMessage(currentSavedId ? "Modifiche salvate" : "Presentazione salvata");
      window.setTimeout(() => setSaveMessage(""), 1800);
    } catch {
      setSaveMessage("Spazio esaurito: prova con un logo più leggero");
    }
  }

  function editSavedUrl(item: SavedPresentation) {
    const url = new URL(item.url);
    url.searchParams.set("personalizza", "1");
    url.searchParams.set("salvata", item.id);
    return url.toString();
  }

  async function copySavedLink(item: SavedPresentation) {
    await navigator.clipboard.writeText(item.url);
    setSaveMessage(`Link di ${item.name} copiato`);
    window.setTimeout(() => setSaveMessage(""), 1800);
  }

  function deleteSavedPresentation(id: string) {
    const next = savedPresentations.filter((item) => item.id !== id);
    localStorage.setItem(SAVED_PRESENTATIONS_KEY, JSON.stringify(next));
    setSavedPresentations(next);
    if (currentSavedId === id) setCurrentSavedId("");
  }

  async function copySalonCode() {
    try {
      await navigator.clipboard.writeText(config.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  }

  return (
    <main className={`live-presentation lp-theme-${variant}`} style={themeStyle}>
      <header className="lp-nav">
        <a className="lp-brand lp-client-brand" href="#inizio" onClick={() => setMenuOpen(false)}>{salonLogo ? <img src={salonLogo} alt={`Logo ${salonName}`} /> : <PresentationMark />}<span><b>{salonName}</b><small>Presentazione {config.label}</small></span></a>
        <div className="lp-variant-switch" aria-label="Scegli presentazione">
          <a className={variant === "atelier" ? "is-active" : ""} href={presentationUrl(editorOpen, "atelier")}>Atelier</a>
          <a className={variant === "barber" ? "is-active" : ""} href={presentationUrl(editorOpen, "barber")}>Barber</a>
        </div>
        <button className="lp-menu-button" type="button" aria-label={menuOpen ? "Chiudi menu" : "Apri menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)}><span /><span /></button>
        <nav className={menuOpen ? "is-open" : ""} aria-label="Presentazione">
          <a href="#vantaggi" onClick={() => setMenuOpen(false)}>Perché conviene</a><a href="#esperienza" onClick={() => setMenuOpen(false)}>App cliente</a><a href="#gestione" onClick={() => setMenuOpen(false)}>Dashboard</a><Link to="/presentazione-prezzi" onClick={() => setMenuOpen(false)}>Pacchetti</Link><a className="lp-nav-cta" href="#demo" onClick={() => setMenuOpen(false)}>Prova la demo</a>
        </nav>
      </header>

      <section className="lp-hero" id="inizio">
        <img src={config.hero} alt={variant === "atelier" ? "Professionista al lavoro in atelier" : "Barber al lavoro con un cliente"} />
        <div className="lp-hero-shade" />
        <div className="lp-hero-copy">
          <p className="lp-kicker">{config.heroKicker}</p>
          <h1><span className="lp-title-desktop">{config.heroTitle}</span><span className="lp-title-mobile">{config.mobileTitle}</span></h1>
          <p className="lp-lead">{config.heroLead}</p>
          <div className="lp-actions"><a className="lp-button lp-button-primary" href="#vantaggi" style={{ color: accentContrast }}>Scopri il valore <AppIcon name="arrow" size={18} /></a><a className="lp-button lp-button-quiet" href="#demo">Prova la demo</a></div>
        </div>
        <div className="lp-hero-note"><span>01</span><p>{config.detail}</p></div>
      </section>

      <section className="lp-evidence" id="vantaggi">
        <header><p>I numeri che cambiano la prospettiva</p><h2>Il cliente è già digitale.<br />Il tuo salone deve esserci.</h2><p>Ogni dato mostra un’occasione concreta per ricevere più prenotazioni, aumentare il ritorno e vendere meglio.</p></header>
        <div className="lp-evidence-grid">
          {MARKET_STATS.map((stat, index) => <article key={stat.title} className={index === 0 ? "is-lead" : ""} data-source={`${stat.source}: ${stat.href}`}><strong>{stat.value}</strong><h3>{stat.title}</h3><p>{stat.text}</p></article>)}
          <article className="lp-evidence-rebook" style={{ color: accentContrast }}>
            <header><span>Due leve che riportano il cliente in salone</span><p>Non aspettare che si ricordi di te. Dagli il momento e il motivo giusto per tornare.</p></header>
            <div>{RETENTION_STATS.map((stat) => <section key={stat.value} data-source={`${stat.source}: ${stat.href}`}><strong>{stat.value}</strong><h3>{stat.title}</h3><p>{stat.text}</p></section>)}</div>
          </article>
        </div>
        <p className="lp-source-note">Dati selezionati e verificati da Niche su ricerche internazionali del settore beauty e benessere. I risultati dipendono dall’utilizzo del sistema e dalla gestione della singola attività.</p>
      </section>

      <section className="lp-benefit-map">
        <header className="lp-benefit-intro"><h2>Non solo funzioni.<br />Strumenti per far crescere il rapporto.</h2><p>Ogni parte del sistema risolve un problema operativo e rende più semplice l’esperienza del cliente.</p></header>
        <div className="lp-benefit-heading"><span>Come funziona</span><span>Cosa cambia per il salone</span><span>Cosa cambia per il cliente</span></div>
        {BENEFITS.map(({ feature, detail, salon, client }) => <div className="lp-benefit-row" key={feature}><div><strong>{feature}</strong><small>{detail}</small></div><p>{salon}</p><p>{client}</p></div>)}
      </section>

      <section className="lp-app-section" id="esperienza">
        <div className="lp-section-intro"><p className="lp-kicker">L’esperienza del cliente</p><h2>Il tuo salone<br />sempre a portata di mano.</h2><p>Servizi, professionisti, prodotti, appuntamenti e premi vivono in uno spazio digitale dedicato esclusivamente al tuo marchio.</p></div>
        <div className="lp-phone-gallery" id="mockup-app" aria-label="Schermate reali dell’app cliente">
          <figure className="lp-phone lp-phone-back"><img src={config.appHome} alt="Home dell’app cliente su iPhone" /><figcaption>Home</figcaption></figure>
          <figure className="lp-phone lp-phone-main"><img src={config.appBooking} alt="Prenotazione guidata nell’app cliente su iPhone" /><figcaption>Prenotazione</figcaption></figure>
          <figure className="lp-phone lp-phone-front"><img src={config.appFidelity} alt="Tessera fedeltà digitale nell’app cliente su iPhone" /><figcaption>Fedeltà</figcaption></figure>
        </div>
        <div className="lp-feature-rail"><article><b>01</b><span>Prenotazione guidata</span><p>Il cliente sceglie servizio, professionista, giorno e orario in pochi passaggi.</p></article><article><b>02</b><span>Profilo personale</span><p>Appuntamenti, ordini, richieste di assistenza e preferenze restano sempre disponibili.</p></article><article><b>03</b><span>Programma fedeltà digitale</span><p>Il cliente mostra il proprio QR, controlla i punti e sceglie i premi da riscattare.</p></article></div>
      </section>

      <section className="lp-dashboard-section" id="gestione">
        <div className="lp-dashboard-copy"><p className="lp-kicker">La regia del salone</p><h2>Tutto ciò che serve.<br />In un unico spazio.</h2><p>Agenda, clienti, team, vendite e campagne diventano facili da leggere e veloci da gestire.</p><ul><li><AppIcon name="check" size={18} /> Agenda giornaliera, a tre giorni e settimanale</li><li><AppIcon name="check" size={18} /> Schede cliente con visite, acquisti e preferenze</li><li><AppIcon name="check" size={18} /> Servizi, operatori, prodotti e ordini</li><li><AppIcon name="check" size={18} /> Statistiche chiare per decidere con più sicurezza</li></ul><a href="#demo">Esplora la dashboard <AppIcon name="arrow" size={18} /></a></div>
        <figure className="lp-dashboard-frame"><div className="lp-browser-top"><span /><span /><span /><p>{salonName} · Dashboard</p></div><img src={`${ASSET_ROOT}/dashboard-home.png`} alt="Dashboard reale del salone con agenda e dati della giornata" /><figcaption>Dati dimostrativi del prodotto</figcaption></figure>
      </section>

      <section className="lp-outcomes">
        <header><p className="lp-kicker">Dai dati alle decisioni</p><h2>Molto più di un’agenda digitale.</h2></header>
        <div className="lp-outcome-grid"><article className="lp-outcome-dark"><span>Agenda intelligente</span><h3>Riempi gli orari che rischiano di restare vuoti.</h3><p>Il sistema segnala gli spazi liberi e ti aiuta a creare un’offerta per il momento giusto.</p></article><article className="lp-outcome-photo"><img src={config.treatment} alt={variant === "atelier" ? "Trattamento professionale in atelier" : "Rituale barba professionale"} /></article><article className="lp-outcome-light"><span>Relazione con i clienti</span><h3>Comunica con le persone giuste.</h3><p>Invia auguri, offerte e messaggi mirati in base alle visite e agli acquisti di ogni cliente.</p></article><article className="lp-outcome-accent" style={{ color: accentContrast }}><span>Vendita prodotti</span><h3>Il consiglio continua anche a casa.</h3><p>Il cliente ordina dall’app e sceglie quando ritirare i prodotti in salone.</p></article><article className="lp-outcome-wide"><img src={config.products} alt="Prodotti e strumenti professionali" /><div><span>Controllo dei risultati</span><h3>Scopri cosa funziona e cosa migliorare.</h3><p>Confronta servizi, prodotti, operatori e campagne attraverso dati semplici da interpretare.</p></div></article></div>
      </section>

      <section className="lp-loyalty-section" id="fidelity">
        <div className="lp-loyalty-visual"><figure className="lp-loyalty-dashboard"><img src={`${ASSET_ROOT}/dashboard-fidelity.png`} alt="Gestione del catalogo premi nella dashboard" /></figure><figure className="lp-loyalty-phone"><img src={config.appFidelity} alt="Tessera digitale con codice QR su iPhone" /></figure></div>
        <div className="lp-loyalty-copy"><p className="lp-kicker">La fedeltà funziona anche senza pagamenti nell’app</p><h2>Ogni visita può dare<br />un motivo per tornare.</h2><p>Il cliente mostra il QR. L’operatore registra la visita o l’acquisto, accredita i punti e convalida il premio scelto.</p><ol><li><b>01</b><span><strong>Riconosci il cliente.</strong> Il QR personale apre subito la sua tessera digitale.</span></li><li><b>02</b><span><strong>Registra l’attività.</strong> L’operatore conferma il servizio o l’acquisto effettuato.</span></li><li><b>03</b><span><strong>Convalida il premio.</strong> Il cliente riscatta un buono, un prodotto o un servizio.</span></li></ol></div>
      </section>

      <section className="lp-marketing-section"><div className="lp-marketing-copy"><span className="lp-index">02</span><p className="lp-kicker">Marketing misurabile</p><h2>Comunica meglio.<br />Misura i risultati.</h2><p>Crea coupon e messaggi per gruppi o clienti specifici, poi controlla invii, utilizzi e scadenze nel periodo che preferisci.</p></div><figure className="lp-dashboard-frame lp-dashboard-frame-dark"><div className="lp-browser-top"><span /><span /><span /><p>{salonName} · Marketing</p></div><img src={`${ASSET_ROOT}/dashboard-notifiche.png`} alt="Dashboard marketing con coupon e campagne mirate" /><figcaption>Dati dimostrativi del prodotto</figcaption></figure></section>

      <section className="lp-demo-section" id="demo">
        <div className="lp-demo-heading"><p className="lp-kicker">Prova il sistema dal vivo</p><h2>Due esperienze.<br />Un’unica regia.</h2><p>Entra nell’app del cliente oppure apri la dashboard del titolare. Nessuna schermata statica: puoi utilizzare entrambe le demo.</p></div>
        <div className="lp-demo-grid">
          <article className="lp-demo-card lp-demo-client"><div className="lp-demo-card-top"><span>{config.appLabel}</span><b>iPhone interattivo</b></div><div className="lp-demo-card-visual"><figure className="lp-demo-mini-iphone"><DemoPhoneScreen variant={variant} path="/home" title="Anteprima live dell’app cliente" brandQuery={brandQuery()} /></figure></div><h3>Vivi l’esperienza del cliente.</h3><p>Naviga tra home, prenotazioni, servizi, prodotti, programma fedeltà e profilo come su un vero telefono.</p><div className="lp-code-row"><span><small>Codice salone</small><strong>{config.code}</strong></span><button type="button" onClick={() => void copySalonCode()}>{copied ? "Codice copiato" : "Copia codice"}</button></div><Link to={`/demo/app/${variant}?${brandQuery()}`} target="_blank" style={{ color: accentContrast }}>Apri l’app <AppIcon name="arrow" size={18} /></Link></article>
          <article className="lp-demo-card lp-demo-owner"><div className="lp-demo-card-top"><span>Dashboard del salone</span><b>Accesso diretto</b></div><div className="lp-demo-card-visual"><div className="lp-demo-data-preview"><span><i style={{ height: "42%" }} /><small>L</small></span><span><i style={{ height: "68%" }} /><small>M</small></span><span><i style={{ height: "54%" }} /><small>M</small></span><span><i style={{ height: "86%" }} /><small>G</small></span><span><i style={{ height: "72%" }} /><small>V</small></span></div></div><h3>Guarda il salone con gli occhi del titolare.</h3><p>Entra senza login in una dashboard completa di appuntamenti, clienti, ordini, campagne e statistiche dimostrative.</p><Link to={demoUrl("owner")} target="_blank" style={{ color: accentContrast }}>Apri la dashboard <AppIcon name="arrow" size={18} /></Link></article>
        </div>
        <p className="lp-demo-note">Nella demo utilizziamo dati di esempio. Logo, colori, immagini e impostazioni verranno personalizzati per ogni salone.</p>
      </section>

      <section className="lp-closing"><img src={config.closing} alt="Professionista al lavoro" /><div>{salonLogo ? <img className="lp-closing-logo" src={salonLogo} alt={`Logo ${salonName}`} /> : <PresentationMark />}<p>La tecnologia non sostituisce la cura che metti nel tuo lavoro.</p><h2>La rende presente ogni giorno.</h2><a href="#inizio">Rivedi la presentazione <AppIcon name="arrow" size={18} /></a></div></section>
      <footer className="lp-footer"><div className="lp-footer-client"><strong>{salonName}</strong><p>La piattaforma digitale che accompagna il salone e i suoi clienti.</p></div><div className="lp-created-by"><span>Progettato e sviluppato da</span><img src={`${ASSET_ROOT}/niche-studio-logo.png`} alt="Niche Studio" /></div><a href="#demo">Prova la demo</a></footer>

      {initial.editing && <>
        <button className="lp-customizer-toggle" type="button" onClick={() => setEditorOpen((value) => !value)} aria-expanded={editorOpen}><AppIcon name="menu" size={19} />{editorOpen ? "Chiudi" : "Personalizza"}</button>
        <aside className={`lp-customizer ${editorOpen ? "is-open" : ""}`} aria-label="Personalizza la presentazione">
          <header><div><span>Configuratore</span><h2>La presentazione del cliente.</h2></div><button type="button" aria-label="Chiudi configuratore" onClick={() => setEditorOpen(false)}>×</button></header>
          <p>Inserisci l’identità del salone. L’anteprima si aggiorna in tempo reale e il link finale non mostrerà questo pannello.</p>
          <label><span>Nome attività</span><input value={salonName} maxLength={60} onChange={(event) => setSalonName(event.target.value)} /></label>
          <label className="lp-logo-picker"><span>Logo</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(event) => void uploadLogo(event)} /><b>{salonLogo ? "Sostituisci logo" : "Carica logo"}</b></label>
          {salonLogo && <div className="lp-logo-preview"><img src={salonLogo} alt="Anteprima logo" /><button type="button" onClick={() => setSalonLogo("")}>Rimuovi</button></div>}
          <div className="lp-colour-fields"><label><span>Colore principale</span><input type="color" value={accent} onChange={(event) => setAccent(event.target.value)} /></label><label><span>Colore di supporto</span><input type="color" value={support} onChange={(event) => setSupport(event.target.value)} /></label></div>
          <div className="lp-customizer-actions"><button type="button" style={{ color: accentContrast }} onClick={savePresentation}>{saveMessage || (currentSavedId ? "Aggiorna presentazione" : "Salva presentazione")}</button><button type="button" className="is-secondary" onClick={() => void copyPresentationLink()}>{shareCopied ? "Link copiato" : "Copia link cliente"}</button><a href={presentationUrl(false)} target="_blank" rel="noreferrer">Apri anteprima pulita</a><button type="button" className="is-quiet" onClick={resetPresentation}>Nuova presentazione</button></div>
          <section className="lp-saved-presentations">
            <header><strong>Le mie presentazioni</strong><span>{savedPresentations.length}</span></header>
            {savedPresentations.length === 0 ? <p>Qui ritroverai tutte le presentazioni salvate su questo computer.</p> : <div>{savedPresentations.map((item) => <article key={item.id} className={currentSavedId === item.id ? "is-current" : ""}><div><strong>{item.name}</strong><small>{item.variant === "atelier" ? "Atelier" : "Barber"} · {new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(item.updatedAt)}</small></div><nav aria-label={`Azioni per ${item.name}`}><a href={item.url} target="_blank" rel="noreferrer">Apri</a><button type="button" onClick={() => void copySavedLink(item)}>Copia</button><a href={editSavedUrl(item)}>Modifica</a><button type="button" className="is-delete" aria-label={`Elimina ${item.name}`} onClick={() => deleteSavedPresentation(item.id)}>×</button></nav></article>)}</div>}
          </section>
          <small>Il logo viene ridimensionato e compresso nel browser. Nessun file originale viene caricato su servizi esterni.</small>
        </aside>
      </>}
    </main>
  );
}
