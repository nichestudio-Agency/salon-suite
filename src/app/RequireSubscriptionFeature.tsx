import { useState, type ReactNode } from "react";
import type { SubscriptionFeatureKey } from "../domain/models";
import { AppIcon } from "../components/AppIcon";
import { activateFeatureTrial } from "../firebase/subscription-repo";
import { useSubscriptionAccess } from "./subscription-access";
import "./subscription.css";

const FEATURE_COPY: Record<SubscriptionFeatureKey, { title: string; description: string; metric: string; secondary: string }> = {
  agenda: { title: "Agenda intelligente", description: "Organizza gli appuntamenti e individua subito gli spazi liberi.", metric: "26 appuntamenti", secondary: "+12,4% questa settimana" },
  clienti: { title: "Archivio clienti", description: "Conosci visite, acquisti e valore di ogni cliente.", metric: "438 clienti", secondary: "37 da ricontattare" },
  servizi_team: { title: "Servizi e team", description: "Gestisci offerta, disponibilità e performance degli operatori.", metric: "14 servizi", secondary: "6 operatori attivi" },
  prodotti_ordini: { title: "Prodotti e ordini", description: "Vendi anche fuori dal salone e controlla ogni ritiro.", metric: "€ 2.846", secondary: "81 prodotti venduti" },
  marketing: { title: "Marketing mirato", description: "Riempi le fasce vuote con campagne misurabili e segmentate.", metric: "31,8%", secondary: "conversione campagne" },
  fidelity: { title: "Fidelity digitale", description: "Premia la continuità con punti, QR e uno store dedicato.", metric: "12.480 punti", secondary: "74 premi riscattati" },
  statistiche: { title: "Statistiche avanzate", description: "Leggi trend, cali e opportunità prima che diventino evidenti.", metric: "+18,7%", secondary: "ricavi negli ultimi 90 giorni" },
  integrazioni: { title: "Cassa e integrazioni", description: "Collega incassi, fidelity e operazioni senza duplicare il lavoro.", metric: "98,3%", secondary: "movimenti riconciliati" },
  importazione: { title: "Importazione dati", description: "Porta clienti, servizi e storico nella nuova piattaforma.", metric: "1.284 record", secondary: "pronti per l’importazione" },
  app_cliente: { title: "App cliente", description: "Offri prenotazioni, shop e fidelity nell’esperienza del tuo salone.", metric: "642 accessi", secondary: "nell’ultimo mese" },
};

function FeatureUpgradePage({ feature, planNames }: { feature: SubscriptionFeatureKey; planNames: string[] }) {
  const copy = FEATURE_COPY[feature];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);

  async function startTrial() {
    setBusy(true);
    setError(null);
    try {
      const result = await activateFeatureTrial(feature);
      setExpiry(result.scadeIl);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (caught) {
      const code = (caught as { code?: string }).code ?? "";
      setError(code.includes("failed-precondition") ? "La prova gratuita è già stata utilizzata per questa funzione." : "Non siamo riusciti ad attivare la prova. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="feature-upgrade" aria-labelledby="feature-upgrade-title">
      <div className="feature-upgrade__preview" aria-hidden="true">
        <header><span>{copy.title}</span><i>Ultimi 30 giorni</i></header>
        <div className="feature-upgrade__metric"><small>Panoramica</small><strong>{copy.metric}</strong><span>{copy.secondary}</span></div>
        <div className="feature-upgrade__chart"><i /><i /><i /><i /><i /><i /><i /><i /></div>
        <div className="feature-upgrade__rows"><span /><span /><span /><span /></div>
      </div>
      <aside className="feature-upgrade__overlay">
        <span className="feature-upgrade__lock"><AppIcon name="lock" size={28} /></span>
        <small>Funzionalità premium</small>
        <h1 id="feature-upgrade-title">{copy.title}</h1>
        <p>{copy.description}</p>
        <div className="feature-upgrade__availability"><span>Disponibile con</span><strong>{planNames.length ? planNames.join(" e ") : "un piano superiore"}</strong></div>
        {expiry ? <p className="feature-upgrade__success"><AppIcon name="check" size={17} /> Prova attiva fino al {expiry}</p> : <button type="button" onClick={() => void startTrial()} disabled={busy}>{busy ? "Attivazione…" : "Prova gratis per 14 giorni"}<AppIcon name="arrow" size={18} /></button>}
        <small className="feature-upgrade__fineprint">Nessun addebito automatico. Al termine tornerai al piano attuale.</small>
        {error && <p className="feature-upgrade__error" role="alert">{error}</p>}
      </aside>
    </section>
  );
}

export function RequireSubscriptionFeature({ feature, children }: { feature: SubscriptionFeatureKey; children: ReactNode; fallback?: string }) {
  const { loading, config, has } = useSubscriptionAccess();
  if (loading) return <div className="dashboard-loading">Verifico il piano attivo…</div>;
  if (has(feature)) return children;
  const planNames = Object.values(config.piani).filter((plan) => plan.funzionalita.includes(feature)).map((plan) => plan.nome);
  return <FeatureUpgradePage feature={feature} planNames={planNames} />;
}
