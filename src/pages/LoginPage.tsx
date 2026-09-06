import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn, signOutUser } from "../firebase/auth";
import { AuthLayout } from "../app/AuthLayout";
import { AppIcon } from "../components/AppIcon";
import "./customer.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  function goToAccount(ruolo?: string, salonId?: string): boolean {
    if (ruolo === "superadmin") { navigate("/admin"); return true; }
    if (ruolo === "owner" && salonId) { navigate("/dashboard"); return true; }
    if (ruolo === "cliente") { navigate("/home"); return true; }
    return false;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const session = await signIn(email, password);
      if (!goToAccount(session.ruolo, session.salonId)) {
        await signOutUser();
        setError("Il profilo dell'account non è configurato. Ripristina i dati demo e riprova.");
      }
    } catch {
      setError("Email o password non validi.");
    }
  }

  async function demoLogin(email: string, password: string) {
    setError(null);
    try {
      const session = await signIn(email, password);
      if (!goToAccount(session.ruolo, session.salonId)) {
        await signOutUser();
        setError("Il profilo demo non è configurato. Esegui nuovamente il seed degli emulatori.");
      }
    } catch {
      setError("Accesso demo non riuscito. Verifica che gli emulatori siano avviati.");
    }
  }

  return (
    <AuthLayout>
      <form className="booking-panel auth-panel" onSubmit={onSubmit}>
        <span className="customer-shell__eyebrow">Area riservata</span>
        <h1>Bentornato.</h1>
        <p className="auth-panel__intro">Accedi per prenotare, gestire il salone o controllare la piattaforma.</p>

        <div className="booking-field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="booking-field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="customer-error" role="alert">{error}</p>}
        <button className="customer-button" type="submit">Accedi</button>

        {import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === "true" && (
          <div className="demo-access" aria-label="Accesso rapido demo">
            <div className="demo-access__heading"><span>Demo commerciale</span><small>Esplora il prodotto da ogni punto di vista</small></div>
            <button aria-label="Super Admin" type="button" onClick={() => void demoLogin("admin@barberia.local", "AdminBarber26!")}><span><AppIcon name="chart" size={19} /></span><span><strong>Super Admin</strong><small>Licenze e saloni</small></span><AppIcon name="arrow" size={17} /></button>
            <button aria-label="Titolare barberia" type="button" onClick={() => void demoLogin("titolare.test@barberia.local", "OwnerBarber26!")}><span><AppIcon name="building" size={19} /></span><span><strong>Titolare · Barberia</strong><small>Agenda e gestione</small></span><AppIcon name="arrow" size={17} /></button>
            <button aria-label="Cliente barberia" type="button" onClick={() => void demoLogin("cliente.test@barberia.local", "TestBarber26!")}><span><AppIcon name="scissors" size={19} /></span><span><strong>App · Barberia</strong><small>Prenotazioni e shop</small></span><AppIcon name="arrow" size={17} /></button>
            <button aria-label="Titolare parrucchieria" type="button" onClick={() => void demoLogin("titolare.hair@barberia.local", "HairStudio26!")}><span><AppIcon name="building" size={19} /></span><span><strong>Titolare · Parrucchieria</strong><small>Agenda e gestione</small></span><AppIcon name="arrow" size={17} /></button>
            <button aria-label="Cliente parrucchieria" type="button" onClick={() => void demoLogin("cliente.hair@barberia.local", "HairStudio26!")}><span><AppIcon name="spark" size={19} /></span><span><strong>App · Parrucchieria</strong><small>Taglio, colore e shop</small></span><AppIcon name="arrow" size={17} /></button>
          </div>
        )}

        <p className="auth-alt">Sei un cliente? <Link to="/registrati">Registrati</Link></p>
        <p className="auth-alt">Nuovo salone? <Link to="/registrati-salone">Registra il salone</Link></p>
      </form>
    </AuthLayout>
  );
}
