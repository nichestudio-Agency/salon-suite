import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { WeeklyHoursEditor } from "../components/WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";
import type { OperatorUnavailability } from "../domain/models";
import { getSalon } from "../firebase/salon-repo";
import {
  createOperator,
  deleteOperator,
  listOperators,
  resetOperatorHours,
  updateOperator,
  uploadOperatorPhoto,
  type OperatorWithId,
} from "../firebase/operator-repo";

export function OperatorsPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<OperatorWithId[]>([]);
  const [nome, setNome] = useState("");
  const [newPhoto, setNewPhoto] = useState<File | null>(null);
  const [openHours, setOpenHours] = useState<string | null>(null);
  const [openAvailability, setOpenAvailability] = useState<string | null>(null);
  const [unavailableFrom, setUnavailableFrom] = useState("");
  const [unavailableTo, setUnavailableTo] = useState("");
  const [unavailableReason, setUnavailableReason] = useState("");
  const [storeHours, setStoreHours] = useState<WeeklyHours>({});
  const [busy, setBusy] = useState(false);

  async function reload(id: string) {
    setItems(await listOperators(id));
  }

  useEffect(() => {
    if (salonId) {
      void reload(salonId);
      void getSalon(salonId).then((salon) => setStoreHours(salon?.orariApertura ?? {}));
    }
  }, [salonId]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!salonId) return;

    setBusy(true);
    try {
      const id = await createOperator(salonId, { nome, attivo: true });
      if (newPhoto) {
        const photo = await uploadOperatorPhoto(salonId, id, newPhoto, newPhoto.name);
        await updateOperator(salonId, id, photo);
      }
      setNome("");
      setNewPhoto(null);
      await reload(salonId);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(operator: OperatorWithId) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, { attivo: !operator.attivo });
    await reload(salonId);
  }

  function openUnavailability(operatorId: string) {
    const today = new Date().toISOString().slice(0, 10);
    setOpenAvailability(openAvailability === operatorId ? null : operatorId);
    setUnavailableFrom(today);
    setUnavailableTo(today);
    setUnavailableReason("");
  }

  async function addUnavailability(event: FormEvent, operator: OperatorWithId) {
    event.preventDefault();
    if (!salonId || !unavailableFrom || !unavailableTo || unavailableTo < unavailableFrom) return;
    const period: OperatorUnavailability = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dal: unavailableFrom,
      al: unavailableTo,
      ...(unavailableReason.trim() ? { motivo: unavailableReason.trim() } : {}),
    };
    await updateOperator(salonId, operator.id, {
      indisponibilita: [...(operator.indisponibilita ?? []), period],
    });
    setOpenAvailability(null);
    await reload(salonId);
  }

  async function removeUnavailability(operator: OperatorWithId, periodId: string) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, {
      indisponibilita: (operator.indisponibilita ?? []).filter((period) => period.id !== periodId),
    });
    await reload(salonId);
  }

  async function saveHours(operator: OperatorWithId, hours: WeeklyHours) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, {
      orariPersonalizzati: hours,
    });
    await reload(salonId);
  }

  async function resetToStoreHours(operator: OperatorWithId) {
    if (!salonId) return;
    await resetOperatorHours(salonId, operator.id);
    await reload(salonId);
  }

  async function updatePhoto(operator: OperatorWithId, file: File | undefined) {
    if (!salonId || !file) return;
    const photo = await uploadOperatorPhoto(salonId, operator.id, file, file.name);
    await updateOperator(salonId, operator.id, photo);
    await reload(salonId);
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteOperator(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <div className="dashboard-page-header"><div><span>Team</span><h2>Operatori</h2><p>Profili, disponibilità e periodi di assenza.</p></div></div>
      {items.map((operator) => (
        <div className={`card operator-admin-card ${operator.attivo ? "" : "is-inactive"}`} key={operator.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="operator-admin-card__identity">
              {operator.fotoUrl ? <img src={operator.fotoUrl} alt={`Foto di ${operator.nome}`} /> : <span>{operator.nome.slice(0, 1)}</span>}
              <div><strong>{operator.nome}</strong><small>{operator.attivo ? "Disponibile" : "Non disponibile"}</small></div>
            </div>
            <div className="row">
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => operator.attivo ? openUnavailability(operator.id) : void toggleActive(operator)}
              >
                {operator.attivo ? "Rendi indisponibile" : "Rendi disponibile"}
              </button>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() =>
                  setOpenHours(openHours === operator.id ? null : operator.id)
                }
              >
                Orari
              </button>
              <label className="btn btn--ghost operator-photo-button">Foto<input type="file" accept="image/*" aria-label={`Aggiorna foto di ${operator.nome}`} onChange={(event) => void updatePhoto(operator, event.target.files?.[0])} /></label>
              <button
                className="btn btn--danger"
                type="button"
                onClick={() => onDelete(operator.id)}
              >
                Elimina
              </button>
            </div>
          </div>

          {(operator.indisponibilita?.length ?? 0) > 0 && (
            <div className="operator-unavailability-list">
              {operator.indisponibilita!.map((period) => (
                <div key={period.id}>
                  <span><strong>{period.dal === period.al ? period.dal : `${period.dal} → ${period.al}`}</strong>{period.motivo && ` · ${period.motivo}`}</span>
                  <button className="btn btn--ghost" type="button" onClick={() => void removeUnavailability(operator, period.id)}>Rendi disponibile</button>
                </div>
              ))}
            </div>
          )}

          {openAvailability === operator.id && (
            <form className="operator-unavailability-panel" onSubmit={(event) => void addUnavailability(event, operator)}>
              <div><span>Programma indisponibilità</span><h3>Scegli il periodo</h3></div>
              <div className="operator-unavailability-fields">
                <div className="field"><label htmlFor={`from-${operator.id}`}>Dal</label><input id={`from-${operator.id}`} type="date" value={unavailableFrom} onChange={(event) => { setUnavailableFrom(event.target.value); if (!unavailableTo || event.target.value > unavailableTo) setUnavailableTo(event.target.value); }} required /></div>
                <div className="field"><label htmlFor={`to-${operator.id}`}>Al</label><input id={`to-${operator.id}`} type="date" min={unavailableFrom} value={unavailableTo} onChange={(event) => setUnavailableTo(event.target.value)} required /></div>
                <div className="field"><label htmlFor={`reason-${operator.id}`}>Motivo (opzionale)</label><input id={`reason-${operator.id}`} value={unavailableReason} onChange={(event) => setUnavailableReason(event.target.value)} placeholder="Ferie, permesso…" /></div>
              </div>
              <div className="row"><button className="btn" type="submit">Programma periodo</button><button className="btn btn--ghost" type="button" onClick={() => setOpenAvailability(null)}>Annulla</button></div>
            </form>
          )}

          {openHours === operator.id && (
            <div className="operator-hours-panel">
              <div className="operator-hours-panel__header"><p>{operator.orariPersonalizzati ? "Orari personalizzati attivi" : "Usa gli orari del punto vendita"}</p>{operator.orariPersonalizzati && <button className="btn btn--ghost" type="button" onClick={() => void resetToStoreHours(operator)}>Ripristina orari del punto vendita</button>}</div>
              <WeeklyHoursEditor
                value={operator.orariPersonalizzati ?? storeHours}
                onChange={(hours) => void saveHours(operator, hours)}
              />
            </div>
          )}
        </div>
      ))}

      <form className="card" onSubmit={onAdd}>
        <h3>Nuovo operatore</h3>
        <div className="field">
          <label htmlFor="operator-name">Nome operatore</label>
          <input
            id="operator-name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            required
          />
        </div>
        <div className="field"><label htmlFor="operator-photo">Foto (opzionale)</label><input id="operator-photo" type="file" accept="image/*" onChange={(event) => setNewPhoto(event.target.files?.[0] ?? null)} /></div>
        <button className="btn" type="submit" disabled={busy}>
          Aggiungi operatore
        </button>
      </form>
    </section>
  );
}
