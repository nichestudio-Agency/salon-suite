import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
import "./demo-experience.css";

const DEMO_SECTIONS = {
  home: {
    eyebrow: "Home personalizzata",
    title: "Il salone accoglie il cliente anche dallo schermo.",
    text: "La prima schermata mette subito in evidenza ciò che conta e accompagna il cliente verso la prossima azione.",
    points: ["Prossimo appuntamento sempre visibile", "Saldo fidelity e aggiornamenti in primo piano", "Accesso immediato alla prenotazione"],
  },
  servizi: {
    eyebrow: "Servizi",
    title: "L’offerta diventa semplice da capire e scegliere.",
    text: "Ogni servizio può essere presentato con immagine, descrizione, durata e prezzo, senza costringere il cliente a telefonare.",
    points: ["Listino consultabile in autonomia", "Informazioni chiare prima della scelta", "Percorso diretto verso la prenotazione"],
  },
  prenota: {
    eyebrow: "Prenotazione guidata",
    title: "Prenotare richiede pochi passaggi, non una telefonata.",
    text: "Il cliente sceglie servizio, professionista, data e orario seguendo un percorso ordinato e sempre comprensibile.",
    points: ["Disponibilità aggiornata", "Scelta del professionista", "Coupon e appuntamenti ricorrenti"],
  },
  shop: {
    eyebrow: "Shop",
    title: "Il consiglio ricevuto in salone può diventare un ordine.",
    text: "Il cliente ritrova i prodotti consigliati, compone il carrello e indica quando preferisce ritirarli.",
    points: ["Catalogo con immagini e prezzi", "Carrello dedicato ai prodotti", "Ordini e ritiro gestiti dall’app"],
  },
  profilo: {
    eyebrow: "Profilo personale",
    title: "Tutto il rapporto con il salone in un unico spazio.",
    text: "Appuntamenti, ordini, fidelity, aggiornamenti e assistenza restano organizzati e sempre accessibili.",
    points: ["Storico personale", "Fidelity card con QR", "Assistenza tramite ticket"],
  },
} as const;

type DemoSection = keyof typeof DEMO_SECTIONS;

function sectionFromPath(pathname: string): DemoSection {
  if (pathname.startsWith("/servizi") || pathname.startsWith("/operatori")) return "servizi";
  if (pathname.startsWith("/prenota") || pathname.startsWith("/appuntamenti")) return "prenota";
  if (pathname.startsWith("/catalogo") || pathname.startsWith("/carrello") || pathname.startsWith("/i-miei-ordini")) return "shop";
  if (pathname.startsWith("/profilo") || pathname.startsWith("/fidelity") || pathname.startsWith("/aggiornamenti") || pathname.startsWith("/assistenza")) return "profilo";
  return "home";
}

export function PhoneDemoPage() {
  const { variant: rawVariant } = useParams();
  const [searchParams] = useSearchParams();
  const variant = rawVariant === "barber" ? "barber" : "atelier";
  const label = variant === "barber" ? "Barber" : "Atelier";
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const transitionFrameRef = useRef<number | undefined>(undefined);
  const currentSectionRef = useRef<DemoSection>("home");
  const [displayedSection, setDisplayedSection] = useState<DemoSection>("home");
  const [storyChanging, setStoryChanging] = useState(false);
  const content = DEMO_SECTIONS[displayedSection];
  const brandQuery = searchParams.toString();
  const demoAccessUrl = `/demo/access/${variant}/client${brandQuery ? `?${brandQuery}` : ""}`;
  const presentationUrl = `/presentazione/${variant}${brandQuery ? `?${brandQuery}` : ""}`;

  useEffect(() => {
    const handleRoute = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type !== "salon-suite-demo-route" || typeof event.data.pathname !== "string") return;
      const nextSection = sectionFromPath(event.data.pathname);
      if (nextSection === currentSectionRef.current) return;
      window.clearTimeout(transitionTimerRef.current);
      window.cancelAnimationFrame(transitionFrameRef.current ?? 0);
      setStoryChanging(true);
      transitionTimerRef.current = window.setTimeout(() => {
        currentSectionRef.current = nextSection;
        setDisplayedSection(nextSection);
        transitionFrameRef.current = window.requestAnimationFrame(() => setStoryChanging(false));
      }, 290);
    };
    window.addEventListener("message", handleRoute);
    return () => {
      window.removeEventListener("message", handleRoute);
      window.clearTimeout(transitionTimerRef.current);
      window.cancelAnimationFrame(transitionFrameRef.current ?? 0);
    };
  }, []);

  return <main className={`phone-demo phone-demo--${variant}`}>
    <header className="phone-demo__header">
      <Link to={presentationUrl}><AppIcon name="arrow" size={17} /> Torna alla presentazione</Link>
      <span>Demo {label} · App cliente</span>
      <a href={demoAccessUrl} target="_blank" rel="noreferrer">Schermo intero</a>
    </header>
    <section className="phone-demo__stage">
      <aside className={`phone-demo__story${storyChanging ? " is-changing" : ""}`} aria-live="polite">
        <span>{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.text}</p>
        <ul>{content.points.map((point) => <li key={point}>{point}</li>)}</ul>
        <div className="phone-demo__hint"><b>Demo interattiva</b><p>Usa mouse, trackpad o touch. La descrizione cambia mentre navighi.</p></div>
      </aside>
      <div className="iphone-frame" aria-label={`Simulatore iPhone per ${label}`}>
        <i className="iphone-frame__button iphone-frame__button--silent" /><i className="iphone-frame__button iphone-frame__button--up" /><i className="iphone-frame__button iphone-frame__button--down" /><i className="iphone-frame__button iphone-frame__button--power" />
        <div className="iphone-frame__screen"><span className="iphone-frame__island" /><iframe ref={iframeRef} title={`App cliente ${label}`} src={`${demoAccessUrl}${brandQuery ? "&" : "?"}phone=1`} /></div>
      </div>
    </section>
  </main>;
}
