import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listProducts, type ProductWithId } from "../firebase/product-repo";
import { formatEuro } from "../domain/money";
import { useCart } from "../app/cart-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import "./customer.css";

export function CatalogPage() {
  const cart = useCart();
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salonId) return;
    setLoading(true);
    setError(null);
    void listProducts(salonId).then((list) =>
      setProducts(list.filter((p) => p.attivo))
    ).catch(() => setError("Non siamo riusciti a caricare il catalogo.")).finally(() => setLoading(false));
  }, [salonId]);

  return (
    <section className="customer-page">
      <div className="customer-shell__header">
        <div>
          <span className="customer-shell__eyebrow">Prodotti</span>
          <h1>Acquista in salone</h1>
        </div>
        <Link className="catalog-cart" to="/carrello" aria-label={`Apri il carrello, ${cart.items.length} articoli`}>
          <AppIcon name="cart" size={22} />
          {cart.items.length > 0 && <span>{cart.items.length}</span>}
        </Link>
      </div>

      <p className="customer-page__intro">Una selezione curata dal salone. Ordina dall’app e paga comodamente al ritiro.</p>
      {error && <p className="customer-error" role="alert">{error}</p>}
      {loading && <div className="customer-list-skeleton" aria-label="Caricamento prodotti"><span /><span /><span /></div>}
      <div className="customer-product-grid">
        {!loading && products.map((p) => (
          <article className="customer-product-card" key={p.id}>
            {p.fotoUrl ? (
              <img src={p.fotoUrl} alt={`Prodotto ${p.titolo}`} />
            ) : (
              <div className="product-card__ph" aria-hidden="true">{p.titolo.slice(0, 1).toUpperCase()}</div>
            )}
            <div className="customer-product-card__body"><span>Prodotto</span><h2>{p.titolo}</h2><p>{p.descrizione || "Selezionato dal salone per la cura quotidiana."}</p></div>
            <footer><strong>€ {formatEuro(p.prezzo)}</strong>
            <button
              className="customer-button"
              aria-label={`Aggiungi al carrello: ${p.titolo}`}
              onClick={() => cart.add(salonId, p)}
            >
              Aggiungi
            </button>
            </footer>
          </article>
        ))}
        {!loading && products.length === 0 && <div className="customer-empty customer-empty--stacked"><AppIcon name="bag" /><strong>Catalogo in aggiornamento</strong><p>I prodotti del salone saranno presto disponibili.</p></div>}
      </div>
    </section>
  );
}
