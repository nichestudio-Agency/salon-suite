import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState, type CSSProperties } from "react";
import { signOutUser } from "../firebase/auth";
import { useSalonTenant } from "./salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import { getSalonExperience } from "./salon-experience";
import { listMyNotifications } from "../firebase/customer-notification-repo";
import { readDemoBrandPreview, readableAccentOnDark, readableAccentOnLight, readableOn, supportTone } from "./demo-brand-preview";

const CUSTOMER_SECTIONS = [
  { to: "/home", label: "Home", icon: "home" as const },
  { to: "/servizi", label: "Servizi", icon: "scissors" as const },
  { to: "/prenota", label: "Prenota", icon: "calendar" as const, primary: true },
  { to: "/catalogo", label: "Shop", icon: "bag" as const },
  { to: "/profilo", label: "Profilo", icon: "profile" as const },
];

export function CustomerLayout() {
  const { salon, loading, error } = useSalonTenant();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [embeddedScale, setEmbeddedScale] = useState(1);

  useEffect(() => {
    if (window.parent === window) return;
    const updateScale = () => setEmbeddedScale(Math.min(1, window.innerWidth / 393));
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    if (window.parent === window) return;
    window.parent.postMessage({ type: "salon-suite-demo-route", pathname: location.pathname }, window.location.origin);
  }, [location.pathname]);

  useEffect(() => {
    if (!salon?.id) return;
    let active = true;
    const refresh = () => void listMyNotifications(salon.id)
      .then((items) => { if (active) setUnread(items.filter((item) => !item.read).length); })
      .catch(() => { if (active) setUnread(0); });
    refresh();
    window.addEventListener("customer-notifications-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("customer-notifications-updated", refresh);
    };
  }, [salon?.id, location.pathname]);

  if (loading) return <div className="customer-tenant-state">Prepariamo il salone…</div>;
  if (!salon) return <div className="customer-tenant-state">{error}</div>;
  const previewBrand = readDemoBrandPreview();
  const displayName = previewBrand?.name || salon.nome;
  const displayLogo = previewBrand?.logo || salon.branding?.logoUrl;
  const displayAccent = previewBrand?.accent || salon.branding?.accentColor;
  const emphasisAccent = displayAccent ? readableAccentOnLight(displayAccent) : undefined;
  const experience = getSalonExperience(salon.tipo, salon.branding);
  const isEmbeddedDemo = window.parent !== window;
  const brandStyle = displayAccent ? {
    "--accent": displayAccent,
    "--accent-hover": displayAccent,
    "--accent-ink": readableOn(displayAccent),
    "--accent-readable": readableAccentOnLight(displayAccent),
    "--accent-on-dark": readableAccentOnDark(displayAccent),
    "--accent-emphasis": emphasisAccent,
    "--accent-emphasis-ink": emphasisAccent ? readableOn(emphasisAccent) : undefined,
    ...(previewBrand ? {
      "--panel": supportTone(previewBrand.support, .12),
      "--surface": supportTone(previewBrand.support, .22),
      "--border": supportTone(previewBrand.support, .38),
      "--border-strong": supportTone(previewBrand.support, .54),
    } : {}),
  } as CSSProperties : undefined;
  const appStyle = {
    ...brandStyle,
    ...(isEmbeddedDemo && embeddedScale < 1 ? { width: 393, zoom: embeddedScale } : {}),
  } as CSSProperties;

  return (
    <div className={`customer-app customer-app--${experience.type}${isEmbeddedDemo ? " customer-app--embedded-demo" : ""}`} style={appStyle}>
      <aside className="customer-nav">
        <div className="customer-nav__brand">
          {displayLogo ? <img className="customer-brand-logo" src={displayLogo} alt={`Logo ${displayName}`} /> : <span className="brand-mark" aria-hidden="true">B</span>}
          <span><strong>{displayName}</strong><small>Il tuo salone</small></span>
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
        <header className="customer-appbar">
          <NavLink className="customer-appbar__brand" to="/home" aria-label={`Home ${displayName}`}>
            {displayLogo ? <img src={displayLogo} alt={`Logo ${displayName}`} /> : <span aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>}
            <div><small>Il tuo salone</small><strong>{displayName}</strong></div>
          </NavLink>
          <div className="customer-appbar__actions">
            <NavLink className="customer-appbar__action" to="/aggiornamenti" aria-label={unread ? `${unread} aggiornamenti non letti` : "Apri gli aggiornamenti"}>
              <AppIcon name="bell" size={20} />{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
            </NavLink>
            <NavLink className="customer-appbar__action" to="/profilo" aria-label="Apri il profilo"><AppIcon name="profile" size={20} /></NavLink>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
