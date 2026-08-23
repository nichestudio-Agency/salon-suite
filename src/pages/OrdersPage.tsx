import { useEffect, useState } from "react";
import { useAuth } from "../app/auth-context";
import { listSalonOrders, updateOrderStatus, type OrderWithId } from "../firebase/order-repo";
import { formatEuro } from "../domain/money";

export function OrdersPage() {
  const { salonId } = useAuth();
  const [orders, setOrders] = useState<OrderWithId[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function reload(id: string) {
    setOrders(await listSalonOrders(id));
  }
  useEffect(() => {
    if (!salonId) return;
    void reload(salonId).catch(() => {
      setError("Non è stato possibile caricare gli ordini.");
    });
  }, [salonId]);

  async function setStatus(id: string, stato: "pronto" | "ritirato" | "annullato") {
    if (!salonId) return;
    setError(null);
    try {
      await updateOrderStatus(salonId, id, stato);
      await reload(salonId);
    } catch {
      setError("Operazione non riuscita. Aggiorna la pagina e riprova.");
    }
  }

  return (
    <section>
      <h2>Ordini</h2>
      {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
      {orders.length === 0 && <p style={{ color: "var(--muted)" }}>Nessun ordine.</p>}
      {orders.map((o) => (
        <div className="card" key={o.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              <strong>{o.clientNome ?? "Cliente"}</strong> · € {formatEuro(o.totale)} · <em>{o.stato}</em>
              <br />
              <span style={{ color: "var(--muted)" }}>
                {o.items.map((i) => `${i.titolo} ×${i.qta}`).join(", ")}
              </span>
            </span>
            <span className="row">
              {o.stato === "in_attesa" && (
                <button className="btn" onClick={() => setStatus(o.id, "pronto")}>Pronto</button>
              )}
              {o.stato === "pronto" && (
                <button className="btn" onClick={() => setStatus(o.id, "ritirato")}>Ritirato</button>
              )}
              {(o.stato === "in_attesa" || o.stato === "pronto") && (
                <button className="btn btn--danger" onClick={() => setStatus(o.id, "annullato")}>Annulla</button>
              )}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}
