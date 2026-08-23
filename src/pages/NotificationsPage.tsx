import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listCoupons, createCoupon, deleteCoupon, type CouponWithId,
} from "../firebase/coupon-repo";
import { formatEuro } from "../domain/money";
import type { CouponType } from "../domain/models";

function descrizioneSconto(c: CouponWithId): string {
  return c.tipo === "percentuale" ? `${c.valore}%` : `€ ${formatEuro(c.valore)}`;
}

export function NotificationsPage() {
  const { salonId } = useAuth();
  const [coupons, setCoupons] = useState<CouponWithId[]>([]);
  const [codice, setCodice] = useState("");
  const [tipo, setTipo] = useState<CouponType>("percentuale");
  const [valore, setValore] = useState("");
  const [scadenza, setScadenza] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function reload(id: string) {
    setCoupons(await listCoupons(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setError(null);
    try {
      await createCoupon(salonId, {
        codice: codice.trim(),
        tipo,
        valore:
          tipo === "percentuale"
            ? parseInt(valore || "0", 10)
            : Math.round(parseFloat(valore || "0") * 100),
        ...(scadenza ? { scadenza } : {}),
        attivo: true,
      });
      setCodice(""); setValore(""); setScadenza("");
      await reload(salonId);
    } catch {
      setError("Creazione del coupon non riuscita.");
    }
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteCoupon(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Notifiche</h2>
      <h3>Coupon</h3>
      {coupons.map((c) => (
        <div className="card row" key={c.id} style={{ justifyContent: "space-between" }}>
          <span>
            <strong>{c.codice}</strong> · {descrizioneSconto(c)}
            {c.scadenza && ` · scade ${c.scadenza}`}
            {!c.attivo && " · (non attivo)"}
          </span>
          <button className="btn btn--danger" onClick={() => onDelete(c.id)}>Elimina</button>
        </div>
      ))}
      <form className="card" onSubmit={onSubmit}>
        <h3>Nuovo coupon</h3>
        <div className="field"><label htmlFor="cc">Codice</label>
          <input id="cc" aria-label="Codice" value={codice} onChange={(e) => setCodice(e.target.value)} required /></div>
        <div className="field"><label htmlFor="ct">Tipo</label>
          <select id="ct" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as CouponType)}>
            <option value="percentuale">Percentuale (%)</option>
            <option value="fisso">Importo fisso (€)</option>
          </select></div>
        <div className="field"><label htmlFor="cv">Valore</label>
          <input id="cv" aria-label="Valore" type="number" min="0" step={tipo === "percentuale" ? "1" : "0.01"} value={valore} onChange={(e) => setValore(e.target.value)} required /></div>
        <div className="field"><label htmlFor="cs">Scadenza (opzionale)</label>
          <input id="cs" aria-label="Scadenza (opzionale)" type="date" value={scadenza} onChange={(e) => setScadenza(e.target.value)} /></div>
        {error && <p role="alert">{error}</p>}
        <button className="btn" type="submit">Crea coupon</button>
      </form>
      <p style={{ color: "var(--muted)", marginTop: 12 }}>
        Compositore campagne e auguri di compleanno in arrivo nelle prossime parti.
      </p>
    </section>
  );
}
