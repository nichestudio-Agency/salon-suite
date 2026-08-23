import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { WeeklyHoursEditor } from "../components/WeeklyHoursEditor";
import type { WeeklyHours } from "../domain/availability";
import {
  createOperator,
  deleteOperator,
  listOperators,
  updateOperator,
  type OperatorWithId,
} from "../firebase/operator-repo";

export function OperatorsPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<OperatorWithId[]>([]);
  const [nome, setNome] = useState("");
  const [openHours, setOpenHours] = useState<string | null>(null);

  async function reload(id: string) {
    setItems(await listOperators(id));
  }

  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!salonId) return;

    await createOperator(salonId, { nome, attivo: true });
    setNome("");
    await reload(salonId);
  }

  async function toggleActive(operator: OperatorWithId) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, { attivo: !operator.attivo });
    await reload(salonId);
  }

  async function saveHours(operator: OperatorWithId, hours: WeeklyHours) {
    if (!salonId) return;
    await updateOperator(salonId, operator.id, {
      orariPersonalizzati: hours,
    });
    await reload(salonId);
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteOperator(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Operatori</h2>
      {items.map((operator) => (
        <div className="card" key={operator.id}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>
              {operator.nome}
              {!operator.attivo && " (non attivo)"}
            </strong>
            <div className="row">
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => toggleActive(operator)}
              >
                {operator.attivo ? "Disattiva" : "Attiva"}
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
              <button
                className="btn btn--danger"
                type="button"
                onClick={() => onDelete(operator.id)}
              >
                Elimina
              </button>
            </div>
          </div>

          {openHours === operator.id && (
            <div style={{ marginTop: 10 }}>
              <p style={{ color: "var(--muted)" }}>
                Orari personalizzati (sovrascrivono quelli del salone)
              </p>
              <WeeklyHoursEditor
                value={operator.orariPersonalizzati ?? {}}
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
        <button className="btn" type="submit">
          Aggiungi operatore
        </button>
      </form>
    </section>
  );
}
