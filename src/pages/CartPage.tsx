import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../app/cart-context";
import { createOrder } from "../firebase/order";
import { formatEuro } from "../domain/money";
import { AppIcon } from "../components/AppIcon";
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
      {items.length === 0 && <div className="customer-empty customer-empty--stacked"><AppIcon name="cart" /><strong>Il carrello è vuoto</strong><p>Scegli i prodotti consigliati dal salone.</p><Link className="customer-button" to="/catalogo">Vai allo shop</Link></div>}
      <div className="customer-cart-list">{items.map((l) => (
        <article className="customer-cart-item" key={l.product.id}>
          {l.product.fotoUrl ? <img src={l.product.fotoUrl} alt={`Prodotto ${l.product.titolo}`} /> : <div className="product-card__ph" aria-hidden="true">{l.product.titolo.slice(0, 1).toUpperCase()}</div>}
          <div><strong>{l.product.titolo}</strong><span>€ {formatEuro(l.product.prezzo)} cad.</span><button type="button" onClick={() => remove(l.product.id)}>Rimuovi</button></div>
          <div className="customer-quantity" aria-label={`Quantità ${l.product.titolo}`}><button type="button" aria-label="Diminuisci quantità" onClick={() => l.qta === 1 ? remove(l.product.id) : setQta(l.product.id, l.qta - 1)}>−</button><output>{l.qta}</output><button type="button" aria-label="Aumenta quantità" onClick={() => setQta(l.product.id, l.qta + 1)}>+</button></div>
        </article>
      ))}</div>
      {items.length > 0 && (
        <section className="customer-checkout">
          <header><span>Riepilogo</span><strong>€ {formatEuro(totale)}</strong></header>
          <p>Il pagamento avverrà in salone al momento del ritiro.</p>
          <label className="customer-coupon-field"><span>Hai un codice coupon?</span><input value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="Inserisci il codice" /></label>
          {error && <p className="customer-error" role="alert">{error}</p>}
          <button className="customer-button" onClick={onCheckout} disabled={busy}>
            {busy ? "Invio…" : "Invia ordine (paghi in salone)"}
          </button>
        </section>
      )}
    </section>
  );
}
