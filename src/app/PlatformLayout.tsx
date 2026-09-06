import { NavLink, Outlet } from "react-router-dom";
import { signOutUser } from "../firebase/auth";
import { AppIcon } from "../components/AppIcon";
import { useAuth } from "./auth-context";
import "./platform.css";

export function PlatformLayout() {
  const { user } = useAuth();
  return (
    <div className="platform-shell">
      <header className="platform-header">
        <NavLink className="platform-brand" to="/admin"><span>SS</span><div><strong>Salon Suite</strong><small>Platform control</small></div></NavLink>
        <nav aria-label="Navigazione piattaforma">
          <NavLink to="/admin" end><AppIcon name="chart" size={18} />Panoramica</NavLink>
          <a href="#saloni"><AppIcon name="building" size={18} />Attività</a>
          <a href="#licenze"><AppIcon name="key" size={18} />Licenze</a>
          <button className="platform-mobile-exit" type="button" onClick={() => signOutUser()}><AppIcon name="arrow" size={18} />Esci</button>
        </nav>
        <div className="platform-profile"><span><strong>{user?.displayName || "Amministratore"}</strong><small>Super Admin</small></span><button type="button" onClick={() => signOutUser()}>Esci</button></div>
      </header>
      <main className="platform-main"><Outlet /></main>
    </div>
  );
}
