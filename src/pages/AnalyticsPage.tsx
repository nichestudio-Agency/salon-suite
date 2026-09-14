import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../app/auth-context";
import { AppIcon } from "../components/AppIcon";
import { formatEuro } from "../domain/money";
import { getSalonAnalytics, type RankedMetric, type SalonAnalytics } from "../firebase/analytics-repo";

const WEEKDAYS = ["Mar", "Mer", "Gio", "Ven", "Sab"];
const change = (current: number, previous: number) => previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0;
const trendText = (value: number) => `${value > 0 ? "+" : ""}${value}%`;

function Ranking({ title, items, unit }: { title: string; items: RankedMetric[]; unit: string }) {
  const max = Math.max(...items.map((item) => item.current), 1);
  return <section className="analytics-ranking"><header><span>Ultimi 30 giorni</span><h3>{title}</h3></header><div>{items.map((item, index) => <article key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{item.label}</strong><span><i style={{ width: `${Math.max(7, item.current / max * 100)}%` }} /></span></div><div><strong>{item.current} {unit}</strong><small className={item.trend < 0 ? "is-down" : "is-up"}>{trendText(item.trend)} vs periodo prima</small></div></article>)}</div>{items.length === 0 && <p className="analytics-empty">Lo storico comparirà dopo le prime vendite.</p>}</section>;
}

export function AnalyticsPage() {
  const { salonId } = useAuth();
  const [data, setData] = useState<SalonAnalytics | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { if (salonId) void getSalonAnalytics(salonId).then(setData).catch(() => setError(true)); }, [salonId]);
  const maxDemand = useMemo(() => Math.max(...(data?.demand.map((cell) => cell.count) ?? [1]), 1), [data]);
  const bookingTrend = data ? change(data.completedBookings, data.previousCompletedBookings) : 0;
  const revenueTrend = data ? change(data.revenue, data.previousRevenue) : 0;

  return <section className="analytics-page">
    <header className="dashboard-page-header"><div><span>Controllo attività</span><h2>Statistiche</h2><p>Capisci cosa cresce, cosa rallenta e dove c’è spazio da riempire.</p></div><span className="analytics-period">Ultimi 30 giorni</span></header>
    {error && <p className="owner-home__error">Non è stato possibile caricare le statistiche.</p>}
    <div className="analytics-kpis">
      <article><span>Prenotazioni concluse</span><strong>{data?.completedBookings ?? "—"}</strong><small className={bookingTrend < 0 ? "is-down" : "is-up"}>{trendText(bookingTrend)} sul periodo precedente</small></article>
      <article><span>Incasso registrato</span><strong>{data ? `€ ${formatEuro(data.revenue)}` : "—"}</strong><small className={revenueTrend < 0 ? "is-down" : "is-up"}>{trendText(revenueTrend)} sul periodo precedente</small></article>
      <article><span>Ticket medio</span><strong>{data ? `€ ${formatEuro(data.averageTicket)}` : "—"}</strong><small>servizi e prodotti pagati</small></article>
      <article><span>Tasso no-show</span><strong>{data ? `${data.noShowRate}%` : "—"}</strong><small>degli appuntamenti recenti</small></article>
    </div>
    <div className="analytics-rankings"><Ranking title="Servizi più richiesti" items={data?.services ?? []} unit="visite" /><Ranking title="Prodotti più venduti" items={data?.products ?? []} unit="pezzi" /></div>
    <section className="analytics-demand"><header><div><span>Domanda reale</span><h3>Giorni e fasce orarie</h3><p>Più il colore è intenso, maggiore è il numero di appuntamenti conclusi negli ultimi 120 giorni.</p></div><AppIcon name="chart" size={26} /></header><div className="analytics-heatmap"><span />{Array.from({ length: 10 }, (_, index) => <b key={index}>{index + 9}</b>)}{WEEKDAYS.flatMap((day, dayIndex) => [<strong key={`${day}-label`}>{day}</strong>, ...Array.from({ length: 10 }, (_, hourIndex) => { const cell = data?.demand.find((item) => item.weekday === dayIndex + 2 && item.hour === hourIndex + 9); const intensity = (cell?.count ?? 0) / maxDemand; return <i title={`${day} ${hourIndex + 9}:00 · ${cell?.count ?? 0} appuntamenti`} style={{ "--heat": intensity } as CSSProperties} key={`${day}-${hourIndex}`}>{cell?.count || ""}</i>; })])}</div></section>
    <section className="analytics-rewards"><header><span>Fidelity</span><h3>Premi più riscattati</h3></header><div>{(data?.rewards ?? []).map((reward) => <article key={reward.id}><span><AppIcon name="gift" size={18} /></span><div><strong>{reward.label}</strong><small>{reward.issued} richiesti · {reward.used} convalidati</small></div><b>{reward.issued ? Math.round(reward.used / reward.issued * 100) : 0}%</b></article>)}</div>{data?.rewards.length === 0 && <p className="analytics-empty">I riscatti compariranno qui.</p>}</section>
  </section>;
}
