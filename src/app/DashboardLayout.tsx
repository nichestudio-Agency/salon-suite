import "./dashboard.css";
import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";
import barberEditorial from "../assets/barber-editorial.webp";
import { AppIcon } from "../components/AppIcon";
import { useAuth } from "./auth-context";
import { useSalonTenant } from "./salon-tenant-context";

type DashboardSection = {
  to: string;
  label: string;
  icon: "home" | "calendar" | "scissors" | "users" | "clock" | "bag" | "orders" | "bell";
  end?: boolean;
};

const SECTIONS: DashboardSection[] = [
  { to: "/dashboard", label: "Dashboard", icon: "home" as const, end: true },
  { to: "/dashboard/prenotazioni", label: "Agenda", icon: "calendar" as const },
  { to: "/dashboard/clienti", label: "Clienti", icon: "users" as const },
  { to: "/dashboard/servizi", label: "Servizi", icon: "scissors" as const },
  { to: "/dashboard/operatori", label: "Team", icon: "users" as const },
  { to: "/dashboard/orari", label: "Orari", icon: "clock" as const },
  { to: "/dashboard/prodotti", label: "Prodotti", icon: "bag" as const },
  { to: "/dashboard/ordini", label: "Ordini", icon: "orders" as const },
  { to: "/dashboard/notifiche", label: "Notifiche", icon: "bell" as const },
];

export function DashboardLayout() {
  const { user } = useAuth();
  const { salon } = useSalonTenant();
  const today = new Date();
  const todayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(today);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(today);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const calendarDays = Array.from({ length: offset + monthDays }, (_, index) => index < offset ? null : index - offset + 1);

  return (
    <div className="dashboard">
      <nav aria-label="Sezioni dashboard" className="dashboard__sidebar">
        <div className="dashboard__brand">
          <span className="brand-mark" aria-hidden="true"><AppIcon name="scissors" size={22} /></span>
          <span><strong>{salon?.nome ?? "BARBERIA"}</strong><small>Workspace salone</small></span>
        </div>
        <section className="dashboard__mini-calendar" aria-label="Calendario del mese">
          <span>Oggi</span><strong>{todayLabel}</strong>
          <h2>{monthLabel}</h2>
          <div className="dashboard__calendar-labels"><span>L</span><span>M</span><span>M</span><span>G</span><span>V</span><span>S</span><span>D</span></div>
          <div className="dashboard__calendar-days">{calendarDays.map((day, index) => <span className={day === today.getDate() ? "is-today" : ""} key={`${day}-${index}`}>{day}</span>)}</div>
        </section>
        <span className="dashboard__nav-label">Gestione</span>
        <ul>
          {SECTIONS.map((s) => (
            <li key={s.to}>
              <NavLink to={s.to} end={s.end}>
                <AppIcon name={s.icon} size={20} />
                {s.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="dashboard__profile">
          <img src={barberEditorial} alt="" />
          <span><strong>{user?.displayName || "Titolare"}</strong><small>Proprietario</small></span>
        </div>
        <button type="button" onClick={() => signOutUser()}>Esci</button>
      </nav>
      <main className="dashboard__content">
        <header className="dashboard__topbar">
          <nav aria-label="Navigazione rapida">
            {SECTIONS.slice(0, 5).map((section) => <NavLink to={section.to} end={section.end} key={section.to}><AppIcon name={section.icon} size={19} />{section.label}</NavLink>)}
          </nav>
          <NavLink className="dashboard__topbar-alert" to="/dashboard/notifiche" aria-label="Notifiche"><AppIcon name="bell" size={20} /></NavLink>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
