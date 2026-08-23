import type { ReactNode } from "react";
import barberEditorial from "../assets/barber-editorial.webp";
import { useOptionalSalonTenant } from "./salon-tenant-context";

type AuthLayoutProps = {
  children: ReactNode;
  variant?: "client" | "owner";
};

export function AuthLayout({ children, variant = "client" }: AuthLayoutProps) {
  const salon = useOptionalSalonTenant()?.salon;
  const brandName = variant === "client" && salon ? salon.nome : "BARBERIA";
  return (
    <main className="auth-shell">
      <section className="auth-showcase" aria-label="Barberia">
        <img src={barberEditorial} alt="Barbiere durante un trattamento della barba" />
        <div className="auth-showcase__scrim" />
        <div className="auth-showcase__topline">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>{brandName}</span>
        </div>
        <div className="auth-showcase__copy">
          <span className="auth-showcase__eyebrow">Taglio · Barba · Stile</span>
          <h2>{variant === "owner" ? "Il tuo salone, sotto controllo." : "Il tuo tempo. Il tuo stile."}</h2>
          <p>
            {variant === "owner"
              ? "Agenda, team e clienti in un unico spazio progettato per il lavoro quotidiano."
              : "Prenota l'esperienza giusta, con il professionista giusto."}
          </p>
        </div>
        <span className="auth-showcase__index">EST. 2026 — ITALIA</span>
      </section>
      <section className="auth-main">
        <div className="auth-main__brand" aria-hidden="true">
          <span className="brand-mark">B</span>
          <span>{brandName}</span>
        </div>
        {children}
      </section>
    </main>
  );
}
