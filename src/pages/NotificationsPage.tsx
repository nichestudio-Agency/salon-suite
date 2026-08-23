import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listCoupons, createCoupon, deleteCoupon, type CouponWithId,
} from "../firebase/coupon-repo";
import { sendCampaign } from "../firebase/campaign";
import { formatEuro } from "../domain/money";
import type { CampaignFilters, CouponType } from "../domain/models";

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
  const [campTitolo, setCampTitolo] = useState("");
  const [campTesto, setCampTesto] = useState("");
  const [campSesso, setCampSesso] = useState<"" | "maschile" | "femminile">("");
  const [campNatoDa, setCampNatoDa] = useState("");
  const [campNatoA, setCampNatoA] = useState("");
  const [campCoupon, setCampCoupon] = useState("");
  const [campResult, setCampResult] = useState<string | null>(null);
  const [campBusy, setCampBusy] = useState(false);

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

  async function onSendCampaign(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setCampBusy(true);
    setCampResult(null);
    try {
      const filtri: CampaignFilters = {};
      if (campSesso) filtri.sesso = campSesso;
      if (campNatoDa) filtri.natoDa = campNatoDa;
      if (campNatoA) filtri.natoA = campNatoA;
      const res = await sendCampaign({
        salonId,
        filtri,
        titolo: campTitolo,
        testo: campTesto,
        ...(campCoupon ? { couponId: campCoupon } : {}),
      });
      setCampResult(res.recipientCount === 0
        ? "Nessun destinatario per questi filtri."
        : `Campagna inviata a ${res.recipientCount} destinatari.`);
      setCampTitolo(""); setCampTesto("");
    } catch {
      setCampResult("Invio della campagna non riuscito.");
    } finally {
      setCampBusy(false);
    }
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
      <h3>Invia una notifica mirata</h3>
      <form className="card" onSubmit={onSendCampaign}>
        <div className="field"><label htmlFor="ct2">Titolo campagna</label>
          <input id="ct2" aria-label="Titolo campagna" value={campTitolo} onChange={(e) => setCampTitolo(e.target.value)} required /></div>
        <div className="field"><label htmlFor="cx">Testo campagna</label>
          <textarea id="cx" aria-label="Testo campagna" value={campTesto} onChange={(e) => setCampTesto(e.target.value)} required /></div>
        <div className="field"><label htmlFor="cse">Sesso destinatari</label>
          <select id="cse" aria-label="Sesso destinatari" value={campSesso} onChange={(e) => setCampSesso(e.target.value as "" | "maschile" | "femminile")}>
            <option value="">Qualsiasi</option>
            <option value="maschile">Maschile</option>
            <option value="femminile">Femminile</option>
          </select></div>
        <div className="field"><label htmlFor="cnd">Nato da (opzionale)</label>
          <input id="cnd" aria-label="Nato da" type="date" value={campNatoDa} onChange={(e) => setCampNatoDa(e.target.value)} /></div>
        <div className="field"><label htmlFor="cna">Nato a (opzionale)</label>
          <input id="cna" aria-label="Nato a" type="date" value={campNatoA} onChange={(e) => setCampNatoA(e.target.value)} /></div>
        <div className="field"><label htmlFor="ccp">Coupon (opzionale)</label>
          <select id="ccp" aria-label="Coupon" value={campCoupon} onChange={(e) => setCampCoupon(e.target.value)}>
            <option value="">Nessuno</option>
            {coupons
              .filter((c) => c.attivo && (!c.scadenza || c.scadenza >= new Date().toISOString().slice(0, 10)))
              .map((c) => <option key={c.id} value={c.id}>{c.codice}</option>)}
          </select></div>
        {campResult && <p role="status">{campResult}</p>}
        <button className="btn" type="submit" disabled={campBusy}>Invia campagna</button>
      </form>
    </section>
  );
}
