import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { signIn } from "../firebase/auth";
import { clearDemoBrandPreview, demoBrandFromSearch, storeDemoBrandPreview } from "../app/demo-brand-preview";
import "./demo-experience.css";

const DEMO_ACCOUNTS = {
  atelier: { owner: ["titolare.hair@barberia.local", "HairStudio26!"], client: ["cliente.hair@barberia.local", "HairStudio26!"] },
  barber: { owner: ["titolare.test@barberia.local", "OwnerBarber26!"], client: ["cliente.test@barberia.local", "TestBarber26!"] },
} as const;

export function DemoAccessPage() {
  const { variant: rawVariant, role: rawRole } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const variant = rawVariant === "barber" ? "barber" : "atelier";
  const role = rawRole === "client" ? "client" : "owner";
  const requestedClientRoute = searchParams.get("next");
  const clientRoute = ["/home", "/prenota", "/fidelity"].includes(requestedClientRoute ?? "")
    ? requestedClientRoute!
    : "/home";
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const brandPreview = demoBrandFromSearch(searchParams);
    if (brandPreview) storeDemoBrandPreview(brandPreview);
    else clearDemoBrandPreview();
    const [email, password] = DEMO_ACCOUNTS[variant][role];
    void signIn(email, password).then((session) => {
      if (!active) return;
      const validRole = role === "owner" ? session.ruolo === "owner" : session.ruolo === "cliente";
      if (!validRole) throw new Error("invalid-demo-role");
      navigate(role === "owner" ? "/dashboard" : clientRoute, { replace: true });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [attempt, clientRoute, navigate, role, searchParams, variant]);

  return <main className={`demo-entry demo-entry--${variant}`}><div className="demo-entry__mark"><span /><span /></div>{!error ? <><span>Demo {variant === "atelier" ? "Atelier" : "Barber"}</span><h1>Prepariamo la tua esperienza.</h1><div className="demo-entry__line"><i /></div><p>Carichiamo il salone e i dati dimostrativi.</p></> : <><span>Accesso non riuscito</span><h1>La demo non è disponibile.</h1><p>Verifica che i servizi locali o il progetto Firebase siano attivi.</p><button type="button" onClick={() => { setError(false); setAttempt((value) => value + 1); }}>Riprova</button></>}</main>;
}
