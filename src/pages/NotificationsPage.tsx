import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listCoupons, createCoupon, getCouponAnalytics, updateCoupon,
  type CouponAnalytics, type CouponWithId,
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
  const [analytics, setAnalytics] = useState<CouponAnalytics[]>([]);
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
  const [flashDiscount, setFlashDiscount] = useState("20");
  const [flashBusy, setFlashBusy] = useState(false);
  const [flashResult, setFlashResult] = useState<string | null>(null);

  async function reload(id: string) {
    const nextCoupons = await listCoupons(id);
    setCoupons(nextCoupons);
    setAnalytics(await getCouponAnalytics(id, nextCoupons));
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

  async function toggleCoupon(coupon: CouponWithId) {
    if (!salonId) return;
    await updateCoupon(salonId, coupon.id, { attivo: !coupon.attivo });
    await reload(salonId);
  }

  async function onFlashCampaign(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setFlashBusy(true);
    setFlashResult(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const discount = Math.min(Math.max(parseInt(flashDiscount, 10), 1), 100);
      const code = `OGGI${discount}-${today.slice(5).replace("-", "")}`;
      const existing = coupons.find((coupon) => coupon.codice === code && coupon.dataAppuntamento === today);
      const couponId = existing?.id ?? await createCoupon(salonId, {
          codice: code,
          tipo: "percentuale",
          valore: discount,
          scadenza: today,
          dataAppuntamento: today,
          attivo: true,
        });
      if (existing && !existing.attivo) await updateCoupon(salonId, existing.id, { attivo: true });
      const result = await sendCampaign({
        salonId,
        filtri: {},
        titolo: `Solo per oggi: -${discount}%`,
        testo: "Prenota un appuntamento per oggi e approfitta dello sconto.",
        couponId,
      });
      setFlashResult(`Offerta ${code} inviata a ${result.recipientCount} clienti.`);
      await reload(salonId);
    } catch {
      setFlashResult("Creazione dell'offerta lampo non riuscita.");
    } finally {
      setFlashBusy(false);
    }
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
      <div className="coupon-section-heading"><div><span>Performance</span><h3>Monitor coupon</h3><p>Dal messaggio inviato alla prenotazione effettuata.</p></div></div>
      {coupons.map((c) => (
        <article className={`coupon-monitor-card ${c.attivo ? "" : "is-inactive"}`} key={c.id}>
          <div className="coupon-monitor-card__title"><span className="coupon-code">{c.codice}</span><strong>{descrizioneSconto(c)} di sconto</strong><small>{c.dataAppuntamento ? `Solo appuntamenti del ${c.dataAppuntamento}` : c.scadenza ? `Valido fino al ${c.scadenza}` : "Senza scadenza"}</small></div>
          {(() => { const stats = analytics.find((item) => item.couponId === c.id); return <div className="coupon-metrics"><span><b>{stats?.inviati ?? 0}</b>Inviati</span><span><b>{stats?.utilizzati ?? 0}</b>Utilizzati</span><span><b>{stats?.nonUtilizzati ?? 0}</b>Non utilizzati</span><span><b>{stats?.scaduti ?? 0}</b>Scaduti</span></div>; })()}
          <button className="btn btn--ghost" type="button" onClick={() => void toggleCoupon(c)}>{c.attivo ? "Disattiva" : "Riattiva"}</button>
        </article>
      ))}
      {coupons.length === 0 && <div className="card"><p>Nessun coupon creato.</p></div>}

      <form className="flash-campaign" onSubmit={onFlashCampaign}>
        <div><span>Riempi l'agenda</span><h3>Offerta lampo di oggi</h3><p>Invia a tutti i clienti un coupon valido esclusivamente per gli appuntamenti di oggi.</p></div>
        <div className="flash-campaign__action"><label htmlFor="flash-discount">Sconto</label><div><input id="flash-discount" aria-label="Sconto offerta lampo" type="number" min="1" max="100" value={flashDiscount} onChange={(e) => setFlashDiscount(e.target.value)} /><span>%</span></div><button className="btn" type="submit" disabled={flashBusy}>{flashBusy ? "Invio…" : "Crea e invia"}</button></div>
        {flashResult && <p className="flash-campaign__result" role="status">{flashResult}</p>}
      </form>

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
