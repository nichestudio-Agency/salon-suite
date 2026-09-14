import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import type { FidelityConfig, FidelityReward, FidelityRewardType, LoyaltyAccount } from "../domain/models";
import { formatEuro } from "../domain/money";
import { creditLoyaltyPoints, listLoyaltyAccounts, lookupLoyaltyCard, redeemLoyaltyReward, updateFidelityConfig, validateRewardRedemption } from "../firebase/loyalty-repo";
import { getSalonAnalytics, type RewardMetric } from "../firebase/analytics-repo";

const DEFAULT_CONFIG: FidelityConfig = { attiva: true, puntiPerEuro: 1, sogliaPremio: 100, premioNome: "Buono da 10 €", premioValore: 1000 };

function messageFromError(error: unknown) {
  const message = (error as { message?: string })?.message ?? "";
  if (message.includes("not-found")) return "Card non trovata. Controlla il codice e riprova.";
  if (message.includes("already-exists")) return "Questa operazione è già stata registrata.";
  if (message.includes("failed-precondition")) return "Il saldo non è sufficiente oppure il programma non è attivo.";
  return "Non siamo riusciti a completare l’operazione.";
}

export function LoyaltyManagementPage() {
  const { salonId } = useAuth();
  const { salon } = useSalonTenant();
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [selected, setSelected] = useState<LoyaltyAccount | null>(null);
  const [config, setConfig] = useState<FidelityConfig>(salon?.fidelity ?? DEFAULT_CONFIG);
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("Servizio completato in salone");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [rewardStats, setRewardStats] = useState<RewardMetric[]>([]);
  const [rewardName, setRewardName] = useState(""); const [rewardDescription, setRewardDescription] = useState(""); const [rewardPoints, setRewardPoints] = useState("100"); const [rewardValue, setRewardValue] = useState("10"); const [rewardType, setRewardType] = useState<FidelityRewardType>("buono"); const [redemptionCode, setRedemptionCode] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function reload(id: string) {
    const [result, insights] = await Promise.all([listLoyaltyAccounts(id), getSalonAnalytics(id).catch(() => null)]);
    setAccounts(result.accounts ?? []);
    setConfig(result.config);
    setRewardStats(insights?.rewards ?? []);
    if (selected) setSelected((result.accounts ?? []).find((item) => item.clientId === selected.clientId) ?? null);
  }

  useEffect(() => {
    if (!salonId) return;
    void Promise.all([listLoyaltyAccounts(salonId), getSalonAnalytics(salonId).catch(() => null)])
      .then(([result, insights]) => {
        setAccounts(result.accounts ?? []);
        setConfig(result.config);
        setRewardStats(insights?.rewards ?? []);
      })
      .catch(() => setError("Non è stato possibile caricare il programma fidelity."))
      .finally(() => setLoading(false));
  }, [salonId]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startScanner() {
    type DetectedCode = { rawValue?: string };
    type Detector = { detect(source: HTMLVideoElement): Promise<DetectedCode[]> };
    type DetectorConstructor = new (options: { formats: string[] }) => Detector;
    const DetectorClass = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!DetectorClass) {
      setError("Questo browser non supporta la scansione diretta. Inserisci il codice stampato sotto al QR.");
      return;
    }
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      setScanning(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      const detector = new DetectorClass({ formats: ["qr_code"] });
      const scan = async () => {
        if (!streamRef.current || !videoRef.current || !salonId) return;
        const codes = await detector.detect(videoRef.current).catch(() => []);
        const raw = codes[0]?.rawValue;
        if (raw) {
          if (raw.startsWith("salon-reward:")) {
            const redemption = await validateRewardRedemption(salonId, raw).catch(() => null);
            if (redemption) { setNotice(`${redemption.rewardNome} convalidato e bruciato.`); setScanning(false); streamRef.current.getTracks().forEach((track) => track.stop()); streamRef.current = null; await reload(salonId); return; }
          }
          const code = raw.startsWith("salon-fidelity:") ? raw.split(":").at(-1) ?? raw : raw;
          const result = await lookupLoyaltyCard(salonId, code).catch(() => null);
          if (result?.account) {
            setSelected(result.account);
            setSearch(result.account.codice);
            setScanning(false);
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            return;
          }
        }
        requestAnimationFrame(() => void scan());
      };
      void scan();
    } catch {
      setScanning(false);
      setError("Non è stato possibile usare la fotocamera. Puoi inserire il codice manualmente.");
    }
  }

  const filteredAccounts = useMemo(() => {
    const value = search.toLowerCase().trim();
    if (!value) return accounts;
    return accounts.filter((item) => `${item.nome} ${item.email} ${item.codice}`.toLowerCase().includes(value));
  }, [accounts, search]);

  async function findCard(event: FormEvent) {
    event.preventDefault();
    if (!salonId || !search.trim()) return;
    setError(null); setNotice(null); setSaving(true);
    try {
      const raw = search.trim();
      const code = raw.startsWith("salon-fidelity:") ? raw.split(":").at(-1) ?? raw : raw;
      const result = await lookupLoyaltyCard(salonId, code);
      if (result.account) setSelected(result.account);
    } catch (nextError) { setError(messageFromError(nextError)); }
    finally { setSaving(false); }
  }

  async function credit(event: FormEvent) {
    event.preventDefault();
    if (!salonId || !selected) return;
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isInteger(cents) || cents <= 0) { setError("Inserisci un importo maggiore di zero."); return; }
    setError(null); setNotice(null); setSaving(true);
    try {
      const result = await creditLoyaltyPoints(salonId, selected.clientId, cents, description);
      if (result.account) setSelected(result.account);
      setNotice(`${result.puntiAccreditati ?? 0} punti accreditati a ${selected.nome}.`);
      setAmount("");
      await reload(salonId);
    } catch (nextError) { setError(messageFromError(nextError)); }
    finally { setSaving(false); }
  }

  async function redeem() {
    if (!salonId || !selected) return;
    setError(null); setNotice(null); setSaving(true);
    try {
      const result = await redeemLoyaltyReward(salonId, selected.clientId);
      if (result.account) setSelected(result.account);
      setNotice(`${config.premioNome} riscattato per ${selected.nome}.`);
      await reload(salonId);
    } catch (nextError) { setError(messageFromError(nextError)); }
    finally { setSaving(false); }
  }

  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    if (!salonId) return;
    setSaving(true); setError(null); setNotice(null);
    try { await updateFidelityConfig(salonId, config); setNotice("Impostazioni fidelity salvate."); }
    catch { setError("Non siamo riusciti a salvare le impostazioni."); }
    finally { setSaving(false); }
  }

  async function addReward(event: FormEvent) {
    event.preventDefault(); if (!salonId || !rewardName.trim()) return;
    const reward: FidelityReward = { id: crypto.randomUUID(), nome: rewardName.trim(), descrizione: rewardDescription.trim(), tipo: rewardType, punti: Math.max(1, Number(rewardPoints)), valore: Math.round(Math.max(0, Number(rewardValue)) * 100), attivo: true };
    const next = { ...config, rewards: [...(config.rewards ?? []), reward] }; setConfig(next); await updateFidelityConfig(salonId, next); setRewardName(""); setRewardDescription(""); setNotice("Premio aggiunto allo store dell’app.");
  }
  async function removeReward(id: string) { if (!salonId) return; const next = { ...config, rewards: (config.rewards ?? []).filter((item) => item.id !== id) }; setConfig(next); await updateFidelityConfig(salonId, next); }
  async function validateCode(event: FormEvent) { event.preventDefault(); if (!salonId) return; setSaving(true); setError(null); try { const item = await validateRewardRedemption(salonId, redemptionCode); setNotice(`${item.rewardNome} convalidato. Il QR ora non è più utilizzabile.`); setRedemptionCode(""); await reload(salonId); } catch (nextError) { setError(messageFromError(nextError)); } finally { setSaving(false); } }

  const activeCount = accounts.filter((item) => item.punti > 0).length;
  const rewardsAvailable = accounts.filter((item) => item.punti >= config.sogliaPremio).length;
  const circulatingPoints = accounts.reduce((sum, item) => sum + item.punti, 0);

  return (
    <section className="loyalty-admin">
      <header className="dashboard-page-header"><div><span>Relazione cliente</span><h2>Fidelity</h2><p>Premia visite e acquisti confermati al banco.</p></div><button className={`loyalty-status ${config.attiva ? "is-active" : ""}`} type="button" onClick={() => setConfig((current) => ({ ...current, attiva: !current.attiva }))}><i />{config.attiva ? "Programma attivo" : "Programma sospeso"}</button></header>

      <div className="loyalty-admin__metrics">
        <article><span>Card create</span><strong>{accounts.length}</strong><small>una per ogni cliente registrato</small></article>
        <article><span>Clienti attivi</span><strong>{activeCount}</strong><small>con un saldo punti</small></article>
        <article className="is-highlight"><span>Premi disponibili</span><strong>{rewardsAvailable}</strong><small>da proporre alla cassa</small></article>
        <article><span>Punti in circolo</span><strong>{circulatingPoints}</strong><small>saldo complessivo</small></article>
      </div>
      <section className="loyalty-insights"><header><div><span>Utilizzo premi</span><h3>Cosa scelgono i clienti</h3></div><small>Riscatti emessi e convalidati</small></header><div>{rewardStats.map((reward, index) => <article key={reward.id}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{reward.label}</strong><span>{reward.issued} richiesti</span></div><div><strong>{reward.used}</strong><span>utilizzati</span></div><i style={{ width: `${reward.issued ? Math.round(reward.used / reward.issued * 100) : 0}%` }} /></article>)}</div>{rewardStats.length === 0 && <p>Nessun premio riscattato nel periodo demo.</p>}</section>

      <div className="loyalty-admin__workspace">
        <section className="loyalty-scanner">
          <header><span>01 / Identifica</span><h3>Scansiona la card</h3><p>Inquadra il QR dal telefono del cliente oppure cerca nome e codice.</p></header>
          <div className={`loyalty-scanner__view${scanning ? " is-scanning" : ""}`}>
            {scanning ? <video ref={videoRef} playsInline muted aria-label="Anteprima fotocamera per scansione QR" /> : <><span className="loyalty-scanner__corners" /><AppIcon name="scan" size={54} /><strong>Scanner QR</strong><small>Usa la fotocamera posteriore del dispositivo</small><button type="button" onClick={() => void startScanner()}>Apri fotocamera</button></>}
          </div>
          <form onSubmit={findCard}><label htmlFor="loyalty-search">Codice card o cliente</label><div><input id="loyalty-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="CARD-… oppure nome" /><button className="btn" type="submit" disabled={saving || !search.trim()}>Cerca</button></div></form>
          {!loading && search && filteredAccounts.length > 0 && !selected && <div className="loyalty-search-results">{filteredAccounts.slice(0, 5).map((account) => <button type="button" onClick={() => setSelected(account)} key={account.clientId}><span>{account.nome.slice(0, 1)}</span><div><strong>{account.nome}</strong><small>{account.codice}</small></div><b>{account.punti} pt</b></button>)}</div>}
        </section>

        <section className={`loyalty-checkout${selected ? " has-customer" : ""}`}>
          {!selected ? <div className="loyalty-checkout__empty"><span><AppIcon name="card" size={32} /></span><strong>Nessuna card selezionata</strong><p>Scansiona il QR o seleziona un cliente per accreditare punti e utilizzare i premi.</p></div> : <>
            <header className="loyalty-customer"><span>{selected.nome.slice(0, 1)}</span><div><small>Cliente identificato</small><strong>{selected.nome}</strong><b>{selected.codice}</b></div><button type="button" onClick={() => { setSelected(null); setNotice(null); }}>Cambia</button></header>
            <div className="loyalty-customer__balance"><div><span>Saldo</span><strong>{selected.punti}<small> pt</small></strong></div><div><span>Visite</span><strong>{selected.visite}</strong></div><div><span>Totali</span><strong>{selected.puntiTotali}<small> pt</small></strong></div></div>
            <form className="loyalty-credit-form" onSubmit={credit}><span>02 / Accredita</span><h3>Chiudi la visita</h3><label htmlFor="loyalty-amount">Importo pagato in negozio</label><div className="loyalty-amount"><span>€</span><input id="loyalty-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" /></div><label htmlFor="loyalty-description">Descrizione</label><input id="loyalty-description" value={description} onChange={(event) => setDescription(event.target.value)} /><button className="btn" type="submit" disabled={saving || !config.attiva}>Conferma e accredita punti <AppIcon name="arrow" size={18} /></button></form>
            <div className={`loyalty-reward ${selected.punti >= config.sogliaPremio ? "is-ready" : ""}`}><AppIcon name="gift" size={27} /><div><span>Premio</span><strong>{config.premioNome}</strong><small>{selected.punti >= config.sogliaPremio ? "Disponibile ora" : `Ancora ${config.sogliaPremio - selected.punti} punti`}</small></div><button className="btn btn--ghost" type="button" disabled={saving || !config.attiva || selected.punti < config.sogliaPremio} onClick={() => void redeem()}>Riscatta</button></div>
          </>}
        </section>
      </div>

      {(notice || error) && <p className={`loyalty-admin__message ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>{error ?? notice}</p>}

      <section className="reward-store-admin"><header><div><span>03 / Catalogo premi</span><h3>Store Fidelity</h3><p>Il cliente sceglie un premio, riceve un QR monouso e l’operatore lo convalida alla cassa.</p></div></header><div className="reward-store-grid">{(config.rewards ?? []).map((reward) => <article key={reward.id}><span>{reward.tipo}</span><h4>{reward.nome}</h4><p>{reward.descrizione || "Premio riscattabile in negozio."}</p><footer><strong>{reward.punti} pt</strong><small>Valore € {formatEuro(reward.valore)}</small><button type="button" onClick={() => void removeReward(reward.id)}>Rimuovi</button></footer></article>)}{(config.rewards ?? []).length === 0 && <div className="reward-store-empty"><AppIcon name="gift" /><strong>Lo store è vuoto</strong><span>Crea il primo premio qui sotto.</span></div>}</div>
        <form className="reward-create-form" onSubmit={addReward}><label>Tipo<select value={rewardType} onChange={(e) => setRewardType(e.target.value as FidelityRewardType)}><option value="buono">Buono</option><option value="servizio">Servizio</option><option value="prodotto">Prodotto</option></select></label><label>Nome<input value={rewardName} onChange={(e) => setRewardName(e.target.value)} required /></label><label>Punti<input type="number" min="1" value={rewardPoints} onChange={(e) => setRewardPoints(e.target.value)} required /></label><label>Valore (€)<input type="number" min="0" step="0.01" value={rewardValue} onChange={(e) => setRewardValue(e.target.value)} /></label><label className="is-wide">Descrizione<input value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} /></label><button className="btn" type="submit">Aggiungi allo store</button></form>
        <form className="reward-validate-form" onSubmit={validateCode}><div><span>Convalida manuale</span><strong>Brucia un QR premio</strong><small>Alternativa allo scanner se la fotocamera non è disponibile.</small></div><input value={redemptionCode} onChange={(e) => setRedemptionCode(e.target.value)} placeholder="PREMIO-XXXXXXXX" /><button className="btn" disabled={!redemptionCode || saving}>Convalida e brucia</button></form>
      </section>

      <form className="loyalty-settings" onSubmit={saveConfig}><header><div><span>04 / Regole</span><h3>Configura il programma</h3></div><button className="btn btn--ghost" type="submit" disabled={saving}>Salva regole</button></header><div><label>Punti per ogni euro<input type="number" min="1" value={config.puntiPerEuro} onChange={(event) => setConfig((current) => ({ ...current, puntiPerEuro: Number(event.target.value) }))} /></label></div><p>Con le regole attuali, una spesa di € 35 genera <strong>{35 * config.puntiPerEuro} punti</strong>. I singoli premi e il loro valore sono gestiti nello Store Fidelity.</p></form>
    </section>
  );
}
