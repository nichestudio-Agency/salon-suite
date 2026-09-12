import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../app/cart-context";
import { createOrder } from "../firebase/order";
import { formatEuro } from "../domain/money";
import "./customer.css";

export function CartPage() {
  const navigate = useNavigate();
  const { salonId, items, totale, setQta, remove, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");

  async function onCheckout() {
    if (!salonId || items.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createOrder({
        salonId,
        items: items.map((l) => ({ productId: l.product.id, qta: l.qta })),
        ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
      });
      clear();
      navigate("/i-miei-ordini");
    } catch {
      setError("Invio dell'ordine non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="customer-page customer-page--narrow">
      <div className="customer-shell__header">
        <div><span className="customer-shell__eyebrow">Carrello</span><h1>Il tuo ordine</h1></div>
        <Link className="cart-back" to="/catalogo">Torna allo shop</Link>
      </div>
      {items.length === 0 && <p className="customer-booking__meta">Il carrello è vuoto.</p>}
      {items.map((l) => (
        <div className="customer-booking" key={l.product.id}>
          <span><strong>{l.product.titolo}</strong> · € {formatEuro(l.product.prezzo)}</span>
          <span className="row">
            <input
              aria-label={`Quantità ${l.product.titolo}`}
              type="number" min="1" value={l.qta}
              onChange={(e) => setQta(l.product.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
              style={{ width: 64 }}
            />
            <button className="customer-button customer-button--secondary" onClick={() => remove(l.product.id)}>Rimuovi</button>
          </span>
        </div>
      ))}
      {items.length > 0 && (
        <>
          <p style={{ marginTop: 16 }}><strong>Totale: € {formatEuro(totale)}</strong></p>
          <label className="customer-coupon-field"><span>Hai un codice coupon?</span><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Inserisci il codice" /></label>
          {error && <p className="customer-error" role="alert">{error}</p>}
          <button className="customer-button" onClick={onCheckout} disabled={busy}>
            {busy ? "Invio…" : "Invia ordine (paghi in salone)"}
          </button>
        </>
      )}
    </section>
  );
}
