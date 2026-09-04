import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listCoupons, createCoupon, deleteCoupon, type CouponWithId,
} from "../firebase/coupon-repo";
import { sendCampaign } from "../firebase/campaign";
import { getSalon, updateBirthdayConfig } from "../firebase/salon-repo";
import { runBirthdayGreetings } from "../firebase/birthday";
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
  const [campBookingInactive, setCampBookingInactive] = useState("");
  const [campProductInactive, setCampProductInactive] = useState("");
  const [campResult, setCampResult] = useState<string | null>(null);
  const [campBusy, setCampBusy] = useState(false);
  const [bdAttivo, setBdAttivo] = useState(false);
  const [bdMessaggio, setBdMessaggio] = useState("");
  const [bdCoupon, setBdCoupon] = useState("");
  const [bdResult, setBdResult] = useState<string | null>(null);

  async function reload(id: string) {
    setCoupons(await listCoupons(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  useEffect(() => {
    if (!salonId) return;
    void getSalon(salonId).then((s) => {
      if (s?.compleanno) {
        setBdAttivo(s.compleanno.attivo);
        setBdMessaggio(s.compleanno.messaggio ?? "");
        setBdCoupon(s.compleanno.couponId ?? "");
      }
    });
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
      if (campBookingInactive) filtri.bookingInactiveDays = parseInt(campBookingInactive, 10);
      if (campProductInactive) filtri.productInactiveDays = parseInt(campProductInactive, 10);
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

  async function onSaveBirthday(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setBdResult(null);
    try {
      await updateBirthdayConfig(salonId, {
        attivo: bdAttivo,
        messaggio: bdMessaggio,
        couponId: bdCoupon || null,
      });
      setBdResult("Configurazione salvata.");
    } catch {
      setBdResult("Salvataggio non riuscito.");
    }
  }
  async function onSendBirthdaysNow() {
    setBdResult(null);
    try {
      const { count } = await runBirthdayGreetings();
      setBdResult(`Auguri inviati a ${count} clienti che compiono gli anni oggi.`);
    } catch {
      setBdResult("Invio auguri non riuscito.");
    }
  }

  return (
    <section>
      <div className="dashboard-page-header"><div><span>Comunicazione</span><h2>Notifiche</h2><p>Coupon, segmenti comportamentali e automazioni.</p></div></div>
      <div className="notification-overview"><article><strong>Compleanni</strong><span>Invio automatico giornaliero</span><b className={bdAttivo ? "is-active" : ""}>{bdAttivo ? "Attivo" : "Da configurare"}</b></article><article><strong>Clienti inattivi</strong><span>Segmenta per ultima prenotazione</span><b>Su richiesta</b></article><article><strong>Prodotti</strong><span>Segmenta per ultimo acquisto</span><b>Su richiesta</b></article></div>
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
        <div className="field"><label htmlFor="cbi">Nessuna prenotazione da almeno (giorni)</label>
          <input id="cbi" aria-label="Giorni senza prenotazioni" type="number" min="1" max="3650" placeholder="es. 90" value={campBookingInactive} onChange={(e) => setCampBookingInactive(e.target.value)} /></div>
        <div className="field"><label htmlFor="cpi">Nessun acquisto da almeno (giorni)</label>
          <input id="cpi" aria-label="Giorni senza acquisti" type="number" min="1" max="3650" placeholder="es. 120" value={campProductInactive} onChange={(e) => setCampProductInactive(e.target.value)} /></div>
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
      <h3>Auguri di compleanno</h3>
      <form className="card" onSubmit={onSaveBirthday}>
        <label className="row" style={{ gap: 8 }}>
          <input type="checkbox" aria-label="Auguri di compleanno attivi" checked={bdAttivo} onChange={(e) => setBdAttivo(e.target.checked)} />
          Invia automaticamente gli auguri ogni giorno
        </label>
        <div className="field"><label htmlFor="bdm">Messaggio di compleanno</label>
          <textarea id="bdm" aria-label="Messaggio di compleanno" value={bdMessaggio} onChange={(e) => setBdMessaggio(e.target.value)} /></div>
        <div className="field"><label htmlFor="bdc">Coupon di compleanno (opzionale)</label>
          <select id="bdc" aria-label="Coupon di compleanno" value={bdCoupon} onChange={(e) => setBdCoupon(e.target.value)}>
            <option value="">Nessuno</option>
            {coupons.filter((c) => c.attivo).map((c) => <option key={c.id} value={c.id}>{c.codice}</option>)}
          </select></div>
        {bdResult && <p role="status">{bdResult}</p>}
        <div className="row">
          <button className="btn" type="submit">Salva compleanno</button>
          <button className="btn btn--ghost" type="button" onClick={onSendBirthdaysNow}>Invia auguri di oggi</button>
        </div>
      </form>
    </section>
  );
}
