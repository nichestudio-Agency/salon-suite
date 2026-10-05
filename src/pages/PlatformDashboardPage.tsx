import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import QRCode from "qrcode";
import { AppIcon } from "../components/AppIcon";
import type {
  LicensePlan,
  LicenseStatus,
  BillingCycle,
  PaymentStatus,
  SubscriptionFeatureKey,
  SubscriptionPlansConfig,
  TemporaryFeatureAccess,
  SalonBranding,
  SalonType,
} from "../domain/models";
import {
  createPlatformSalon,
  DEFAULT_SUBSCRIPTION_PLANS,
  ensurePlatformSalonAccessCode,
  getSubscriptionPlansConfig,
  listPlatformSalons,
  updatePlatformSalonBranding,
  updatePlatformSalonLicense,
  updateSubscriptionPlansConfig,
  uploadPlatformBrandAsset,
  type BrandAssetSlot,
  type PlatformSalon,
} from "../firebase/platform-admin";

const STATUS_LABELS: Record<LicenseStatus, string> = {
  trial: "In prova",
  attiva: "Attiva",
  scaduta: "Scaduta",
  sospesa: "Sospesa",
};
const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pagato: "In regola",
  in_scadenza: "Da verificare",
  insoluto: "Insoluto",
};
const PLAN_KEYS: LicensePlan[] = ["start", "studio", "pro"];
const FEATURE_CATALOG: Array<{ key: SubscriptionFeatureKey; label: string; detail: string }> = [
  { key: "agenda", label: "Agenda", detail: "Prenotazioni, disponibilità e calendario" },
  { key: "clienti", label: "Clienti", detail: "Anagrafiche, storico e visite manuali" },
  { key: "servizi_team", label: "Servizi e team", detail: "Catalogo servizi, operatori e orari" },
  { key: "prodotti_ordini", label: "Prodotti e ordini", detail: "Shop, catalogo retail e ordini" },
  { key: "marketing", label: "Marketing", detail: "Notifiche, coupon e campagne mirate" },
  { key: "fidelity", label: "Fidelity", detail: "Card, punti, premi e riscatti QR" },
  { key: "statistiche", label: "Statistiche", detail: "Performance, trend e analisi avanzate" },
  { key: "integrazioni", label: "Cassa e integrazioni", detail: "Collegamenti e automazioni operative" },
  { key: "importazione", label: "Importazione dati", detail: "Acquisizione dati da sistemi esterni" },
  { key: "app_cliente", label: "App cliente", detail: "Esperienza mobile white-label" },
];
const DEFAULT_BRANDING: Record<SalonType, SalonBranding> = {
  barberia: {
    backgroundColor: "#181817",
    foregroundColor: "#f4f0e9",
    accentColor: "#ff5420",
  },
  parrucchieria: {
    backgroundColor: "#1c1719",
    foregroundColor: "#f5efec",
    accentColor: "#d9a0aa",
  },
};

function money(cents: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function defaultExpiry() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

function PlanCatalogEditor({
  config,
  onSaved,
  onClose,
}: {
  config: SubscriptionPlansConfig;
  onSaved: (value: SubscriptionPlansConfig) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<SubscriptionPlansConfig>(() => structuredClone(config));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updatePlan(plan: LicensePlan, patch: Partial<SubscriptionPlansConfig["piani"][LicensePlan]>) {
    setDraft((current) => ({
      piani: { ...current.piani, [plan]: { ...current.piani[plan], ...patch } },
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await updateSubscriptionPlansConfig(draft);
      onSaved(draft);
      setNotice("Catalogo abbonamenti aggiornato.");
    } catch {
      setError("Non siamo riusciti a salvare il catalogo abbonamenti.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="plan-catalog-editor" aria-labelledby="plan-catalog-title">
      <header>
        <div><span>Catalogo commerciale</span><h2 id="plan-catalog-title">Configura i piani</h2><p>Nomi, listini e dotazioni diventano il riferimento per tutti i nuovi contratti.</p></div>
        <button type="button" onClick={onClose} aria-label="Chiudi configurazione piani"><AppIcon name="close" /></button>
      </header>
      <form onSubmit={save}>
        <div className="plan-catalog-grid">
          {PLAN_KEYS.map((plan, index) => {
            const item = draft.piani[plan];
            return <article className={plan === "studio" ? "is-featured" : ""} key={plan}>
              <div className="plan-catalog-card__number">0{index + 1}</div>
              <label>Nome piano<input value={item.nome} maxLength={32} onChange={(event) => updatePlan(plan, { nome: event.target.value })} required /></label>
              <label>Descrizione<textarea value={item.descrizione} maxLength={140} onChange={(event) => updatePlan(plan, { descrizione: event.target.value })} required /></label>
              <label>Prezzo mensile (€)<input type="number" min="0" step="1" value={item.prezzoMensile / 100} onChange={(event) => updatePlan(plan, { prezzoMensile: Math.round(Number(event.target.value) * 100) })} required /></label>
              <fieldset><legend>Funzionalità incluse</legend>{FEATURE_CATALOG.map((feature) => {
                const checked = item.funzionalita.includes(feature.key);
                return <label className="plan-feature-check" key={feature.key}>
                  <input type="checkbox" checked={checked} onChange={(event) => updatePlan(plan, { funzionalita: event.target.checked ? [...item.funzionalita, feature.key] : item.funzionalita.filter((key) => key !== feature.key) })} />
                  <span><strong>{feature.label}</strong><small>{feature.detail}</small></span>
                </label>;
              })}</fieldset>
            </article>;
          })}
        </div>
        <footer>
          <p>Le eccezioni già assegnate alle singole attività restano invariate.</p>
          <div>{error && <span className="platform-form-error" role="alert">{error}</span>}{notice && <span className="platform-form-success">{notice}</span>}<button className="platform-button" disabled={busy}>{busy ? "Salvataggio…" : "Salva catalogo"}</button></div>
        </footer>
      </form>
    </section>
  );
}

function CreateSalonPanel({
  plans,
  onCreated,
  onCancel,
}: {
  plans: SubscriptionPlansConfig;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [nome, setNome] = useState("");
  const [salonId, setSalonId] = useState("");
  const [dominio, setDominio] = useState("");
  const [tipo, setTipo] = useState<SalonType>("barberia");
  const [ownerNome, setOwnerNome] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [piano, setPiano] = useState<LicensePlan>("studio");
  const [stato, setStato] = useState<LicenseStatus>("trial");
  const [scadenza, setScadenza] = useState(defaultExpiry);
  const [prezzo, setPrezzo] = useState(String(plans.piani.studio.prezzoMensile / 100));
  const [ciclo, setCiclo] = useState<BillingCycle>("mensile");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function updateName(value: string) {
    setNome(value);
    const nextSlug = slugify(value);
    setSalonId(nextSlug);
    setDominio(nextSlug ? `${nextSlug}.barberia.app` : "");
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createPlatformSalon({
        salonId,
        nome,
        tipo,
        dominio,
        ownerNome,
        ownerEmail,
        ownerPassword,
        piano,
        stato,
        scadenza,
        prezzoMensile: Math.round(Number(prezzo) * 100),
        ciclo,
        statoPagamento: "pagato",
        rinnovoAutomatico: true,
      });
      onCreated();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message.includes("email")
          ? "L’email del titolare è già registrata."
          : "Non siamo riusciti a creare l’attività. Controlla i dati inseriti.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="platform-create" aria-labelledby="new-salon-title">
      <header>
        <div>
          <span>Nuovo tenant</span>
          <h2 id="new-salon-title">Registra un’attività</h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Chiudi configurazione"
        >
          <AppIcon name="close" />
        </button>
      </header>
      <form onSubmit={submit}>
        <fieldset>
          <legend>01 · Identità</legend>
          <div className="field">
            <label htmlFor="new-name">Nome attività</label>
            <input
              id="new-name"
              value={nome}
              onChange={(event) => updateName(event.target.value)}
              placeholder="Es. Studio Forma"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-type">Tipologia</label>
            <select
              id="new-type"
              value={tipo}
              onChange={(event) => setTipo(event.target.value as SalonType)}
            >
              <option value="barberia">Barberia</option>
              <option value="parrucchieria">Parrucchieria</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-id">Identificativo</label>
            <input
              id="new-id"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              value={salonId}
              onChange={(event) => setSalonId(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-domain">Dominio</label>
            <input
              id="new-domain"
              value={dominio}
              onChange={(event) => setDominio(event.target.value)}
              required
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>02 · Titolare</legend>
          <div className="field">
            <label htmlFor="new-owner">Nome e cognome</label>
            <input
              id="new-owner"
              value={ownerNome}
              onChange={(event) => setOwnerNome(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-email">Email di accesso</label>
            <input
              id="new-email"
              type="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-password">Password iniziale</label>
            <input
              id="new-password"
              type="password"
              minLength={8}
              value={ownerPassword}
              onChange={(event) => setOwnerPassword(event.target.value)}
              required
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>03 · Abbonamento</legend>
          <div className="field">
            <label htmlFor="new-plan">Piano</label>
            <select
              id="new-plan"
              value={piano}
              onChange={(event) => {
                const nextPlan = event.target.value as LicensePlan;
                setPiano(nextPlan);
                setPrezzo(String(plans.piani[nextPlan].prezzoMensile / 100));
              }}
            >
              {PLAN_KEYS.map((key) => <option value={key} key={key}>{plans.piani[key].nome}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-cycle">Fatturazione</label>
            <select id="new-cycle" value={ciclo} onChange={(event) => setCiclo(event.target.value as BillingCycle)}>
              <option value="mensile">Mensile</option>
              <option value="annuale">Annuale</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-status">Stato</label>
            <select
              id="new-status"
              value={stato}
              onChange={(event) =>
                setStato(event.target.value as LicenseStatus)
              }
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="new-expiry">Scadenza</label>
            <input
              id="new-expiry"
              type="date"
              value={scadenza}
              onChange={(event) => setScadenza(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="new-price">Canone mensile (€)</label>
            <input
              id="new-price"
              type="number"
              min="0"
              value={prezzo}
              onChange={(event) => setPrezzo(event.target.value)}
              required
            />
          </div>
        </fieldset>
        {error && (
          <p className="platform-form-error" role="alert">
            {error}
          </p>
        )}
        <footer>
          <p>
            Palette e asset grafici si configurano subito dopo dalla scheda
            dell’attività.
          </p>
          <button className="platform-button" type="submit" disabled={busy}>
            {busy ? "Creazione…" : "Crea attività e accesso"}
          </button>
        </footer>
      </form>
    </section>
  );
}

function LicenseEditor({
  salon,
  plans,
  onSaved,
}: {
  salon: PlatformSalon;
  plans: SubscriptionPlansConfig;
  onSaved: () => void;
}) {
  const [stato, setStato] = useState<LicenseStatus>(salon.licenza.stato);
  const [piano, setPiano] = useState<LicensePlan>(salon.licenza.piano);
  const [scadenza, setScadenza] = useState(salon.licenza.scadenza);
  const [prezzo, setPrezzo] = useState(
    (salon.licenza.prezzoMensile / 100).toFixed(0),
  );
  const [ciclo, setCiclo] = useState<BillingCycle>(salon.licenza.ciclo ?? "mensile");
  const [statoPagamento, setStatoPagamento] = useState<PaymentStatus>(salon.licenza.statoPagamento ?? "pagato");
  const [rinnovoAutomatico, setRinnovoAutomatico] = useState(salon.licenza.rinnovoAutomatico ?? true);
  const [note, setNote] = useState(salon.licenza.note ?? "");
  const [featureOverrides, setFeatureOverrides] = useState<Partial<Record<SubscriptionFeatureKey, boolean>>>(salon.licenza.funzionalitaPersonalizzate ?? {});
  const [temporaryFeatures, setTemporaryFeatures] = useState<TemporaryFeatureAccess[]>(salon.licenza.funzionalitaTemporanee ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updatePlatformSalonLicense({
        salonId: salon.id,
        stato,
        piano,
        scadenza,
        prezzoMensile: Math.round(Number(prezzo) * 100),
        ciclo,
        statoPagamento,
        rinnovoAutomatico,
        note,
        funzionalitaPersonalizzate: featureOverrides,
        funzionalitaTemporanee: temporaryFeatures,
      });
      onSaved();
    } catch {
      setError("Non siamo riusciti ad aggiornare la licenza.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="license-editor" onSubmit={submit} id="licenze">
      <header className="license-editor__header">
        <div><span>Contratto e fatturazione</span><h3>Gestisci abbonamento</h3></div>
        <span className={`payment-status is-${statoPagamento}`}>{PAYMENT_LABELS[statoPagamento]}</span>
      </header>
      <div className="field">
        <label htmlFor={`plan-${salon.id}`}>Piano</label>
        <select
          id={`plan-${salon.id}`}
          value={piano}
          onChange={(event) => {
            const nextPlan = event.target.value as LicensePlan;
            setPiano(nextPlan);
            setPrezzo(String(plans.piani[nextPlan].prezzoMensile / 100));
          }}
        >
          {PLAN_KEYS.map((key) => <option value={key} key={key}>{plans.piani[key].nome}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`cycle-${salon.id}`}>Fatturazione</label>
        <select id={`cycle-${salon.id}`} value={ciclo} onChange={(event) => setCiclo(event.target.value as BillingCycle)}>
          <option value="mensile">Mensile</option>
          <option value="annuale">Annuale</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor={`payment-${salon.id}`}>Stato pagamento</label>
        <select id={`payment-${salon.id}`} value={statoPagamento} onChange={(event) => setStatoPagamento(event.target.value as PaymentStatus)}>
          {Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`status-${salon.id}`}>Stato</label>
        <select
          id={`status-${salon.id}`}
          value={stato}
          onChange={(event) => setStato(event.target.value as LicenseStatus)}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <label className="license-editor__switch">
        <input type="checkbox" checked={rinnovoAutomatico} onChange={(event) => setRinnovoAutomatico(event.target.checked)} />
        <span>Rinnovo automatico</span>
        <small>{rinnovoAutomatico ? "Il contratto prosegue alla scadenza" : "Richiede rinnovo manuale"}</small>
      </label>
      <div className="field license-editor__notes">
        <label htmlFor={`notes-${salon.id}`}>Note interne</label>
        <textarea id={`notes-${salon.id}`} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Accordi commerciali, condizioni o promemoria…" />
      </div>
      <aside className="license-plan-summary">
        <span>Piano di partenza</span>
        <strong>{plans.piani[piano].nome}</strong>
        <p>{plans.piani[piano].descrizione}</p>
        <ul>{plans.piani[piano].funzionalita.map((featureKey) => <li key={featureKey}><AppIcon name="check" size={14} />{FEATURE_CATALOG.find((feature) => feature.key === featureKey)?.label ?? featureKey}</li>)}</ul>
      </aside>
      <div className="field">
        <label htmlFor={`expiry-${salon.id}`}>Scadenza</label>
        <input
          id={`expiry-${salon.id}`}
          type="date"
          value={scadenza}
          onChange={(event) => setScadenza(event.target.value)}
          required
        />
      </div>
      <section className="tenant-entitlements">
        <header><div><span>Piano personalizzato</span><h4>Accessi e prove temporanee</h4></div><p>Lascia “Da piano” per seguire il catalogo. Puoi sbloccare una funzione stabilmente o concederla in prova fino a una data.</p></header>
        <div className="tenant-entitlements__list">
          {FEATURE_CATALOG.map((feature) => {
            const baseEnabled = plans.piani[piano].funzionalita.includes(feature.key);
            const override = featureOverrides[feature.key];
            const temporary = temporaryFeatures.find((item) => item.funzione === feature.key);
            const activeTrial = Boolean(temporary?.scadeIl && temporary.scadeIl >= new Date().toISOString().slice(0, 10));
            const effective = activeTrial || (override ?? baseEnabled);
            return <article key={feature.key} className={effective ? "is-enabled" : ""}>
              <div><span><AppIcon name={effective ? "check" : "close"} size={15} /></span><p><strong>{feature.label}</strong><small>{feature.detail}</small></p></div>
              <label>Accesso<select aria-label={`Accesso ${feature.label}`} value={override === undefined ? "inherit" : override ? "enabled" : "disabled"} onChange={(event) => {
                const value = event.target.value;
                setFeatureOverrides((current) => {
                  const next = { ...current };
                  if (value === "inherit") delete next[feature.key];
                  else next[feature.key] = value === "enabled";
                  return next;
                });
              }}><option value="inherit">Da piano ({baseEnabled ? "inclusa" : "non inclusa"})</option><option value="enabled">Sempre attiva</option><option value="disabled">Disattivata</option></select></label>
              <label>Prova fino al<input aria-label={`Prova ${feature.label}`} type="date" value={temporary?.scadeIl ?? ""} onChange={(event) => setTemporaryFeatures((current) => {
                const without = current.filter((item) => item.funzione !== feature.key);
                return event.target.value ? [...without, { funzione: feature.key, scadeIl: event.target.value }] : without;
              })} /></label>
              <small className="tenant-entitlements__result">{activeTrial ? `In prova fino al ${temporary?.scadeIl}` : effective ? "Accesso attivo" : "Non disponibile"}</small>
            </article>;
          })}
        </div>
      </section>
      <div className="field">
        <label htmlFor={`price-${salon.id}`}>Canone mensile (€)</label>
        <input
          id={`price-${salon.id}`}
          type="number"
          min="0"
          value={prezzo}
          onChange={(event) => setPrezzo(event.target.value)}
          required
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="license-editor__actions">
        <button className="platform-button" type="submit" disabled={busy}>
          {busy ? "Salvataggio…" : "Salva licenza"}
        </button>
      </div>
    </form>
  );
}

function SalonAccessStudio({
  salon,
  onSaved,
}: {
  salon: PlatformSalon;
  onSaved: () => void;
}) {
  const [code, setCode] = useState(salon.codiceAccesso ?? "");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const accessUrl = code ? `${window.location.origin}/salone/${code}` : "";

  useEffect(() => {
    if (!accessUrl) {
      setQr("");
      return;
    }
    void QRCode.toDataURL(accessUrl, {
      width: 440,
      margin: 1,
      color: { dark: "#18211b", light: "#ffffff" },
    }).then(setQr);
  }, [accessUrl]);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const value = await ensurePlatformSalonAccessCode(salon.id);
      setCode(value);
      onSaved();
    } catch {
      setError("Non siamo riusciti a generare il codice del salone.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(accessUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="salon-access-studio">
      <div className="salon-access-studio__copy">
        <span>App cliente</span>
        <h3>Codice e QR del salone</h3>
        <p>
          Condividi uno dei due. Il cliente entra direttamente nell’esperienza
          di {salon.nome}, senza vedere le altre attività della piattaforma.
        </p>
        {code ? (
          <>
            <div className="salon-access-studio__code">
              <small>CODICE SALONE</small>
              <strong>{code}</strong>
            </div>
            <div className="salon-access-studio__actions">
              <button
                className="platform-button"
                type="button"
                onClick={() => void copy()}
              >
                {copied ? "Link copiato" : "Copia link cliente"}
              </button>
              <a href={accessUrl} target="_blank" rel="noreferrer">
                Apri anteprima <AppIcon name="arrow" size={16} />
              </a>
            </div>
          </>
        ) : (
          <button
            className="platform-button"
            type="button"
            disabled={busy}
            onClick={() => void generate()}
          >
            {busy ? "Generazione…" : "Genera codice e QR"}
          </button>
        )}
        {error && (
          <p className="platform-form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="salon-access-studio__qr">
        {qr ? (
          <img src={qr} alt={`QR per accedere a ${salon.nome}`} />
        ) : (
          <AppIcon name="scan" size={42} />
        )}
        <small>
          {code
            ? "Pronto per vetrofania, desk e social"
            : "QR non ancora attivo"}
        </small>
      </div>
    </section>
  );
}

function BrandEditor({
  salon,
  onSaved,
}: {
  salon: PlatformSalon;
  onSaved: () => void;
}) {
  const defaults = salon.branding ?? DEFAULT_BRANDING[salon.tipo];
  const [branding, setBranding] = useState<SalonBranding>(defaults);
  const [files, setFiles] = useState<Partial<Record<BrandAssetSlot, File>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fields: Array<{ slot: BrandAssetSlot; label: string }> = [
    { slot: "logo", label: "Logo" },
    { slot: "heroImage", label: "Immagine principale" },
    { slot: "treatmentImage", label: "Immagine trattamento" },
    { slot: "productsImage", label: "Immagine prodotti" },
  ];
  const previewStyle = {
    "--preview-bg": branding.backgroundColor,
    "--preview-fg": branding.foregroundColor,
    "--preview-accent": branding.accentColor,
  } as CSSProperties;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next: SalonBranding = { ...branding };
      for (const [slot, file] of Object.entries(files) as Array<
        [BrandAssetSlot, File]
      >) {
        const uploaded = await uploadPlatformBrandAsset(salon.id, slot, file);
        Object.assign(next, {
          [`${slot}Url`]: uploaded.url,
          [`${slot}Path`]: uploaded.path,
        });
      }
      await updatePlatformSalonBranding({ salonId: salon.id, ...next });
      setBranding(next);
      setFiles({});
      setSaved(true);
      onSaved();
    } catch {
      setError("Non siamo riusciti a salvare l’identità grafica.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="brand-editor" onSubmit={submit}>
      <div className="brand-editor__controls">
        <header>
          <span>White-label studio</span>
          <h3>Identità grafica</h3>
          <p>
            Le scelte vengono applicate all’app cliente e alla dashboard del
            titolare.
          </p>
        </header>
        <div className="brand-colors">
          {(
            [
              ["backgroundColor", "Sfondo"],
              ["foregroundColor", "Testo"],
              ["accentColor", "Accento"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              <span>{label}</span>
              <input
                aria-label={label}
                type="color"
                value={branding[key]}
                onChange={(event) =>
                  setBranding({ ...branding, [key]: event.target.value })
                }
              />
              <code>{branding[key]}</code>
            </label>
          ))}
        </div>
        <div className="brand-assets">
          {fields.map(({ slot, label }) => {
            const urlKey = `${slot}Url` as keyof SalonBranding;
            return (
              <label key={slot}>
                <span>{label}</span>
                <small>
                  {files[slot]?.name ||
                    (branding[urlKey]
                      ? "Asset configurato"
                      : "Usa immagine predefinita")}
                </small>
                <input
                  aria-label={label}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file)
                      setFiles((current) => ({ ...current, [slot]: file }));
                  }}
                />
              </label>
            );
          })}
        </div>
        {error && (
          <p className="platform-form-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="platform-form-success">Identità grafica aggiornata.</p>
        )}
        <button className="platform-button" type="submit" disabled={busy}>
          {busy ? "Caricamento e salvataggio…" : "Pubblica identità"}
        </button>
      </div>
      <aside className="brand-preview" style={previewStyle}>
        <div className="brand-preview__phone">
          <header>
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="" />
            ) : (
              <b>{salon.nome.slice(0, 1)}</b>
            )}
            <span>{salon.nome}</span>
          </header>
          <div
            className="brand-preview__hero"
            style={
              branding.heroImageUrl
                ? { backgroundImage: `url(${branding.heroImageUrl})` }
                : undefined
            }
          >
            <small>
              {salon.tipo === "parrucchieria" ? "HAIR STUDIO" : "BARBER SHOP"}
            </small>
            <strong>
              Il tuo stile,
              <br />
              il tuo spazio.
            </strong>
          </div>
          <button type="button">Prenota ora</button>
          <footer>
            <i />
            <i />
            <i />
          </footer>
        </div>
        <p>Anteprima palette · app cliente</p>
      </aside>
    </form>
  );
}

export function PlatformDashboardPage() {
  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_PLANS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"tutte" | LicenseStatus>("tutte");
  const [plan, setPlan] = useState<"tutti" | LicensePlan>("tutti");
  const [attention, setAttention] = useState<"tutte" | "trial" | "rinnovi" | "rischio">("tutte");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  async function reload(initial = false) {
    if (!initial) {
      setLoading(true);
      setError(null);
    }
    try {
      const [nextSalons, nextPlans] = await Promise.all([
        listPlatformSalons(),
        getSubscriptionPlansConfig(),
      ]);
      setSalons(nextSalons);
      setPlans(nextPlans);
    } catch {
      setError("Non siamo riusciti a caricare i dati della piattaforma.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload(true);
  }, []);
  const [referenceDate] = useState(() => new Date());
  const today = referenceDate.toISOString().slice(0, 10);
  const inThirtyDays = new Date(referenceDate.getTime() + 30 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const active = salons.filter((salon) => salon.licenza.stato === "attiva");
  const mrr = active.reduce(
    (sum, salon) => sum + salon.licenza.prezzoMensile,
    0,
  );
  const expiring = salons.filter(
    (salon) =>
      salon.licenza.scadenza >= today && salon.licenza.scadenza <= inThirtyDays,
  ).length;
  const overdue = salons.filter((salon) =>
    salon.licenza.statoPagamento === "insoluto" ||
    (salon.licenza.scadenza && salon.licenza.scadenza < today && salon.licenza.stato !== "sospesa"),
  );
  const trials = salons.filter((salon) => salon.licenza.stato === "trial");
  const bookings = salons.reduce(
    (sum, salon) => sum + salon.prenotazioni30g,
    0,
  );
  const filtered = salons.filter(
    (salon) =>
      `${salon.nome} ${salon.dominio} ${salon.owner?.email ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "tutte" || salon.licenza.stato === status),
  ).filter(
    (salon) => plan === "tutti" || salon.licenza.piano === plan,
  ).filter((salon) => {
    if (attention === "trial") return salon.licenza.stato === "trial";
    if (attention === "rinnovi") return salon.licenza.scadenza >= today && salon.licenza.scadenza <= inThirtyDays;
    if (attention === "rischio") return salon.licenza.statoPagamento === "insoluto" || (salon.licenza.scadenza && salon.licenza.scadenza < today && salon.licenza.stato !== "sospesa");
    return true;
  });
  return (
    <section className="platform-dashboard">
      <header className="platform-title">
        <div>
          <span>Niche · Controllo abbonamenti</span>
          <h1>
            La rete cresce,
            <br />
            sotto controllo.
          </h1>
        </div>
        <div>
          <p>
            Attività, contratti, rinnovi e identità white-label in una console
            operativa costruita per Niche.
          </p>
          <div className="platform-title__actions">
            <button className="platform-catalog-button" type="button" onClick={() => setCatalogOpen(!catalogOpen)}><AppIcon name="key" size={18} />{catalogOpen ? "Chiudi piani" : "Configura piani"}</button>
            <button className="platform-add" type="button" onClick={() => setCreating(!creating)}><AppIcon name={creating ? "close" : "plus"} />{creating ? "Chiudi" : "Nuova attività"}</button>
          </div>
        </div>
      </header>
      {catalogOpen && <PlanCatalogEditor config={plans} onClose={() => setCatalogOpen(false)} onSaved={setPlans} />}
      {creating && (
        <CreateSalonPanel
          plans={plans}
          onCancel={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}
      <section className="platform-hero" aria-label="Riepilogo economico">
        <div>
          <span>Ricavo mensile ricorrente</span>
          <strong>{money(mrr)}</strong>
          <p>{active.length} abbonamenti attivi · {trials.length} in prova</p>
        </div>
        <div className="platform-hero__signal">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <span>Ultimi 6 mesi</span>
        </div>
        <dl>
          <div>
            <dt>Prenotazioni / 30g</dt>
            <dd>{bookings}</dd>
          </div>
          <div>
            <dt>Scadenze / 30g</dt>
            <dd>{expiring}</dd>
          </div>
          <div>
            <dt>ARPA mensile</dt>
            <dd>
              {money(active.length ? Math.round(mrr / active.length) : 0)}
            </dd>
          </div>
        </dl>
      </section>
      <section className="subscription-command" id="abbonamenti" aria-label="Controllo abbonamenti">
        <div className="subscription-command__intro">
          <span>Priorità commerciali</span>
          <h2>Abbonamenti da seguire</h2>
          <p>Rinnovi, prove e pagamenti che richiedono un’azione prima di diventare criticità.</p>
        </div>
        <div className="subscription-command__queue">
          <button type="button" onClick={() => { setAttention("trial"); setStatus("tutte"); }}>
            <span className="is-warm"><AppIcon name="clock" size={18} /></span>
            <strong>{trials.length}</strong><small>prove aperte</small>
            <AppIcon name="arrow" size={17} />
          </button>
          <button type="button" onClick={() => { setAttention("rinnovi"); setStatus("tutte"); }}>
            <span className="is-blue"><AppIcon name="calendar" size={18} /></span>
            <strong>{expiring}</strong><small>rinnovi entro 30 giorni</small>
            <AppIcon name="arrow" size={17} />
          </button>
          <button type="button" onClick={() => { setAttention("rischio"); setStatus("tutte"); }}>
            <span className="is-red"><AppIcon name="card" size={18} /></span>
            <strong>{overdue.length}</strong><small>posizioni da verificare</small>
            <AppIcon name="arrow" size={17} />
          </button>
        </div>
        <div className="subscription-plans">
          {PLAN_KEYS.map((key) => {
            const item = plans.piani[key];
            const count = salons.filter((salon) => salon.licenza.piano === key).length;
            const percentage = salons.length ? Math.round((count / salons.length) * 100) : 0;
            return <button type="button" key={key} onClick={() => { setPlan(key); setAttention("tutte"); }}>
              <div><span>{item.nome}</span><b>{count}</b></div>
              <small>{item.descrizione} · {money(item.prezzoMensile)}</small>
              <i><span style={{ width: `${percentage}%` }} /></i>
            </button>;
          })}
        </div>
      </section>
      <div className="platform-kpis">
        <article>
          <span>
            <AppIcon name="building" size={20} />
          </span>
          <div>
            <small>Attività totali</small>
            <strong>{salons.length}</strong>
            <p>tenant configurati</p>
          </div>
        </article>
        <article>
          <span>
            <AppIcon name="key" size={20} />
          </span>
          <div>
            <small>Licenze attive</small>
            <strong>{active.length}</strong>
            <p>
              {salons.filter((salon) => salon.licenza.stato === "trial").length}{" "}
              ancora in prova
            </p>
          </div>
        </article>
        <article>
          <span>
            <AppIcon name="users" size={20} />
          </span>
          <div>
            <small>Clienti gestiti</small>
            <strong>
              {salons.reduce((sum, salon) => sum + salon.clienti, 0)}
            </strong>
            <p>su tutta la rete</p>
          </div>
        </article>
      </div>
      <section className="platform-salons" id="attivita">
        <header>
          <div>
            <span>Portfolio clienti</span>
            <h2>Attività e abbonamenti</h2>
          </div>
          <div className="platform-filters">
            <input
              aria-label="Cerca salone"
              placeholder="Cerca attività, dominio o titolare"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              aria-label="Filtra per stato"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status);
                setAttention("tutte");
              }}
            >
              <option value="tutte">Tutte le licenze</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select aria-label="Filtra per piano" value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)}>
              <option value="tutti">Tutti i piani</option>
              {PLAN_KEYS.map((key) => <option value={key} key={key}>{plans.piani[key].nome}</option>)}
            </select>
            {attention !== "tutte" && <button className="platform-filter-chip" type="button" onClick={() => setAttention("tutte")}>
              {attention === "trial" ? "Prove aperte" : attention === "rinnovi" ? "Rinnovi entro 30 giorni" : "Posizioni da verificare"} <AppIcon name="close" size={14} />
            </button>}
          </div>
        </header>
        {loading ? (
          <div className="platform-empty">
            Sto raccogliendo i dati delle attività…
          </div>
        ) : error ? (
          <div className="platform-empty is-error" role="alert">
            {error}
            <button type="button" onClick={() => void reload()}>
              Riprova
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="platform-empty">
            Nessuna attività corrisponde alla ricerca.
          </div>
        ) : (
          <div className="platform-salon-list">
            {filtered.map((salon) => (
              <article
                className={`platform-salon${editing === salon.id ? " is-editing" : ""}`}
                key={salon.id}
              >
                <div className="platform-salon__identity">
                  {salon.branding?.logoUrl ? (
                    <img src={salon.branding.logoUrl} alt="" />
                  ) : (
                    <span
                      style={
                        salon.branding
                          ? {
                              background: salon.branding.accentColor,
                              color: salon.branding.foregroundColor,
                            }
                          : undefined
                      }
                    >
                      {salon.nome.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <strong>{salon.nome}</strong>
                    <small>{salon.dominio}</small>
                    <em>
                      {salon.tipo === "parrucchieria"
                        ? "Parrucchieria"
                        : "Barberia"}{" "}
                      · {salon.owner?.nome ?? "Titolare non assegnato"}
                      {salon.owner?.email ? ` · ${salon.owner.email}` : ""}
                    </em>
                  </div>
                </div>
                <div className="platform-salon__numbers">
                  <span>
                    <b>{salon.clienti}</b>Clienti
                  </span>
                  <span>
                    <b>{salon.operatori}</b>Operatori
                  </span>
                  <span>
                    <b>{salon.prenotazioni30g}</b>Prenotazioni
                  </span>
                  <span>
                    <b>{money(salon.fatturato30g)}</b>Volume 30g
                  </span>
                </div>
                <div className="platform-salon__license">
                  <div className="platform-salon__badges"><span className={`license-status is-${salon.licenza.stato}`}>{STATUS_LABELS[salon.licenza.stato]}</span><span className={`payment-status is-${salon.licenza.statoPagamento ?? "pagato"}`}>{PAYMENT_LABELS[salon.licenza.statoPagamento ?? "pagato"]}</span></div>
                  <strong>
                    {plans.piani[salon.licenza.piano].nome} ·{" "}
                    {money(salon.licenza.prezzoMensile)}/mese
                  </strong>
                  <small>{salon.licenza.ciclo === "annuale" ? "Annuale" : "Mensile"} · rinnovo {salon.licenza.scadenza || "—"}</small>
                </div>
                <button
                  className="platform-row-action"
                  type="button"
                  onClick={() =>
                    setEditing(editing === salon.id ? null : salon.id)
                  }
                >
                  {editing === salon.id ? "Chiudi studio" : "Configura"}
                </button>
                {editing === salon.id && (
                  <div className="platform-editor-suite">
                    <SalonAccessStudio
                      salon={salon}
                      onSaved={() => void reload()}
                    />
                    <LicenseEditor
                      salon={salon}
                      plans={plans}
                      onSaved={() => void reload()}
                    />
                    <BrandEditor salon={salon} onSaved={() => void reload()} />
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
