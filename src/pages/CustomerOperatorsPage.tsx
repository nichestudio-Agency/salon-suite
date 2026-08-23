import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listSalons, type SalonWithId } from "../firebase/salon-repo";
import "./customer.css";

export function CustomerOperatorsPage() {
  const [salons, setSalons] = useState<SalonWithId[]>([]);
  const [salonId, setSalonId] = useState("");
  const [operators, setOperators] = useState<OperatorWithId[]>([]);

  useEffect(() => { void listSalons().then((items) => { setSalons(items); if (items[0]) setSalonId(items[0].id); }); }, []);
  useEffect(() => { if (salonId) void listOperators(salonId).then((items) => setOperators(items.filter((item) => item.attivo))); }, [salonId]);

  return (
    <section className="customer-page">
      <header className="customer-page__header">
        <div><span className="customer-shell__eyebrow">Il team</span><h1>I tuoi barber</h1></div>
        <label className="customer-page__salon"><span>Salone</span><select value={salonId} onChange={(event) => setSalonId(event.target.value)}>{salons.map((salon) => <option key={salon.id} value={salon.id}>{salon.nome}</option>)}</select></label>
      </header>
      <p className="customer-page__intro">Conosci i professionisti del salone e scegli chi si prenderà cura del tuo prossimo look.</p>
      <div className="operator-grid">
        {operators.map((operator, index) => (
          <article className="operator-card" key={operator.id}>
            <span className="operator-card__number">0{index + 1}</span>
            <div className="operator-card__monogram" aria-hidden="true">{operator.nome.slice(0, 1).toUpperCase()}</div>
            <span className="customer-shell__eyebrow">Barber</span>
            <h2>{operator.nome}</h2>
            <p>Taglio, barba e consulenza di stile.</p>
            <Link to="/prenota">Scegli questo barber →</Link>
          </article>
        ))}
        {operators.length === 0 && <div className="customer-empty"><span>—</span><p>Nessun operatore disponibile per questo salone.</p></div>}
      </div>
    </section>
  );
}
