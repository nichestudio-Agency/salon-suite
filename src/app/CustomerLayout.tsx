import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";
import { useCart } from "./cart-context";
import { useSalonTenant } from "./salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import { getSalonExperience } from "./salon-experience";

const CUSTOMER_SECTIONS = [
  { to: "/home", label: "Home", icon: "home" as const },
  { to: "/servizi", label: "Servizi", icon: "scissors" as const },
  { to: "/prenota", label: "Prenota", icon: "calendar" as const, primary: true },
  { to: "/operatori", label: "Barber", icon: "users" as const },
  { to: "/catalogo", label: "Prodotti", icon: "bag" as const },
];

export function CustomerLayout() {
  const cart = useCart();
  const { salon, loading, error } = useSalonTenant();

  if (loading) return <div className="customer-tenant-state">Prepariamo il salone…</div>;
  if (!salon) return <div className="customer-tenant-state">{error}</div>;
  const experience = getSalonExperience(salon.tipo);

  return (
    <div className={`customer-app customer-app--${experience.type}`}>
      <aside className="customer-nav">
        <div className="customer-nav__brand">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span><strong>{salon.nome}</strong><small>Il tuo salone</small></span>
        </div>
        <nav aria-label="Area cliente">
          {CUSTOMER_SECTIONS.map((section) => (
            <NavLink key={section.to} to={section.to} className={section.primary ? "customer-nav__primary" : undefined}>
              <span className="customer-nav__icon"><AppIcon name={section.icon} /></span>
              <span>{section.to === "/operatori" ? experience.professional : section.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="customer-nav__account">
          <NavLink to="/i-miei-ordini"><AppIcon name="orders" size={18} /> I miei ordini</NavLink>
          <NavLink to="/carrello"><AppIcon name="cart" size={18} /> Carrello <span>{cart.items.length}</span></NavLink>
          <button type="button" onClick={() => signOutUser()}>Esci</button>
        </div>
        <div className="customer-nav__visual" aria-hidden="true">
          <img src={experience.images.editorial} alt="" />
          <p>Il tuo stile,<br />senza attese.</p>
        </div>
      </aside>
      <main className="customer-app__content" id="contenuto">
        <Outlet />
      </main>
    </div>
  );
}
