import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProducts, type ProductWithId } from "../firebase/product-repo";
import { formatEuro } from "../domain/money";
import { useCart } from "../app/cart-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import "./customer.css";

export function CatalogPage() {
  const cart = useCart();
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const [products, setProducts] = useState<ProductWithId[]>([]);

  useEffect(() => {
    if (!salonId) return;
    void listProducts(salonId).then((list) =>
      setProducts(list.filter((p) => p.attivo))
    );
  }, [salonId]);

  return (
    <section className="customer-page">
      <div className="customer-shell__header">
        <div>
          <span className="customer-shell__eyebrow">Prodotti</span>
          <h1>Acquista in salone</h1>
        </div>
        <Link className="customer-button" to="/carrello">Carrello ({cart.items.length})</Link>
      </div>

      <div className="booking-slots" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))" }}>
        {products.map((p) => (
          <div className="booking-panel" key={p.id}>
            {p.fotoUrl ? (
              <img src={p.fotoUrl} alt="" />
            ) : (
              <div className="product-card__ph" aria-hidden="true">{p.titolo.slice(0, 1).toUpperCase()}</div>
            )}
            <strong>{p.titolo}</strong>
            <p className="customer-booking__meta">{p.descrizione}</p>
            <p><strong>€ {formatEuro(p.prezzo)}</strong></p>
            <button
              className="customer-button"
              onClick={() => cart.add(salonId, p)}
            >
              Aggiungi al carrello
            </button>
          </div>
        ))}
        {products.length === 0 && <p className="customer-booking__meta">Nessun prodotto disponibile.</p>}
      </div>
    </section>
  );
}
