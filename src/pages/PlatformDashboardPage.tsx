import { useEffect, useState, type FormEvent } from "react";
import { AppIcon } from "../components/AppIcon";
import type { LicensePlan, LicenseStatus } from "../domain/models";
import { listPlatformSalons, updatePlatformSalonLicense, type PlatformSalon } from "../firebase/platform-admin";

const STATUS_LABELS: Record<LicenseStatus, string> = {
  trial: "In prova", attiva: "Attiva", scaduta: "Scaduta", sospesa: "Sospesa",
};

function money(cents: number): string {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
}

function LicenseEditor({ salon, onSaved, onCancel }: { salon: PlatformSalon; onSaved: () => void; onCancel: () => void }) {
  const [stato, setStato] = useState<LicenseStatus>(salon.licenza.stato);
  const [piano, setPiano] = useState<LicensePlan>(salon.licenza.piano);
  const [scadenza, setScadenza] = useState(salon.licenza.scadenza);
  const [prezzo, setPrezzo] = useState((salon.licenza.prezzoMensile / 100).toFixed(0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      await updatePlatformSalonLicense({ salonId: salon.id, stato, piano, scadenza, prezzoMensile: Math.round(Number(prezzo) * 100) });
      onSaved();
    } catch {
      setError("Non siamo riusciti ad aggiornare la licenza.");
    } finally { setBusy(false); }
  }

  return <form className="license-editor" onSubmit={submit} id="licenze">
    <div className="field"><label htmlFor={`plan-${salon.id}`}>Piano</label><select id={`plan-${salon.id}`} value={piano} onChange={(event) => setPiano(event.target.value as LicensePlan)}><option value="start">Start</option><option value="studio">Studio</option><option value="pro">Pro</option></select></div>
    <div className="field"><label htmlFor={`status-${salon.id}`}>Stato</label><select id={`status-${salon.id}`} value={stato} onChange={(event) => setStato(event.target.value as LicenseStatus)}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="field"><label htmlFor={`expiry-${salon.id}`}>Scadenza</label><input id={`expiry-${salon.id}`} type="date" value={scadenza} onChange={(event) => setScadenza(event.target.value)} required /></div>
    <div className="field"><label htmlFor={`price-${salon.id}`}>Canone mensile (€)</label><input id={`price-${salon.id}`} type="number" min="0" step="1" value={prezzo} onChange={(event) => setPrezzo(event.target.value)} required /></div>
    {error && <p role="alert">{error}</p>}
    <div className="license-editor__actions"><button className="platform-button" type="submit" disabled={busy}>{busy ? "Salvataggio…" : "Salva licenza"}</button><button className="platform-text-button" type="button" onClick={onCancel}>Annulla</button></div>
  </form>;
}

export function PlatformDashboardPage() {
  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"tutte" | LicenseStatus>("tutte");
  const [editing, setEditing] = useState<string | null>(null);

  async function reload(initial = false) {
    if (!initial) { setLoading(true); setError(null); }
    try { setSalons(await listPlatformSalons()); }
    catch { setError("Non siamo riusciti a caricare i dati della piattaforma."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(true); }, []);

  const [referenceDate] = useState(() => new Date());
  const today = referenceDate.toISOString().slice(0, 10);
  const inThirtyDays = new Date(referenceDate.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
  const active = salons.filter((salon) => salon.licenza.stato === "attiva");
  const mrr = active.reduce((sum, salon) => sum + salon.licenza.prezzoMensile, 0);
  const expiring = salons.filter((salon) => salon.licenza.scadenza >= today && salon.licenza.scadenza <= inThirtyDays).length;
  const bookings = salons.reduce((sum, salon) => sum + salon.prenotazioni30g, 0);
  const filtered = salons.filter((salon) => {
    const text = `${salon.nome} ${salon.dominio} ${salon.owner?.email ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (status === "tutte" || salon.licenza.stato === status);
  });

  return <section className="platform-dashboard">
    <header className="platform-title"><div><span>Controllo piattaforma</span><h1>Il tuo business,<br />salone per salone.</h1></div><p>Licenze, adozione e performance in un’unica vista. I dati dei clienti restano separati dentro ogni tenant.</p></header>

    <section className="platform-hero" aria-label="Riepilogo economico">
      <div><span>Ricavo mensile ricorrente</span><strong>{money(mrr)}</strong><p>{active.length} licenze attive su {salons.length} saloni registrati</p></div>
      <div className="platform-hero__signal"><i /><i /><i /><i /><i /><i /><span>Ultimi 6 mesi</span></div>
      <dl><div><dt>Prenotazioni / 30g</dt><dd>{bookings}</dd></div><div><dt>Scadenze / 30g</dt><dd>{expiring}</dd></div><div><dt>ARPA mensile</dt><dd>{money(active.length ? Math.round(mrr / active.length) : 0)}</dd></div></dl>
    </section>

    <div className="platform-kpis">
      <article><span><AppIcon name="building" size={20} /></span><div><small>Saloni totali</small><strong>{salons.length}</strong><p>tenant configurati</p></div></article>
      <article><span><AppIcon name="key" size={20} /></span><div><small>Licenze attive</small><strong>{active.length}</strong><p>{salons.filter((salon) => salon.licenza.stato === "trial").length} ancora in prova</p></div></article>
      <article><span><AppIcon name="users" size={20} /></span><div><small>Clienti gestiti</small><strong>{salons.reduce((sum, salon) => sum + salon.clienti, 0)}</strong><p>su tutta la rete</p></div></article>
    </div>

    <section className="platform-salons" id="saloni">
      <header><div><span>Tenant</span><h2>Saloni e licenze</h2></div><div className="platform-filters"><input aria-label="Cerca salone" placeholder="Cerca salone, dominio o titolare" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filtra per stato" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="tutte">Tutte le licenze</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></header>
      {loading ? <div className="platform-empty">Sto raccogliendo i dati dei saloni…</div> : error ? <div className="platform-empty is-error" role="alert">{error}<button type="button" onClick={() => void reload()}>Riprova</button></div> : filtered.length === 0 ? <div className="platform-empty">Nessun salone corrisponde alla ricerca.</div> : <div className="platform-salon-list">
        {filtered.map((salon) => <article className="platform-salon" key={salon.id}>
          <div className="platform-salon__identity"><span>{salon.nome.slice(0, 2).toUpperCase()}</span><div><strong>{salon.nome}</strong><small>{salon.dominio}</small><em>{salon.owner?.nome ?? "Titolare non assegnato"}{salon.owner?.email ? ` · ${salon.owner.email}` : ""}</em></div></div>
          <div className="platform-salon__numbers"><span><b>{salon.clienti}</b>Clienti</span><span><b>{salon.operatori}</b>Operatori</span><span><b>{salon.prenotazioni30g}</b>Prenotazioni</span><span><b>{money(salon.fatturato30g)}</b>Volume 30g</span></div>
          <div className="platform-salon__license"><span className={`license-status is-${salon.licenza.stato}`}>{STATUS_LABELS[salon.licenza.stato]}</span><strong>{salon.licenza.piano.toUpperCase()} · {money(salon.licenza.prezzoMensile)}/mese</strong><small>Scade il {salon.licenza.scadenza || "—"}</small></div>
          <button className="platform-row-action" type="button" onClick={() => setEditing(editing === salon.id ? null : salon.id)}>{editing === salon.id ? "Chiudi" : "Gestisci"}</button>
          {editing === salon.id && <LicenseEditor salon={salon} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} />}
        </article>)}
      </div>}
    </section>
  </section>;
}
