import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "../firebase/auth";
import { AuthLayout } from "../app/AuthLayout";
import "./customer.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signIn(email, password);
      navigate("/area");
    } catch {
      setError("Email o password non validi.");
    }
  }

  return (
    <AuthLayout>
      <form className="booking-panel auth-panel" onSubmit={onSubmit}>
        <span className="customer-shell__eyebrow">Barber Shop</span>
        <h1>Accedi</h1>

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

        <p className="auth-alt">Sei un cliente? <Link to="/registrati">Registrati</Link></p>
        <p className="auth-alt">Nuovo salone? <Link to="/registrati-salone">Registra il salone</Link></p>
      </form>
    </AuthLayout>
  );
}
