import { NavLink, Outlet } from "react-router-dom";
import type { CSSProperties } from "react";
import { signOutUser } from "../firebase/auth";
import { useSalonTenant } from "./salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import { getSalonExperience } from "./salon-experience";

const CUSTOMER_SECTIONS = [
  { to: "/home", label: "Home", icon: "home" as const },
  { to: "/servizi", label: "Servizi", icon: "scissors" as const },
  { to: "/prenota", label: "Prenota", icon: "calendar" as const, primary: true },
  { to: "/catalogo", label: "Shop", icon: "bag" as const },
  { to: "/profilo", label: "Profilo", icon: "profile" as const },
];

export function CustomerLayout() {
  const { salon, loading, error } = useSalonTenant();

  if (loading) return <div className="customer-tenant-state">Prepariamo il salone…</div>;
  if (!salon) return <div className="customer-tenant-state">{error}</div>;
  const experience = getSalonExperience(salon.tipo, salon.branding);
  const brandStyle = salon.branding ? {
    "--panel": salon.branding.backgroundColor,
    "--panel-strong": salon.branding.backgroundColor,
    "--ink": salon.branding.foregroundColor,
    "--accent": salon.branding.accentColor,
    "--accent-hover": salon.branding.accentColor,
  } as CSSProperties : undefined;

  return (
    <div className={`customer-app customer-app--${experience.type}`} style={brandStyle}>
      <aside className="customer-nav">
        <div className="customer-nav__brand">
          {salon.branding?.logoUrl ? <img className="customer-brand-logo" src={salon.branding.logoUrl} alt={`Logo ${salon.nome}`} /> : <span className="brand-mark" aria-hidden="true">B</span>}
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
          <NavLink to="/profilo"><AppIcon name="profile" size={18} /> Il mio profilo</NavLink>
          <NavLink to="/assistenza"><AppIcon name="ticket" size={18} /> Assistenza</NavLink>
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
