import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";

const GUIDES = [
  { id: "avvio", title: "Configura il salone", time: "8 min", icon: "building" as const, description: "Orari, servizi, team e identità visiva: tutto ciò che serve prima di aprire le prenotazioni.", steps: ["Controlla gli orari del punto vendita", "Inserisci servizi, durata e prezzo", "Aggiungi gli operatori e le disponibilità", "Verifica logo e dati del salone"], to: "/dashboard/orari" },
  { id: "agenda", title: "Gestisci una giornata", time: "5 min", icon: "calendar" as const, description: "Conferma richieste, modifica l’operatore effettivo e chiudi il servizio alla cassa.", steps: ["Apri la vista Giorno", "Conferma le richieste in attesa", "Controlla i dettagli passando sullo slot", "Completa il servizio e registra l’incasso"], to: "/dashboard/prenotazioni" },
  { id: "clienti", title: "Clienti e visite dirette", time: "4 min", icon: "users" as const, description: "Mantieni corretto lo storico anche quando una persona entra senza aver prenotato dall’app.", steps: ["Cerca o inserisci il cliente", "Apri la sua scheda", "Registra il servizio effettuato", "Controlla storico, acquisti e punti"], to: "/dashboard/clienti" },
  { id: "marketing", title: "Crea una campagna", time: "7 min", icon: "gift" as const, description: "Riempi gli spazi liberi e misura utilizzi, conversione e rapidità di risposta dei coupon.", steps: ["Scegli il segmento o i clienti", "Crea il coupon", "Imposta giorno e fascia oraria", "Monitora gli utilizzi nel periodo scelto"], to: "/dashboard/notifiche" },
  { id: "fidelity", title: "Fidelity e premi QR", time: "6 min", icon: "card" as const, description: "Configura lo store, accredita i punti e convalida in sicurezza un premio monouso.", steps: ["Imposta i punti per euro", "Crea e pubblica i premi", "Scansiona la card del cliente", "Convalida e brucia il QR premio"], to: "/dashboard/fidelity" },
  { id: "assistenza", title: "Chiedi assistenza", time: "3 min", icon: "ticket" as const, description: "Apri un ticket completo di schermate o registrazione quando qualcosa non funziona.", steps: ["Descrivi cosa stavi facendo", "Allega una schermata o un video", "Invia il ticket", "Segui la risposta dal centro notifiche"], to: "/dashboard/assistenza" },
];

export function TutorialPage() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>("avvio");
  const [completed, setCompleted] = useState<string[]>(() => JSON.parse(localStorage.getItem("salon-tutorial-completed") ?? "[]") as string[]);
  const visible = useMemo(() => GUIDES.filter((guide) => `${guide.title} ${guide.description}`.toLowerCase().includes(query.toLowerCase())), [query]);
  function toggleComplete(id: string) {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id];
    setCompleted(next); localStorage.setItem("salon-tutorial-completed", JSON.stringify(next));
  }
  const progress = Math.round(completed.length / GUIDES.length * 100);

  return <section className="tutorial-page">
    <header className="dashboard-page-header"><div><span>Centro di apprendimento</span><h2>Tutorial</h2><p>Guide rapide per usare il gestionale in autonomia, dal primo accesso alla fidelizzazione.</p></div></header>
    <section className="tutorial-hero"><div><AppIcon name="help" size={30} /><span>Il tuo percorso</span><strong>{progress}% completato</strong><p>{completed.length} guide concluse su {GUIDES.length}</p></div><i><b style={{ width: `${progress}%` }} /></i><label><AppIcon name="spark" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca una guida…" /></label></section>
    <div className="tutorial-grid">{visible.map((guide, index) => <article className={`${open === guide.id ? "is-open" : ""}${completed.includes(guide.id) ? " is-complete" : ""}`} key={guide.id}><button className="tutorial-card__header" type="button" onClick={() => setOpen((current) => current === guide.id ? null : guide.id)}><span><AppIcon name={guide.icon} size={22} /></span><div><small>{String(index + 1).padStart(2, "0")} · {guide.time}</small><h3>{guide.title}</h3><p>{guide.description}</p></div><b>{open === guide.id ? "−" : "+"}</b></button>{open === guide.id && <div className="tutorial-card__content"><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol><footer><Link to={guide.to}>Apri la sezione <AppIcon name="arrow" size={16} /></Link><button type="button" onClick={() => toggleComplete(guide.id)}>{completed.includes(guide.id) ? "Segna da rivedere" : "Segna come completato"}</button></footer></div>}</article>)}</div>
    {visible.length === 0 && <div className="tutorial-empty"><AppIcon name="help" size={28} /><strong>Nessuna guida trovata</strong><span>Prova con “agenda”, “coupon” o “fidelity”.</span></div>}
  </section>;
}
