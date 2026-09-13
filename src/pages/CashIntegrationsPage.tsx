import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import type {
  CashIntegrationConfig,
  CashIntegrationMode,
} from "../domain/models";
import {
  DEFAULT_CASH_INTEGRATION,
  getCashIntegration,
  listCashActivity,
  saveCashIntegration,
  type CashActivityItem,
} from "../firebase/cash-integration-repo";
import { createTicket } from "../firebase/ticket-repo";

const MODES: Array<{
  id: CashIntegrationMode;
  title: string;
  label: string;
  copy: string;
}> = [
  {
    id: "manuale",
    label: "Disponibile ora",
    title: "Cassa manuale",
    copy: "Lo staff conferma servizio e importo dalla dashboard dopo il pagamento in negozio.",
  },
  {
    id: "api_webhook",
    label: "Integrazione tecnica",
    title: "API / Webhook",
    copy: "La cassa invia a Salon Suite le ricevute concluse attraverso un collegamento server-to-server.",
  },
  {
    id: "gestionale",
    label: "Su verifica",
    title: "Gestionale partner",
    copy: "Collegamento dedicato al software o registratore già utilizzato dal punto vendita.",
  },
];

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}

export function CashIntegrationsPage() {
  const { salonId, user } = useAuth();
  const { salon } = useSalonTenant();
  const [config, setConfig] = useState<CashIntegrationConfig>(
    DEFAULT_CASH_INTEGRATION,
  );
  const [activity, setActivity] = useState<CashActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salonId) return;
    Promise.all([getCashIntegration(salonId), listCashActivity(salonId)])
      .then(([next, rows]) => {
        setConfig(next);
        setActivity(rows);
      })
      .catch(() =>
        setError(
          "Non siamo riusciti a caricare la configurazione della cassa.",
        ),
      )
      .finally(() => setLoading(false));
  }, [salonId]);

  function chooseMode(mode: CashIntegrationMode) {
    setNotice(null);
    setConfig((current) => ({
      ...current,
      mode,
      status:
        mode === "manuale"
          ? "operativa"
          : current.status === "operativa"
            ? "da_configurare"
            : current.status,
    }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!salonId) return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await saveCashIntegration(salonId, config);
      setNotice("Configurazione salvata.");
    } catch {
      setError("Non è stato possibile salvare la configurazione.");
    } finally {
      setSaving(false);
    }
  }

  async function requestConnection() {
    if (!salonId || config.mode === "manuale") return;
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      await createTicket({
        salonId,
        channel: "salone_piattaforma",
        oggetto: `Collegamento cassa · ${config.providerName || config.mode}`,
        categoria: "Integrazione cassa",
        priorita: "normale",
        requesterName: user?.displayName || salon?.nome || "Titolare",
        testo: `Richiedo la verifica del collegamento ${config.mode}. Fornitore: ${config.providerName || "da definire"}. Riferimento punto vendita: ${config.storeReference || "non indicato"}.`,
        allegati: [],
      });
      await saveCashIntegration(salonId, { ...config, status: "richiesta" });
      setConfig((current) => ({ ...current, status: "richiesta" }));
      setNotice(
        "Richiesta inviata. La conversazione è disponibile in Assistenza.",
      );
    } catch {
      setError("Non siamo riusciti a inviare la richiesta tecnica.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <section className="cash-page">
        <div className="cash-loading">
          <i />
          <i />
          <i />
        </div>
      </section>
    );

  const internalTotal = activity.reduce((sum, item) => sum + item.total, 0);
  return (
    <section className="cash-page">
      <header className="dashboard-page-header">
        <div>
          <span>Infrastruttura</span>
          <h2>Cassa e gestionale</h2>
          <p>
            Un solo punto di controllo per vendite, appuntamenti e accrediti
            fidelity.
          </p>
        </div>
        <div className={`cash-connection-state is-${config.status}`}>
          <i />
          <span>
            <small>Stato</small>
            <strong>
              {config.status === "operativa"
                ? "Operativa"
                : config.status === "richiesta"
                  ? "Verifica richiesta"
                  : "Da configurare"}
            </strong>
          </span>
        </div>
      </header>

      <section className="cash-overview">
        <div>
          <span>MODELLO ATTIVO</span>
          <strong>
            {MODES.find((item) => item.id === config.mode)?.title}
          </strong>
          <p>
            Nessun dato fiscale o credenziale della cassa viene salvato nel
            browser.
          </p>
        </div>
        <dl>
          <div>
            <dt>Movimenti recenti</dt>
            <dd>{activity.length}</dd>
          </div>
          <div>
            <dt>Valore registrato</dt>
            <dd>{euro(internalTotal)}</dd>
          </div>
          <div>
            <dt>Origine esterna</dt>
            <dd>
              {activity.filter((item) => item.source === "external").length}
            </dd>
          </div>
        </dl>
      </section>

      <form className="cash-workspace" onSubmit={save}>
        <section className="cash-config">
          <header>
            <span>01 / Modalità</span>
            <h3>Come vuoi registrare gli incassi?</h3>
            <p>
              Puoi iniziare manualmente e passare a un connettore senza perdere
              lo storico.
            </p>
          </header>
          <div className="cash-mode-list">
            {MODES.map((mode) => (
              <button
                className={config.mode === mode.id ? "is-active" : ""}
                type="button"
                onClick={() => chooseMode(mode.id)}
                key={mode.id}
              >
                <span>
                  <small>{mode.label}</small>
                  <strong>{mode.title}</strong>
                  <p>{mode.copy}</p>
                </span>
                <i>
                  {config.mode === mode.id && (
                    <AppIcon name="check" size={17} />
                  )}
                </i>
              </button>
            ))}
          </div>
        </section>

        <section className="cash-settings">
          <header>
            <span>02 / Configurazione</span>
            <h3>
              {config.mode === "manuale"
                ? "Flusso interno"
                : "Dati del collegamento"}
            </h3>
          </header>
          {config.mode !== "manuale" && (
            <div className="cash-fields">
              <label>
                Produttore o gestionale
                <input
                  value={config.providerName}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      providerName: event.target.value,
                    }))
                  }
                  placeholder="Es. nome del software di cassa"
                />
              </label>
              <label>
                Riferimento punto vendita
                <input
                  value={config.storeReference}
                  onChange={(event) =>
                    setConfig((current) => ({
                      ...current,
                      storeReference: event.target.value,
                    }))
                  }
                  placeholder="ID negozio o numero terminale"
                />
              </label>
            </div>
          )}
          <div className="cash-switches">
            <label>
              <input
                type="checkbox"
                checked={config.closeBookingsFromReceipts}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    closeBookingsFromReceipts: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Chiudi appuntamenti</strong>
                <small>
                  Abbina lo scontrino e segna il servizio come completato.
                </small>
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={config.creditLoyaltyFromReceipts}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    creditLoyaltyFromReceipts: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Accredita fidelity</strong>
                <small>Calcola i punti solo dopo una vendita confermata.</small>
              </span>
            </label>
            <label className={config.mode === "manuale" ? "is-disabled" : ""}>
              <input
                type="checkbox"
                checked={config.syncProductCatalog}
                disabled={config.mode === "manuale"}
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    syncProductCatalog: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Sincronizza prodotti</strong>
                <small>
                  {config.mode === "manuale"
                    ? "Disponibile quando viene attivato un connettore esterno."
                    : "Allinea codici e prezzi quando il fornitore lo consente."}
                </small>
              </span>
            </label>
          </div>
          <div className="cash-actions">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Salvataggio…" : "Salva configurazione"}
            </button>
            {config.mode !== "manuale" && (
              <button
                className="btn btn--ghost"
                type="button"
                disabled={saving || config.status === "richiesta"}
                onClick={() => void requestConnection()}
              >
                {config.status === "richiesta"
                  ? "Richiesta già inviata"
                  : "Richiedi verifica tecnica"}
              </button>
            )}
          </div>
          {(notice || error) && (
            <p
              className={`cash-message${error ? " is-error" : ""}`}
              role={error ? "alert" : "status"}
            >
              {error ?? notice}
            </p>
          )}
        </section>
      </form>

      <section className="cash-ledger">
        <header>
          <div>
            <span>03 / Registro</span>
            <h3>Ultimi incassi</h3>
          </div>
          <small>
            Il registro interno resta la fonte unica anche quando collegheremo
            una cassa.
          </small>
        </header>
        <div>
          {activity.length ? (
            activity.map((item) => (
              <article key={item.id}>
                <time>{item.date}</time>
                <div>
                  <strong>{item.customer}</strong>
                  <small>
                    {item.externalReceiptId
                      ? `Ricevuta ${item.externalReceiptId}`
                      : "Registrazione Salon Suite"}
                  </small>
                </div>
                <span className={`is-${item.source}`}>
                  {item.source === "external" ? "Cassa esterna" : "Interna"}
                </span>
                <b>{euro(item.total)}</b>
              </article>
            ))
          ) : (
            <div className="cash-ledger__empty">
              <AppIcon name="orders" />
              <strong>Nessun incasso registrato</strong>
              <p>Le vendite concluse dall’agenda compariranno qui.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="cash-safety">
        <AppIcon name="key" />
        <div>
          <strong>Cosa serve per un collegamento reale</strong>
          <p>
            Documentazione API del produttore, ambiente di prova, identificativo
            del negozio e credenziali server. Le funzioni fiscali restano
            gestite dal dispositivo o dal software certificato del fornitore.
          </p>
        </div>
      </aside>
    </section>
  );
}
