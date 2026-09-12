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
import { listSalonClients, type SalonClient } from "../firebase/client-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import { listProducts, type ProductWithId } from "../firebase/product-repo";

function descrizioneSconto(c: CouponWithId): string {
  if (c.tipo === "prodotto_omaggio") return c.giftProductTitle ? `${c.giftProductTitle} in omaggio` : "Prodotto in omaggio";
  return c.tipo === "percentuale" ? `${c.valore}%` : `€ ${formatEuro(c.valore)}`;
}
const localToday = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };

export function NotificationsPage() {
  const { salonId } = useAuth();
  const [coupons, setCoupons] = useState<CouponWithId[]>([]);
  const [analytics, setAnalytics] = useState<CouponAnalytics[]>([]);
  const [codice, setCodice] = useState("");
  const [tipo, setTipo] = useState<CouponType>("percentuale");
  const [valore, setValore] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [giftProductId, setGiftProductId] = useState("");
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
  const [bdType, setBdType] = useState<"percentuale" | "prodotto_omaggio">("percentuale");
  const [bdDiscount, setBdDiscount] = useState("15"); const [bdValidity, setBdValidity] = useState("14"); const [bdProductId, setBdProductId] = useState("");
  const [bdResult, setBdResult] = useState<string | null>(null);
  const [flashDiscount, setFlashDiscount] = useState("20");
  const [flashBusy, setFlashBusy] = useState(false);
  const [flashResult, setFlashResult] = useState<string | null>(null);
  const [flashDate, setFlashDate] = useState(localToday()); const [flashFrom, setFlashFrom] = useState("14:00"); const [flashTo, setFlashTo] = useState("18:00"); const [flashService, setFlashService] = useState(""); const [flashText, setFlashText] = useState("Prenota nella fascia selezionata e approfitta dello sconto.");
  const [clients, setClients] = useState<SalonClient[]>([]); const [services, setServices] = useState<ServiceWithId[]>([]); const [products, setProducts] = useState<ProductWithId[]>([]); const [selectedClients, setSelectedClients] = useState<string[]>([]); const [openMetric, setOpenMetric] = useState<{ coupon: CouponWithId; kind: "inviati" | "utilizzati" | "nonUtilizzati" | "scaduti" } | null>(null);

  async function reload(id: string) {
    const nextCoupons = await listCoupons(id);
    setCoupons(nextCoupons);
    const [nextAnalytics, nextClients, nextServices, nextProducts] = await Promise.all([getCouponAnalytics(id, nextCoupons), listSalonClients(id).catch(() => []), listServices(id).catch(() => []), listProducts(id).catch(() => [])]); setAnalytics(nextAnalytics); setClients(nextClients); setServices(nextServices); setProducts(nextProducts.filter((product) => product.attivo));
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
        setBdType(s.compleanno.scontoTipo === "prodotto_omaggio" ? "prodotto_omaggio" : "percentuale"); setBdDiscount(String(s.compleanno.scontoValore ?? 15)); setBdValidity(String(s.compleanno.validitaGiorni ?? 14)); setBdProductId(s.compleanno.giftProductId ?? "");
      }
    });
  }, [salonId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setError(null);
    try {
      const giftProduct = products.find((product) => product.id === giftProductId);
      await createCoupon(salonId, {
        codice: codice.trim(),
        tipo,
        valore:
          tipo === "percentuale" ? parseInt(valore || "0", 10)
            : tipo === "fisso" ? Math.round(parseFloat(valore || "0") * 100) : 0,
        ...(tipo === "prodotto_omaggio" && giftProduct ? { giftProductId: giftProduct.id, giftProductTitle: giftProduct.titolo, spesaMinima: Math.round(parseFloat(minSpend || "0") * 100) } : {}),
        ...(scadenza ? { scadenza } : {}),
        attivo: true,
      });
      setCodice(""); setValore(""); setMinSpend(""); setGiftProductId(""); setScadenza("");
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
      const today = flashDate;
      const discount = Math.min(Math.max(parseInt(flashDiscount, 10), 1), 100);
      const code = `OGGI${discount}-${today.slice(5).replace("-", "")}`;
      const existing = coupons.find((coupon) => coupon.codice === code && coupon.dataAppuntamento === today);
      const couponId = existing?.id ?? await createCoupon(salonId, {
          codice: code,
          tipo: "percentuale",
          valore: discount,
          scadenza: today,
          dataAppuntamento: today,
          fasciaDa: flashFrom, fasciaA: flashTo, ...(flashService ? { serviceId: flashService } : {}), origin: "riempi_agenda",
          attivo: true,
        });
      if (existing && !existing.attivo) await updateCoupon(salonId, existing.id, { attivo: true });
      const result = await sendCampaign({
        salonId,
        filtri: selectedClients.length ? { recipientIds: selectedClients } : {},
        titolo: `Agenda libera: -${discount}% il ${new Intl.DateTimeFormat("it-IT").format(new Date(today + "T12:00:00"))}`,
        testo: `${flashText} Orario ${flashFrom}–${flashTo}.`,
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
      if (selectedClients.length) filtri.recipientIds = selectedClients;
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
      const birthdayProduct = products.find((product) => product.id === bdProductId);
      await updateBirthdayConfig(salonId, {
        attivo: bdAttivo,
        messaggio: bdMessaggio,
        couponId: null, scontoTipo: bdType, scontoValore: bdType === "percentuale" ? Math.max(1, Number(bdDiscount)) : 0, validitaGiorni: Math.max(1, Number(bdValidity)),
        ...(bdType === "prodotto_omaggio" && birthdayProduct ? { giftProductId: birthdayProduct.id, giftProductTitle: birthdayProduct.titolo } : {}),
      });
      setBdResult("Configurazione salvata.");
    } catch {
      setBdResult("Salvataggio non riuscito.");
    }
  }
  async function onSendBirthdaysNow() {
    setBdResult(null);
    try {
      if (!salonId) return;
      const { count } = await runBirthdayGreetings(salonId);
      setBdResult(`Auguri inviati a ${count} clienti che compiono gli anni oggi.`);
    } catch {
      setBdResult("Invio auguri non riuscito.");
    }
  }

  return (
    <section>
      <div className="dashboard-page-header"><div><span>Comunicazione</span><h2>Marketing</h2><p>Coupon, segmenti comportamentali e automazioni.</p></div></div>
      <div className="notification-overview"><article><strong>Compleanni</strong><span>Parte ogni giorno in automatico con un codice personale monouso.</span><b className={bdAttivo ? "is-active" : ""}>{bdAttivo ? "Automatico" : "Da configurare"}</b></article><article><strong>Clienti da riattivare</strong><span>Invio manuale a chi non torna da un periodo scelto, incluse le visite registrate al banco.</span><b>Campagna manuale</b></article><article><strong>Prodotti</strong><span>Invio manuale a chi non acquista da un numero di giorni scelto.</span><b>Campagna manuale</b></article></div>
      <div className="coupon-section-heading"><div><span>Performance</span><h3>Monitor coupon</h3><p>Dal messaggio inviato alla prenotazione effettuata.</p></div></div>
      {coupons.map((c) => (
        <article className={`coupon-monitor-card ${c.attivo ? "" : "is-inactive"}`} key={c.id}>
          <div className="coupon-monitor-card__title"><span className="coupon-code">{c.codice}</span><strong>{descrizioneSconto(c)}</strong><small>{c.tipo === "prodotto_omaggio" && c.spesaMinima ? `Con almeno € ${formatEuro(c.spesaMinima)} di spesa · ` : ""}{c.dataAppuntamento ? `Solo appuntamenti del ${c.dataAppuntamento}` : c.scadenza ? `Valido fino al ${c.scadenza}` : "Senza scadenza"}</small></div>
          {(() => { const stats = analytics.find((item) => item.couponId === c.id); return <div className="coupon-metrics">{(["inviati", "utilizzati", "nonUtilizzati", "scaduti"] as const).map((kind) => <button type="button" onClick={() => setOpenMetric({ coupon: c, kind })} key={kind}><b>{stats?.[kind] ?? 0}</b>{kind === "nonUtilizzati" ? "Non utilizzati" : kind.slice(0, 1).toUpperCase() + kind.slice(1)}</button>)}</div>; })()}
          <button className="btn btn--ghost" type="button" onClick={() => void toggleCoupon(c)}>{c.attivo ? "Disattiva" : "Riattiva"}</button>
        </article>
      ))}
      {coupons.length === 0 && <div className="card"><p>Nessun coupon creato.</p></div>}

      <form className="flash-campaign" onSubmit={onFlashCampaign}>
        <div><span>Riempi l'agenda</span><h3>Offerta su una fascia libera</h3><p>Decidi esattamente giorno, orario, servizio, sconto e messaggio.</p></div>
        <div className="flash-campaign__fields"><label>Giorno<input type="date" value={flashDate} onChange={(e) => setFlashDate(e.target.value)} /></label><label>Dalle<input type="time" value={flashFrom} onChange={(e) => setFlashFrom(e.target.value)} /></label><label>Alle<input type="time" value={flashTo} onChange={(e) => setFlashTo(e.target.value)} /></label><label>Servizio<select value={flashService} onChange={(e) => setFlashService(e.target.value)}><option value="">Tutti</option>{services.map((service) => <option value={service.id} key={service.id}>{service.titolo}</option>)}</select></label><label>Sconto %<input type="number" min="1" max="100" value={flashDiscount} onChange={(e) => setFlashDiscount(e.target.value)} /></label><label className="is-wide">Messaggio<input value={flashText} onChange={(e) => setFlashText(e.target.value)} /></label><button className="btn" type="submit" disabled={flashBusy}>{flashBusy ? "Invio…" : "Invia offerta"}</button></div>
        {flashResult && <p className="flash-campaign__result" role="status">{flashResult}</p>}
      </form>

      <form className="card" id="nuovo-coupon" onSubmit={onSubmit}>
        <h3>Nuovo coupon</h3>
        <div className="field"><label htmlFor="cc">Codice</label>
          <input id="cc" aria-label="Codice" value={codice} onChange={(e) => setCodice(e.target.value)} required /></div>
        <div className="field"><label htmlFor="ct">Tipo</label>
          <select id="ct" aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value as CouponType)}>
            <option value="percentuale">Percentuale (%)</option>
            <option value="fisso">Importo fisso (€)</option>
            <option value="prodotto_omaggio">Prodotto in omaggio</option>
          </select></div>
        {tipo !== "prodotto_omaggio" ? <div className="field"><label htmlFor="cv">Valore</label><input id="cv" aria-label="Valore" type="number" min="0" step={tipo === "percentuale" ? "1" : "0.01"} value={valore} onChange={(e) => setValore(e.target.value)} required /></div> : <><div className="field"><label htmlFor="cproduct">Prodotto omaggio</label><select id="cproduct" aria-label="Prodotto omaggio" value={giftProductId} onChange={(e) => setGiftProductId(e.target.value)} required><option value="">Seleziona dal catalogo</option>{products.map((product) => <option key={product.id} value={product.id}>{product.titolo}</option>)}</select></div><div className="field"><label htmlFor="cspend">Spesa minima (€)</label><input id="cspend" aria-label="Spesa minima" type="number" min="0" step="0.01" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} required /></div></>}
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
        <fieldset className="campaign-clients"><legend>Clienti specifici (opzionale)</legend><p>Se selezioni uno o più nomi, la campagna verrà inviata soltanto a loro.</p><div>{clients.map((client) => <label key={client.id}><input type="checkbox" checked={selectedClients.includes(client.id)} onChange={() => setSelectedClients((current) => current.includes(client.id) ? current.filter((id) => id !== client.id) : [...current, client.id])} /><span>{client.nome}<small>{client.email}</small></span></label>)}</div></fieldset>
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
        <div className="birthday-unique-note"><strong>Codice personale e monouso</strong><p>Per ogni compleanno viene generato un codice diverso, legato al cliente. Non può essere condiviso né utilizzato due volte.</p></div>
        <div className="field"><label htmlFor="bdtype">Regalo di compleanno</label><select id="bdtype" value={bdType} onChange={(e) => setBdType(e.target.value as "percentuale" | "prodotto_omaggio")}><option value="percentuale">Sconto percentuale</option><option value="prodotto_omaggio">Prodotto in omaggio</option></select></div>
        {bdType === "percentuale" ? <div className="field"><label htmlFor="bdd">Sconto di compleanno (%)</label><input id="bdd" type="number" min="1" max="100" value={bdDiscount} onChange={(e) => setBdDiscount(e.target.value)} /></div> : <div className="field"><label htmlFor="bdproduct">Prodotto da regalare</label><select id="bdproduct" value={bdProductId} onChange={(e) => setBdProductId(e.target.value)} required><option value="">Seleziona dal catalogo</option>{products.map((product) => <option key={product.id} value={product.id}>{product.titolo}</option>)}</select></div>}
        <div className="field"><label htmlFor="bdv">Validità del codice (giorni)</label><input id="bdv" type="number" min="1" max="90" value={bdValidity} onChange={(e) => setBdValidity(e.target.value)} /></div>
        {bdResult && <p role="status">{bdResult}</p>}
        <div className="row">
          <button className="btn" type="submit">Salva compleanno</button>
          <button className="btn btn--ghost" type="button" onClick={onSendBirthdaysNow}>Invia auguri di oggi</button>
        </div>
      </form>
      {openMetric && (() => { const stats = analytics.find((item) => item.couponId === openMetric.coupon.id); const ids = openMetric.kind === "utilizzati" ? stats?.usedClientIds ?? [] : openMetric.kind === "nonUtilizzati" || openMetric.kind === "scaduti" ? (stats?.recipientIds ?? []).filter((id) => !stats?.usedClientIds.includes(id)) : stats?.recipientIds ?? []; const people = ids.map((id) => clients.find((client) => client.id === id)).filter(Boolean) as SalonClient[]; return <div className="dashboard-modal" role="dialog" aria-modal="true"><button type="button" aria-label="Chiudi" onClick={() => setOpenMetric(null)} /><section><header><div><span>{openMetric.coupon.codice}</span><h3>{openMetric.kind === "nonUtilizzati" ? "Non utilizzati" : openMetric.kind}</h3></div><button type="button" onClick={() => setOpenMetric(null)}>×</button></header>{people.length ? people.map((person) => <article key={person.id}><strong>{person.nome}</strong><span>{person.email || person.telefono || "Contatto non disponibile"}</span></article>) : <p>Nessun cliente in questa categoria.</p>}</section></div>; })()}
    </section>
  );
}
