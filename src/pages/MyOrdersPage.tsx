import { useEffect, useState } from "react";
import { listMyOrders, cancelOrder, type OrderWithId } from "../firebase/order";
import { formatEuro } from "../domain/money";
import "./customer.css";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";

const ORDER_STATUS = { in_attesa: "Ricevuto", pronto: "Pronto al ritiro", ritirato: "Ritirato", annullato: "Annullato" } as const;

export function MyOrdersPage() {
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const [orders, setOrders] = useState<OrderWithId[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function reload(id: string) {
    setOrders(await listMyOrders(id));
  }
  useEffect(() => {
    if (salonId) {
      setLoading(true);
      void reload(salonId).catch(() => setError("Non siamo riusciti a caricare gli ordini.")).finally(() => setLoading(false));
    }
  }, [salonId]);

  async function onCancel(id: string) {
    if (!salonId) return;
    setError(null);
    try {
      await cancelOrder(salonId, id);
      await reload(salonId);
    } catch {
      setError("Operazione non riuscita. Aggiorna la pagina e riprova.");
    }
  }

  return (
    <section className="customer-page">
      <header className="customer-shell__header"><div><span className="customer-shell__eyebrow">Acquisti in salone</span><h1>I miei ordini</h1><p>Segui la preparazione e ritrova gli acquisti effettuati dall’app.</p></div><a className="customer-icon-button" href="/catalogo" aria-label="Vai allo shop"><AppIcon name="bag" /></a></header>
      {error && <p className="customer-error" role="alert">{error}</p>}
      {loading && <div className="customer-list-skeleton" aria-label="Caricamento ordini"><span /><span /><span /></div>}
      {!loading && orders.length === 0 && <div className="customer-empty customer-empty--stacked"><AppIcon name="orders" /><strong>Nessun ordine</strong><p>Quando acquisti un prodotto, potrai seguirlo da qui.</p><a className="customer-button" href="/catalogo">Scopri i prodotti</a></div>}
      <div className="customer-order-list">{!loading && orders.map((o) => (
        <article className="customer-order-card" key={o.id}>
          <header><span className={`order-status is-${o.stato}`}>{ORDER_STATUS[o.stato]}</span><strong>€ {formatEuro(o.totale)}</strong></header>
          <div><h2>{o.items.map((i) => `${i.titolo} ×${i.qta}`).join(", ")}</h2><p>Ordine #{o.id.slice(0, 6).toUpperCase()}</p>{o.pointsEarned ? <small>+{o.pointsEarned} punti fidelity</small> : null}</div>
          {o.stato === "in_attesa" && (
            <button className="customer-button customer-button--secondary" onClick={() => onCancel(o.id)}>Annulla</button>
          )}
        </article>
      ))}</div>
    </section>
  );
}
