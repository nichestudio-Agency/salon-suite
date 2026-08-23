import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSalons, type SalonWithId } from "../firebase/salon-repo";
import { listProducts, type ProductWithId } from "../firebase/product-repo";
import { formatEuro } from "../domain/money";
import "./customer.css";

export function CatalogPage() {
  const [salons, setSalons] = useState<SalonWithId[]>([]);
  const [salonId, setSalonId] = useState<string>("");
  const [products, setProducts] = useState<ProductWithId[]>([]);

  useEffect(() => {
    void listSalons().then((s) => {
      setSalons(s);
      if (s.length > 0) setSalonId((cur) => cur || s[0].id);
    });
  }, []);

  useEffect(() => {
    if (!salonId) return;
    void listProducts(salonId).then((list) =>
      setProducts(list.filter((p) => p.attivo))
    );
  }, [salonId]);

  return (
    <main className="customer-shell">
      <div className="customer-shell__header">
        <div>
          <span className="customer-shell__eyebrow">Prodotti</span>
          <h1>Acquista in salone</h1>
        </div>
        <Link className="customer-button customer-button--secondary" to="/prenota">Prenota</Link>
      </div>

      <div className="booking-field">
        <label htmlFor="cat-salon">Salone</label>
        <select id="cat-salon" value={salonId} onChange={(e) => setSalonId(e.target.value)}>
          {salons.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </div>

      <div className="booking-slots" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
        {products.map((p) => (
          <div className="booking-panel" key={p.id}>
            {p.fotoUrl && (
              <img src={p.fotoUrl} alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10, marginBottom: 8 }} />
            )}
            <strong>{p.titolo}</strong>
            <p className="customer-booking__meta">{p.descrizione}</p>
            <p><strong>€ {formatEuro(p.prezzo)}</strong></p>
          </div>
        ))}
        {products.length === 0 && <p className="customer-booking__meta">Nessun prodotto disponibile.</p>}
      </div>
    </main>
  );
}
