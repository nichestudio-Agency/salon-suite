import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import type { FidelityConfig, FidelityReward, LoyaltyAccount, LoyaltyTransaction, RewardRedemption } from "../domain/models";
import { getMyLoyalty, listMyRewardRedemptions, requestRewardRedemption } from "../firebase/loyalty-repo";
import "./customer.css";

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function LoyaltyCardPage() {
  const { salon } = useSalonTenant();
  const { user } = useAuth();
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);
  const [config, setConfig] = useState<FidelityConfig | null>(null);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [qr, setQr] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]); const [rewardQr, setRewardQr] = useState(""); const [busyReward, setBusyReward] = useState<string | null>(null);

  useEffect(() => {
    if (!salon?.id) return;
    void Promise.all([getMyLoyalty(salon.id), listMyRewardRedemptions(salon.id)])
      .then(([result, nextRedemptions]) => {
        setAccount(result.account ?? null);
        setConfig(result.config);
        setTransactions(result.transactions ?? []);
        setRedemptions(nextRedemptions);
      })
      .catch(() => setError("Non siamo riusciti a caricare la tua card."))
      .finally(() => setLoading(false));
  }, [salon?.id]);

  useEffect(() => {
    if (!account || !salon?.id) return;
    void QRCode.toDataURL(`salon-fidelity:${salon.id}:${account.codice}`, {
      width: 520,
      margin: 1,
      color: { dark: "#171614", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setQr);
  }, [account, salon?.id]);

  const activeRedemption = redemptions.find((item) => item.stato === "emesso");
  useEffect(() => { if (!activeRedemption || !salon?.id) { setRewardQr(""); return; } void QRCode.toDataURL(`salon-reward:${salon.id}:${activeRedemption.codice}`, { width: 520, margin: 1, color: { dark: "#171614", light: "#ffffff" }, errorCorrectionLevel: "M" }).then(setRewardQr); }, [activeRedemption, salon?.id]);
  async function requestReward(reward: FidelityReward) { if (!salon?.id) return; setBusyReward(reward.id); setError(null); try { const item = await requestRewardRedemption(salon.id, reward); setRedemptions((current) => [item, ...current]); } catch { setError("Saldo insufficiente oppure richiesta non disponibile."); } finally { setBusyReward(null); } }

  const progress = useMemo(() => {
    if (!account || !config) return 0;
    return Math.min(100, Math.round((account.punti / config.sogliaPremio) * 100));
  }, [account, config]);
  const missing = account && config ? Math.max(0, config.sogliaPremio - account.punti) : 0;

  if (loading) return <section className="customer-page loyalty-loading"><span /><span /><span /></section>;
  if (error || !account || !config) return <section className="customer-page"><div className="customer-empty"><AppIcon name="card" /><span>{error ?? "Card non disponibile."}</span></div></section>;

  return (
    <section className="customer-page loyalty-page">
      <header className="loyalty-page__header">
        <div><span className="customer-shell__eyebrow">Club {salon?.nome}</span><h1>La tua fidelity</h1><p>Mostra questa card alla cassa. I punti arrivano dopo la conferma del servizio o dell’acquisto.</p></div>
        <span className="loyalty-page__member">Membro dal {new Date().getFullYear()}</span>
      </header>

      <div className="loyalty-layout">
        <article className="loyalty-card">
          <div className="loyalty-card__noise" aria-hidden="true" />
          <header><div>{salon?.branding?.logoUrl ? <img src={salon.branding.logoUrl} alt={`Logo ${salon.nome}`} /> : <span className="loyalty-card__monogram">{salon?.nome.slice(0, 1)}</span>}<strong>{salon?.nome}</strong></div><AppIcon name="spark" size={25} /></header>
          <div className="loyalty-card__balance"><span>Saldo disponibile</span><strong>{account.punti}</strong><small>punti</small></div>
          <footer><div><span>Intestatario</span><strong>{account.nome || user?.displayName || "Cliente"}</strong></div><div><span>Card</span><strong>{account.codice.replace("CARD-", "•• ")}</strong></div></footer>
        </article>

        <article className="loyalty-qr">
          <div className="loyalty-qr__frame">{qr ? <img src={qr} alt="QR code della card fidelity" /> : <span>Creo il QR…</span>}</div>
          <div><span>La tua card digitale</span><strong>Falla scansionare in negozio</strong><small>Il codice identifica solo la card e non contiene dati personali.</small></div>
        </article>
      </div>

      <section className="loyalty-progress">
        <div><span>Prossimo premio</span><strong>{config.premioNome}</strong><small>{missing > 0 ? `Ti mancano ${missing} punti` : "Premio disponibile al prossimo passaggio in cassa"}</small></div>
        <div className="loyalty-progress__meter" aria-label={`${progress}% verso il prossimo premio`}><i style={{ width: `${progress}%` }} /></div>
        <b>{account.punti} / {config.sogliaPremio}</b>
      </section>

      <section className="customer-reward-store"><header><div><span>Store Fidelity</span><h2>Scegli il tuo premio</h2></div><small>Riscatto in negozio</small></header>{activeRedemption && <article className="customer-reward-ticket"><div>{rewardQr && <img src={rewardQr} alt="QR monouso del premio" />}</div><section><span>Premio pronto</span><h3>{activeRedemption.rewardNome}</h3><p>Mostra questo QR all’operatore. Dopo la scansione verrà convalidato e non potrà essere riutilizzato.</p><strong>{activeRedemption.codice}</strong></section></article>}<div className="customer-reward-grid">{(config.rewards ?? []).filter((item) => item.attivo).map((reward) => <article key={reward.id}><span>{reward.tipo}</span><h3>{reward.nome}</h3><p>{reward.descrizione}</p><footer><strong>{reward.punti} punti</strong><button type="button" disabled={Boolean(activeRedemption) || account.punti < reward.punti || busyReward === reward.id} onClick={() => void requestReward(reward)}>{account.punti < reward.punti ? `Mancano ${reward.punti - account.punti}` : activeRedemption ? "QR già emesso" : busyReward === reward.id ? "Creo QR…" : "Riscatta"}</button></footer></article>)}</div></section>

      <section className="loyalty-stats" aria-label="Riepilogo fidelity">
        <article><AppIcon name="check" /><div><strong>{account.visite}</strong><span>visite premiate</span></div></article>
        <article><AppIcon name="spark" /><div><strong>{account.puntiTotali}</strong><span>punti raccolti</span></div></article>
        <article><AppIcon name="gift" /><div><strong>{account.puntiRiscattati}</strong><span>punti utilizzati</span></div></article>
      </section>

      <section className="loyalty-history">
        <header><div><span>Movimenti</span><h2>La storia della card</h2></div><small>Ultimi 20</small></header>
        {transactions.length === 0 ? <div className="loyalty-history__empty"><AppIcon name="spark" /><strong>Il primo punto deve ancora arrivare</strong><p>Dopo il prossimo servizio, il negozio confermerà l’importo e vedrai qui l’accredito.</p></div> : transactions.map((item) => (
          <article key={item.id}><span className={`loyalty-history__icon is-${item.tipo}`}><AppIcon name={item.tipo === "riscatto" ? "gift" : "plus"} size={18} /></span><div><strong>{item.descrizione}</strong><small>{dateLabel(item.createdAt)}</small></div><b>{item.punti > 0 ? "+" : ""}{item.punti} pt</b></article>
        ))}
      </section>
    </section>
  );
}
