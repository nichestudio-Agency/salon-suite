import "./dashboard.css";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOutUser } from "../firebase/auth";
import { AppIcon } from "../components/AppIcon";
import { useAuth } from "./auth-context";
import { useSalonTenant } from "./salon-tenant-context";
import { runBirthdayGreetings } from "../firebase/birthday";
import { DashboardCommandBar } from "../components/DashboardCommandBar";
import type { SubscriptionFeatureKey } from "../domain/models";
import { useSubscriptionAccess } from "./subscription-access";
import { mixWithWhite, readDemoBrandPreview, readableAccentOnLight, readableOn } from "./demo-brand-preview";

type DashboardSection = {
  to: string;
  label: string;
  icon: "home" | "calendar" | "scissors" | "users" | "clock" | "bag" | "orders" | "gift" | "card" | "ticket" | "key" | "chart" | "help";
  end?: boolean;
  feature?: SubscriptionFeatureKey;
};

const SECTIONS: DashboardSection[] = [
  { to: "/dashboard", label: "Dashboard", icon: "home" as const, end: true },
  { to: "/dashboard/prenotazioni", label: "Agenda", icon: "calendar" as const, feature: "agenda" },
  { to: "/dashboard/statistiche", label: "Statistiche", icon: "chart" as const, feature: "statistiche" },
  { to: "/dashboard/clienti", label: "Clienti", icon: "users" as const, feature: "clienti" },
  { to: "/dashboard/servizi", label: "Servizi", icon: "scissors" as const, feature: "servizi_team" },
  { to: "/dashboard/operatori", label: "Team", icon: "users" as const, feature: "servizi_team" },
  { to: "/dashboard/orari", label: "Orari", icon: "clock" as const, feature: "servizi_team" },
  { to: "/dashboard/prodotti", label: "Prodotti", icon: "bag" as const, feature: "prodotti_ordini" },
  { to: "/dashboard/ordini", label: "Ordini", icon: "orders" as const, feature: "prodotti_ordini" },
  { to: "/dashboard/notifiche", label: "Marketing", icon: "gift" as const, feature: "marketing" },
  { to: "/dashboard/fidelity", label: "Fidelity", icon: "card" as const, feature: "fidelity" },
  { to: "/dashboard/integrazioni", label: "Cassa e integrazioni", icon: "key" as const, feature: "integrazioni" },
  { to: "/dashboard/importa", label: "Importa dati", icon: "orders" as const, feature: "importazione" },
  { to: "/dashboard/assistenza", label: "Assistenza", icon: "ticket" as const },
  { to: "/dashboard/tutorial", label: "Tutorial", icon: "help" as const },
];

export function DashboardLayout() {
  const { user } = useAuth();
  const { salon } = useSalonTenant();
  const location = useLocation();
  const { config: subscriptionConfig, has: hasFeature } = useSubscriptionAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  const contentRef = useRef<HTMLElement>(null);
  const today = new Date();
  const todayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(today);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(today);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: offset + monthDays }, (_, index) => index < offset ? null : index - offset + 1);
  const visibleSections = SECTIONS;
  const mobileSections = ["/dashboard", "/dashboard/prenotazioni", "/dashboard/clienti", "/dashboard/notifiche"]
    .map((path) => visibleSections.find((section) => section.to === path))
    .filter((section): section is DashboardSection => Boolean(section));
  const secondarySectionActive = !mobileSections.some((section) => section.to === location.pathname);
  const previewBrand = readDemoBrandPreview();
  const displayName = previewBrand?.name || salon?.nome || "BARBERIA";
  const displayLogo = previewBrand?.logo || salon?.branding?.logoUrl;
  const ownerInitial = (user?.displayName || displayName || "S").slice(0, 1).toUpperCase();
  const previewStyle = previewBrand ? {
    "--accent": previewBrand.accent,
    "--accent-hover": previewBrand.accent,
    "--accent-ink": readableOn(previewBrand.accent),
    "--accent-readable": readableAccentOnLight(previewBrand.accent),
    "--accent-soft": mixWithWhite(previewBrand.accent, .13),
    "--panel": mixWithWhite(previewBrand.support, .13),
    "--surface": mixWithWhite(previewBrand.support, .2),
    "--border": mixWithWhite(previewBrand.support, .32),
  } as CSSProperties : undefined;
  useEffect(() => { if (!salon?.id || !salon.compleanno?.attivo) return; const key = `birthday-run-${salon.id}-${new Date().toLocaleDateString("sv-SE")}`; if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); void runBirthdayGreetings(salon.id).catch(() => sessionStorage.removeItem(key)); }, [salon]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); contentRef.current?.scrollTo({ top: 0, behavior: "auto" }); }, [location.pathname]);

  return (
    <div className="dashboard dashboard--neutral" style={previewStyle}>
      <nav aria-label="Sezioni dashboard" className={`dashboard__sidebar${menuOpen ? " is-open" : ""}`}>
        <div className="dashboard__brand">
          {displayLogo ? <img className="dashboard-brand-logo" src={displayLogo} alt={`Logo ${displayName}`} /> : <span className="brand-mark" aria-hidden="true"><AppIcon name="scissors" size={22} /></span>}
          <span><strong>{displayName}</strong><small>Workspace salone</small></span>
        </div>
        <button className="dashboard__close" type="button" aria-label="Chiudi menu" onClick={() => setMenuOpen(false)}><AppIcon name="close" /></button>
        <section className="dashboard__mini-calendar" aria-label="Calendario del mese">
          <span>Oggi</span><strong>{todayLabel}</strong>
          <h2>{monthLabel}</h2>
          <div className="dashboard__calendar-labels"><span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span></div>
          <div className="dashboard__calendar-days">{calendarDays.map((day, index) => <span className={day === today.getDate() ? "is-today" : ""} key={`${day}-${index}`}>{day}</span>)}</div>
        </section>
        <span className="dashboard__nav-label">Gestione</span>
        <ul>
          {visibleSections.map((s) => (
            <li key={s.to}>
              <NavLink to={s.to} end={s.end} className={({ isActive }) => `${isActive ? "active" : ""}${s.feature && !hasFeature(s.feature) ? " is-locked" : ""}`.trim()} onClick={() => setMenuOpen(false)}>
                <AppIcon name={s.icon} size={20} />
                {s.label}
                {s.feature && !hasFeature(s.feature) && <span className="dashboard-nav-lock" aria-label="Funzionalità premium"><AppIcon name="lock" size={12} /></span>}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="dashboard__profile">
          {displayLogo ? <img src={displayLogo} alt="" /> : <span className="dashboard__profile-initial">{ownerInitial}</span>}
          <span><strong>{user?.displayName || "Titolare"}</strong><small>{salon?.licenza ? `Piano ${subscriptionConfig.piani[salon.licenza.piano]?.nome ?? salon.licenza.piano}` : "Proprietario"}</small></span>
        </div>
        <button className="dashboard__logout" type="button" onClick={() => signOutUser()}>Esci dall’account</button>
      </nav>
      {menuOpen && <button className="dashboard__overlay" type="button" aria-label="Chiudi menu" onClick={() => setMenuOpen(false)} />}
      <nav className="dashboard__mobile-nav" aria-label="Navigazione principale">
        {mobileSections.map((section) => <NavLink className={({ isActive }) => `${isActive ? "active" : ""}${section.feature && !hasFeature(section.feature) ? " is-locked" : ""}`.trim()} to={section.to} end={section.end} key={section.to}><AppIcon name={section.icon} size={20} />{section.label}{section.feature && !hasFeature(section.feature) && <span className="dashboard-nav-lock"><AppIcon name="lock" size={10} /></span>}</NavLink>)}
        <button className={secondarySectionActive ? "is-active" : undefined} type="button" aria-label="Apri tutte le sezioni" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><AppIcon name="menu" size={20} />Altro</button>
      </nav>
      <div className="dashboard__main">
        <DashboardCommandBar />
        <main className="dashboard__content" ref={contentRef}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
