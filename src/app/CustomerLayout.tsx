import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";
import { useCart } from "./cart-context";
import barberEditorial from "../assets/barber-editorial.webp";
import { useSalonTenant } from "./salon-tenant-context";

const CUSTOMER_SECTIONS = [
  { to: "/prenota", label: "Prenota", short: "Prenota" },
  { to: "/servizi", label: "Servizi", short: "Servizi" },
  { to: "/operatori", label: "Operatori", short: "Barber" },
  { to: "/catalogo", label: "Prodotti", short: "Prodotti" },
];

export function CustomerLayout() {
  const cart = useCart();
  const { salon, loading, error } = useSalonTenant();

  if (loading) return <div className="customer-tenant-state">Prepariamo il salone…</div>;
  if (!salon) return <div className="customer-tenant-state">{error}</div>;

  return (
    <div className="customer-app">
      <aside className="customer-nav">
        <div className="customer-nav__brand">
          <span className="brand-mark" aria-hidden="true">B</span>
          <strong>{salon.nome}</strong>
        </div>
        <nav aria-label="Area cliente">
          {CUSTOMER_SECTIONS.map((section, index) => (
            <NavLink key={section.to} to={section.to}>
              <span className="customer-nav__index">0{index + 1}</span>
              <span className="customer-nav__label">{section.label}</span>
              <span className="customer-nav__short">{section.short}</span>
            </NavLink>
          ))}
        </nav>
        <div className="customer-nav__account">
          <NavLink to="/i-miei-ordini">I miei ordini</NavLink>
          <NavLink to="/carrello">Carrello <span>{cart.items.length}</span></NavLink>
        </div>
        <div className="customer-nav__visual" aria-hidden="true">
          <img src={barberEditorial} alt="" />
          <p>Il tuo stile,<br />senza attese.</p>
        </div>
        <button type="button" onClick={() => signOutUser()}>Esci</button>
      </aside>
      <main className="customer-app__content" id="contenuto">
        <Outlet />
      </main>
    </div>
  );
}
