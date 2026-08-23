import "./dashboard.css";
import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";
import barberEditorial from "../assets/barber-editorial.webp";

const SECTIONS = [
  { to: "/dashboard/prenotazioni", label: "Prenotazioni" },
  { to: "/dashboard/servizi", label: "Servizi" },
  { to: "/dashboard/operatori", label: "Operatori" },
  { to: "/dashboard/orari", label: "Orari" },
  { to: "/dashboard/prodotti", label: "Prodotti" },
  { to: "/dashboard/ordini", label: "Ordini" },
  { to: "/dashboard/notifiche", label: "Notifiche" },
];

export function DashboardLayout() {
  return (
    <div className="dashboard">
      <nav aria-label="Sezioni dashboard" className="dashboard__sidebar">
        <div className="dashboard__brand">
          <span className="brand-mark" aria-hidden="true">B</span>
          <strong>BARBERIA</strong>
        </div>
        <span className="dashboard__nav-label">Workspace</span>
        <ul>
          {SECTIONS.map((s, index) => (
            <li key={s.to}>
              <NavLink to={s.to}>
                <span>{String(index + 1).padStart(2, "0")}</span>
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
