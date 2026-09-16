import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "../app/auth-context";
import { AppIcon } from "../components/AppIcon";
import { formatEuro } from "../domain/money";
import { getSalonAnalytics, type RankedMetric, type SalonAnalytics } from "../firebase/analytics-repo";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listOperatorStats, type OperatorStats } from "../firebase/sales-repo";

type Period = 30 | 90 | 180 | "custom";
type SelectedMetric = { kind: "servizio" | "prodotto"; metric: RankedMetric };
const WEEKDAYS = ["Mar", "Mer", "Gio", "Ven", "Sab"];
const change = (current: number, previous: number) => previous ? Math.round(((current - previous) / previous) * 100) : current ? 100 : 0;
const trendText = (value: number) => `${value > 0 ? "+" : ""}${value}%`;

function Ranking({ title, items, unit, periodLabel, onSelect }: { title: string; items: RankedMetric[]; unit: string; periodLabel: string; onSelect: (metric: RankedMetric) => void }) {
  const max = Math.max(...items.map((item) => item.current), 1);
  return <section className="analytics-ranking"><header><span>{periodLabel}</span><h3>{title}</h3></header><div>{items.map((item, index) => <button className="analytics-ranking__row" type="button" onClick={() => onSelect(item)} key={item.id}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{item.label}</strong><span><i style={{ width: `${Math.max(7, item.current / max * 100)}%` }} /></span></div><div><strong>{item.current} {unit}</strong><small className={item.trend < 0 ? "is-down" : "is-up"}>{trendText(item.trend)} vs periodo prima</small></div><AppIcon name="arrow" size={15} /></button>)}</div>{items.length === 0 && <p className="analytics-empty">Lo storico comparirà dopo le prime vendite.</p>}</section>;
}

function PerformanceMix({ title, rows }: { title: string; rows: Array<{ id: string; label: string; quantity: number; revenue: number }> }) {
  const max = Math.max(...rows.map((row) => row.quantity), 1);
  return <section><strong>{title}</strong>{rows.slice(0, 4).map((row) => <article key={row.id}><div><span>{row.label}</span><small>{row.quantity} · € {formatEuro(row.revenue)}</small></div><i><b style={{ width: `${Math.max(8, row.quantity / max * 100)}%` }} /></i></article>)}{rows.length === 0 && <p>Nessun dato nel periodo.</p>}</section>;
}

export function AnalyticsPage() {
  const { salonId } = useAuth();
  const [data, setData] = useState<SalonAnalytics | null>(null);
  const [period, setPeriod] = useState<Period>(30);
  const [customFrom, setCustomFrom] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 29); return date.toISOString().slice(0, 10); });
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<SelectedMetric | null>(null);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [operatorStats, setOperatorStats] = useState<OperatorStats[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("operator"));
  const [error, setError] = useState(false);
  const requestedMetric = useMemo<{ kind: "servizio" | "prodotto"; id: string } | null>(() => { const query = new URLSearchParams(window.location.search); const kind = query.get("kind"); const id = query.get("id"); return (kind === "servizio" || kind === "prodotto") && id ? { kind, id } : null; }, []);
  const range = useMemo(() => period === "custom" ? { from: customFrom, to: customTo } : undefined, [customFrom, customTo, period]);
  const numericPeriod = period === "custom" ? Math.max(1, Math.round((new Date(`${customTo}T12:00:00`).getTime() - new Date(`${customFrom}T12:00:00`).getTime()) / 86_400_000) + 1) : period;
  const periodLabel = period === "custom" ? `${new Intl.DateTimeFormat("it-IT").format(new Date(`${customFrom}T12:00:00`))} – ${new Intl.DateTimeFormat("it-IT").format(new Date(`${customTo}T12:00:00`))}` : `Ultimi ${period} giorni`;
  useEffect(() => {
    if (!salonId) return;
    let active = true;
    setData(null);
    void Promise.all([
      getSalonAnalytics(salonId, numericPeriod, range),
      listOperators(salonId).catch(() => []),
      listOperatorStats(salonId, range?.from ?? (() => { const date = new Date(); date.setDate(date.getDate() - numericPeriod + 1); return date.toISOString().slice(0, 10); })(), range?.to).catch(() => []),
    ]).then(([result, operatorList, stats]) => { if (active) { setData(result); setOperators(operatorList); setOperatorStats(stats); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [salonId, period, customFrom, customTo, numericPeriod, range]);
  useEffect(() => {
    if (!data || !requestedMetric || selected) return;
    const metric = (requestedMetric.kind === "servizio" ? data.services : data.products).find((item) => item.id === requestedMetric.id);
    if (metric) setSelected({ kind: requestedMetric.kind, metric });
  }, [data, requestedMetric, selected]);
  function selectPeriod(value: Period) { setError(false); setSelected(null); setPeriod(value); }
  const maxDemand = useMemo(() => Math.max(...(data?.demand.map((cell) => cell.count) ?? [1]), 1), [data]);
  const busiest = useMemo(() => data?.demand.reduce((best, cell) => cell.count > best.count ? cell : best, data.demand[0]), [data]);
  const bookingTrend = data ? change(data.completedBookings, data.previousCompletedBookings) : 0;
  const revenueTrend = data ? change(data.revenue, data.previousRevenue) : 0;
  const loadingClass = data ? "" : " is-loading";
  const selectedOperator = operatorStats.find((item) => item.operatorId === selectedOperatorId);
  const selectedOperatorName = operators.find((item) => item.id === selectedOperatorId)?.nome;

  return <section className="analytics-page">
    <header className="dashboard-page-header analytics-header"><div><span>Controllo attività</span><h2>Statistiche</h2><p>Capisci cosa cresce, cosa rallenta e dove c’è spazio da riempire.</p></div><div className="analytics-period-wrap"><div className="analytics-period" aria-label="Periodo statistiche">{([30, 90, 180] as const).map((value) => <button className={period === value ? "is-active" : ""} type="button" onClick={() => selectPeriod(value)} key={value}>{value} gg</button>)}<button className={period === "custom" ? "is-active" : ""} type="button" onClick={() => selectPeriod("custom")}>Personalizzato</button></div>{period === "custom" && <div className="analytics-period-custom"><label>Dal<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /></label><label>Al<input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} /></label></div>}</div></header>
    {error && <p className="owner-home__error">Non è stato possibile caricare le statistiche.</p>}
    <div className={`analytics-kpis${loadingClass}`}>
      <article><span>Prenotazioni concluse</span><strong>{data?.completedBookings ?? ""}</strong><small className={bookingTrend < 0 ? "is-down" : "is-up"}>{data ? `${trendText(bookingTrend)} sul periodo precedente` : "Caricamento dati"}</small></article>
      <article><span>Incasso registrato</span><strong>{data ? `€ ${formatEuro(data.revenue)}` : ""}</strong><small className={revenueTrend < 0 ? "is-down" : "is-up"}>{data ? `${trendText(revenueTrend)} sul periodo precedente` : "Caricamento dati"}</small></article>
      <article><span>Ticket medio</span><strong>{data ? `€ ${formatEuro(data.averageTicket)}` : ""}</strong><small>servizi e prodotti pagati</small></article>
      <article><span>Tasso no-show</span><strong>{data ? `${data.noShowRate}%` : ""}</strong><small>degli appuntamenti recenti</small></article>
    </div>
    <section className="analytics-signal-strip"><div><span>Occupazione stimata</span><strong>{data ? `${data.occupancyRate}%` : "—"}</strong><small>sulle ore disponibili del team</small></div><div><span>Fascia più richiesta</span><strong>{busiest ? `${WEEKDAYS[busiest.weekday - 2]} · ${busiest.hour}:00` : "—"}</strong><small>{busiest?.count ?? 0} appuntamenti conclusi</small></div><p><AppIcon name="spark" size={18} /> Usa i periodi più tranquilli per programmare una campagna “Riempi agenda”.</p></section>
    <div className="analytics-rankings"><Ranking title="Servizi più richiesti" items={data?.services ?? []} unit="visite" periodLabel={periodLabel} onSelect={(metric) => setSelected({ kind: "servizio", metric })} /><Ranking title="Prodotti più venduti" items={data?.products ?? []} unit="pezzi" periodLabel={periodLabel} onSelect={(metric) => setSelected({ kind: "prodotto", metric })} /></div>
    <section className="analytics-demand"><header><div><span>Domanda reale</span><h3>Giorni e fasce orarie</h3><p>Più il colore è intenso, maggiore è il numero di appuntamenti conclusi nel periodo selezionato.</p></div><AppIcon name="chart" size={26} /></header><div className="analytics-heatmap"><span />{Array.from({ length: 10 }, (_, index) => <b key={index}>{index + 9}</b>)}{WEEKDAYS.flatMap((day, dayIndex) => [<strong key={`${day}-label`}>{day}</strong>, ...Array.from({ length: 10 }, (_, hourIndex) => { const cell = data?.demand.find((item) => item.weekday === dayIndex + 2 && item.hour === hourIndex + 9); const intensity = (cell?.count ?? 0) / maxDemand; return <i title={`${day} ${hourIndex + 9}:00 · ${cell?.count ?? 0} appuntamenti`} style={{ "--heat": intensity } as CSSProperties} key={`${day}-${hourIndex}`}>{cell?.count || ""}</i>; })])}</div></section>
    <section className="analytics-operators"><header><div><span>Team</span><h3>Performance operatori</h3><p>Confronto nello stesso periodo delle statistiche generali.</p></div><strong>{periodLabel}</strong></header><div className="analytics-operators__grid">{operators.map((operator) => { const metric = operatorStats.find((item) => item.operatorId === operator.id); return <button className={selectedOperatorId === operator.id ? "is-active" : ""} type="button" onClick={() => setSelectedOperatorId(operator.id)} key={operator.id}><span>{operator.fotoUrl ? <img src={operator.fotoUrl} alt="" /> : operator.nome.slice(0, 1)}</span><div><strong>{operator.nome}</strong><small>{metric?.servedCount ?? 0} visite · € {formatEuro(metric?.serviceRevenue ?? 0)}</small></div><b>{metric?.recentTrend && metric.recentTrend > 0 ? "+" : ""}{metric?.recentTrend ?? 0}%</b></button>; })}</div>{selectedOperator && <div className="analytics-operator-detail"><header><div><span>Dettaglio operatore</span><h4>{selectedOperatorName}</h4></div><button type="button" aria-label="Chiudi dettaglio operatore" onClick={() => setSelectedOperatorId(null)}>×</button></header><div><article><span>Prenotazioni</span><strong>{selectedOperator.bookingCount}</strong><small>{selectedOperator.noShowCount} no-show</small></article><article><span>Clienti unici</span><strong>{selectedOperator.uniqueClients}</strong><small>{selectedOperator.acquiredClients} nuovi</small></article><article><span>Fatturato</span><strong>€ {formatEuro(selectedOperator.serviceRevenue + selectedOperator.productRevenue)}</strong><small>servizi e prodotti</small></article><article><span>Ticket medio</span><strong>€ {formatEuro(selectedOperator.averageTicket)}</strong><small>per visita conclusa</small></article><article><span>Occupazione</span><strong>{selectedOperator.occupancyRate}%</strong><small>capacità stimata</small></article></div><div className="analytics-operator-detail__mix"><PerformanceMix title="Servizi principali" rows={selectedOperator.topServices} /><PerformanceMix title="Prodotti venduti" rows={selectedOperator.topProducts} /></div></div>}</section>
    <section className="analytics-rewards"><header><span>Fidelity</span><h3>Premi più riscattati</h3></header><div>{(data?.rewards ?? []).map((reward) => <article key={reward.id}><span><AppIcon name="gift" size={18} /></span><div><strong>{reward.label}</strong><small>{reward.issued} richiesti · {reward.used} convalidati</small></div><b>{reward.issued ? Math.round(reward.used / reward.issued * 100) : 0}%</b></article>)}</div>{data?.rewards.length === 0 && <p className="analytics-empty">I riscatti compariranno qui.</p>}</section>
    {selected && <><button className="analytics-detail__backdrop" type="button" aria-label="Chiudi dettaglio" onClick={() => setSelected(null)} /><aside className="analytics-detail" aria-label={`Dettaglio ${selected.metric.label}`}><header><div><span>{selected.kind}</span><h3>{selected.metric.label}</h3><p>Movimenti inclusi nel periodo: {periodLabel.toLowerCase()}.</p></div><button type="button" aria-label="Chiudi" onClick={() => setSelected(null)}>×</button></header><div className="analytics-detail__summary"><div><span>Quantità</span><strong>{selected.metric.current}</strong></div><div><span>Ricavi</span><strong>€ {formatEuro(selected.metric.revenue)}</strong></div><div><span>Variazione</span><strong className={selected.metric.trend < 0 ? "is-down" : "is-up"}>{trendText(selected.metric.trend)}</strong></div></div><div className="analytics-detail__list"><header><span>Data</span><span>Cliente</span><span>Qtà</span><span>Valore</span></header>{selected.metric.details.sort((a, b) => b.date.localeCompare(a.date)).map((detail, index) => <article key={`${detail.date}-${detail.client}-${index}`}><time>{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(`${detail.date}T12:00:00`))}</time><strong>{detail.client}</strong><span>{detail.quantity}</span><b>€ {formatEuro(detail.revenue)}</b></article>)}</div></aside></>}
  </section>;
}
