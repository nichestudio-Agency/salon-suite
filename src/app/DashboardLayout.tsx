import "./dashboard.css";
import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";

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
        <strong>💈 Salone</strong>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.to}>
              <NavLink to={s.to}>{s.label}</NavLink>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => signOutUser()}>Esci</button>
      </nav>
      <main className="dashboard__content">
        <Outlet />
      </main>
    </div>
  );
}
