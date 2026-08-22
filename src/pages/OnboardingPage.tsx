import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { registerOwner } from "../firebase/onboarding";
import type { WeeklyHours } from "../domain/availability";

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
    <form onSubmit={onSubmit}>
      <h1>Crea il tuo salone</h1>
      <input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      <input aria-label="Nome del salone" value={nomeSalone} onChange={(e) => setNomeSalone(e.target.value)} required />
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={busy}>Crea il salone</button>
      <p>Hai già un salone? <Link to="/accedi">Accedi</Link></p>
    </form>
  );
}
