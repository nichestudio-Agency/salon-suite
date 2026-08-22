import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "../firebase/auth";

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
      navigate("/dashboard/servizi");
    } catch {
      setError("Email o password non validi.");
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <h1>Accedi</h1>
      <input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Accedi</button>
      <p>Nuovo salone? <Link to="/registrati-salone">Registrati</Link></p>
    </form>
  );
}
