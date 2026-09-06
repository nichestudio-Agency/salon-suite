import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerOwner } from "../firebase/onboarding";
import type { WeeklyHours } from "../domain/availability";
import type { SalonType } from "../domain/models";
import { AuthLayout } from "../app/AuthLayout";
import "./customer.css";

/** Orari di default: Lun–Sab 9:00–19:00 (rifiniti poi nella sezione Orari). */
const DEFAULT_HOURS: WeeklyHours = {
  lun: [{ start: 540, end: 1140 }],
  mar: [{ start: 540, end: 1140 }],
  mer: [{ start: 540, end: 1140 }],
  gio: [{ start: 540, end: 1140 }],
  ven: [{ start: 540, end: 1140 }],
  sab: [{ start: 540, end: 1140 }],
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nomeSalone, setNomeSalone] = useState("");
  const [tipo, setTipo] = useState<SalonType>("barberia");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await registerOwner({
        email,
        password,
        nomeSalone,
        tipo,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Rome",
        orariApertura: DEFAULT_HOURS,
      });
      navigate("/dashboard/servizi");
    } catch {
      setError("Registrazione non riuscita. Controlla i dati e riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout variant="owner">
      <form className="booking-panel auth-panel" onSubmit={onSubmit}>
        <span className="customer-shell__eyebrow">Registra il salone</span>
        <h1>Crea il tuo salone</h1>

        <div className="booking-field">
          <label htmlFor="ob-email">Email</label>
          <input
            id="ob-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="booking-field">
          <label htmlFor="ob-password">Password</label>
          <input
            id="ob-password"
            type="password"
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="booking-field">
          <label htmlFor="ob-nome">Nome del salone</label>
          <input
            id="ob-nome"
            value={nomeSalone}
            onChange={(e) => setNomeSalone(e.target.value)}
            required
          />
        </div>

        <div className="booking-field">
          <label htmlFor="ob-tipo">Tipo di attività</label>
          <select id="ob-tipo" value={tipo} onChange={(event) => setTipo(event.target.value as SalonType)}>
            <option value="barberia">Barberia</option>
            <option value="parrucchieria">Parrucchieria</option>
          </select>
        </div>

        {error && <p className="customer-error" role="alert">{error}</p>}
        <button className="customer-button" type="submit" disabled={busy}>
          {busy ? "Creazione in corso…" : "Crea il salone"}
        </button>

        <p className="auth-alt">Hai già un salone? <Link to="/accedi">Accedi</Link></p>
      </form>
    </AuthLayout>
  );
}
