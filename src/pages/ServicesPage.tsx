import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  createService,
  deleteService,
  listServices,
  type ServiceWithId,
} from "../firebase/service-repo";

function euro(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", {
    minimumFractionDigits: 2,
  });
}

export function ServicesPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<ServiceWithId[]>([]);
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [prezzoEuro, setPrezzoEuro] = useState("");
  const [durata, setDurata] = useState("");

  async function reload(id: string) {
    setItems(await listServices(id));
  }

  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!salonId) return;

    await createService(salonId, {
      titolo,
      descrizione,
      prezzo: Math.round(Number.parseFloat(prezzoEuro || "0") * 100),
      durataMin: Number.parseInt(durata || "0", 10),
      attivo: true,
    });
    setTitolo("");
    setDescrizione("");
    setPrezzoEuro("");
    setDurata("");
    await reload(salonId);
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteService(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Servizi</h2>
      {items.map((service) => (
        <div
          className="card row"
          key={service.id}
          style={{ justifyContent: "space-between" }}
        >
          <span>
            <strong>{service.titolo}</strong> · {service.durataMin}′ · € {euro(service.prezzo)}
            {!service.attivo && " (non attivo)"}
          </span>
          <button
            className="btn btn--danger"
            type="button"
            onClick={() => onDelete(service.id)}
          >
            Elimina
          </button>
        </div>
      ))}

      <form className="card" onSubmit={onSubmit}>
        <h3>Nuovo servizio</h3>
        <div className="field">
          <label htmlFor="service-title">Titolo</label>
          <input
            id="service-title"
            value={titolo}
            onChange={(event) => setTitolo(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="service-description">Descrizione</label>
          <textarea
            id="service-description"
            value={descrizione}
            onChange={(event) => setDescrizione(event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="service-price">Prezzo (€)</label>
          <input
            id="service-price"
            type="number"
            min="0"
            step="0.01"
            value={prezzoEuro}
            onChange={(event) => setPrezzoEuro(event.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="service-duration">Durata (min)</label>
          <input
            id="service-duration"
            type="number"
            min="0"
            step="5"
            value={durata}
            onChange={(event) => setDurata(event.target.value)}
            required
          />
        </div>
        <button className="btn" type="submit">
          Aggiungi servizio
        </button>
      </form>
    </section>
  );
}
