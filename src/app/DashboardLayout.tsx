import "./dashboard.css";
import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";
import barberEditorial from "../assets/barber-editorial.webp";
import { AppIcon } from "../components/AppIcon";

const SECTIONS = [
  { to: "/dashboard/prenotazioni", label: "Agenda", icon: "calendar" as const },
  { to: "/dashboard/servizi", label: "Servizi", icon: "scissors" as const },
  { to: "/dashboard/operatori", label: "Team", icon: "users" as const },
  { to: "/dashboard/orari", label: "Orari", icon: "clock" as const },
  { to: "/dashboard/prodotti", label: "Prodotti", icon: "bag" as const },
  { to: "/dashboard/ordini", label: "Ordini", icon: "orders" as const },
  { to: "/dashboard/notifiche", label: "Notifiche", icon: "bell" as const },
];

export function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav aria-label="Sezioni dashboard" className="dashboard__sidebar">
        <div className="dashboard__brand">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span><strong>BARBERIA</strong><small>Workspace Pro</small></span>
        </div>
        <span className="dashboard__nav-label">Workspace</span>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.to}>
              <NavLink to={s.to}>
                <AppIcon name={s.icon} size={20} />
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="dashboard__sidebar-photo" aria-hidden="true">
          <img src={barberEditorial} alt="" />
          <span>Craft, cura, carattere.</span>
        </div>
        <button type="button" onClick={() => signOutUser()}>Esci</button>
      </nav>
      <main className="dashboard__content">
        <Outlet />
      </main>
    </div>
  );
}
