import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Gender } from "../domain/models";
import { registerClient } from "../firebase/auth";
import { AuthLayout } from "../app/AuthLayout";
import { useSalonTenant } from "../app/salon-tenant-context";
import "./customer.css";

export function RegisterClientPage() {
  const navigate = useNavigate();
  const { salon } = useSalonTenant();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sesso, setSesso] = useState<Gender>("altro");
  const [dataNascita, setDataNascita] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await registerClient({ email, password, nome, sesso, dataNascita, salonId: salon?.id });
      navigate("/home");
    } catch {
      setError("Registrazione non riuscita. Controlla i dati o prova un'altra email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form className="booking-panel auth-panel" onSubmit={onSubmit}>
        <span className="customer-shell__eyebrow">Area clienti</span>
        <h1>Crea il tuo account</h1>

        <div className="booking-field">
          <label htmlFor="client-name">Nome</label>
          <input
            id="client-name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div className="booking-field">
          <label htmlFor="client-email">Email</label>
          <input
            id="client-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div className="booking-field">
          <label htmlFor="client-password">Password</label>
          <input
            id="client-password"
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </div>
        <div className="booking-field">
          <label htmlFor="client-gender">Sesso</label>
          <select
            id="client-gender"
            value={sesso}
            onChange={(event) => setSesso(event.target.value as Gender)}
          >
            <option value="maschile">Maschile</option>
            <option value="femminile">Femminile</option>
            <option value="altro">Altro / preferisco non specificare</option>
          </select>
        </div>
        <div className="booking-field">
          <label htmlFor="client-birth-date">Data di nascita</label>
          <input
            id="client-birth-date"
            type="date"
            value={dataNascita}
            onChange={(event) => setDataNascita(event.target.value)}
            required
          />
        </div>

        {error && <p className="customer-error" role="alert">{error}</p>}
        <button className="customer-button" type="submit" disabled={loading}>
          {loading ? "Creazione account…" : "Registrati e prenota"}
        </button>
        <p>Hai già un account? <Link to="/accedi">Accedi</Link></p>
      </form>
    </AuthLayout>
  );
}
