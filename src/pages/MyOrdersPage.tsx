import { useEffect, useState } from "react";
import { listSalons, type SalonWithId } from "../firebase/salon-repo";
import { listMyOrders, cancelOrder, type OrderWithId } from "../firebase/order";
import { formatEuro } from "../domain/money";
import "./customer.css";

export function MyOrdersPage() {
  const [salons, setSalons] = useState<SalonWithId[]>([]);
  const [salonId, setSalonId] = useState("");
  const [orders, setOrders] = useState<OrderWithId[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listSalons().then((s) => {
      setSalons(s);
      if (s.length > 0) setSalonId((cur) => cur || s[0].id);
    });
  }, []);

  async function reload(id: string) {
    setOrders(await listMyOrders(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
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
      <span className="customer-shell__eyebrow">I miei ordini</span>
      <h1>Ordini</h1>
      {error && <p className="customer-error" role="alert">{error}</p>}
      <div className="booking-field">
        <label htmlFor="mo-salon">Salone</label>
        <select id="mo-salon" value={salonId} onChange={(e) => setSalonId(e.target.value)}>
          {salons.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
      </div>
      {orders.length === 0 && <p className="customer-booking__meta">Nessun ordine.</p>}
      {orders.map((o) => (
        <div className="customer-booking" key={o.id}>
          <span>
            <strong>{o.items.map((i) => `${i.titolo} ×${i.qta}`).join(", ")}</strong>
            <br />
            <span className="customer-booking__meta">Stato: {o.stato} · € {formatEuro(o.totale)}</span>
          </span>
          {o.stato === "in_attesa" && (
            <button className="customer-button customer-button--secondary" onClick={() => onCancel(o.id)}>Annulla</button>
          )}
        </div>
      ))}
    </section>
  );
}
