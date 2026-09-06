import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { useSalonTenant } from "../app/salon-tenant-context";
import { getSalonExperience } from "../app/salon-experience";
import "./customer.css";

export function CustomerOperatorsPage() {
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const experience = getSalonExperience(salon?.tipo, salon?.branding);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);

  useEffect(() => { if (salonId) void listOperators(salonId).then((items) => setOperators(items.filter((item) => item.attivo))); }, [salonId]);

  return (
    <section className="customer-page">
      <header className="customer-page__header">
        <div><span className="customer-shell__eyebrow">Il team</span><h1>{experience.teamHeading}</h1></div>
        <span className="customer-page__tenant">{salon?.nome}</span>
      </header>
      <p className="customer-page__intro">Conosci i professionisti del salone e scegli chi si prenderà cura del tuo prossimo look.</p>
      <div className="operator-grid">
        {operators.map((operator, index) => (
          <article className="operator-card" key={operator.id}>
            <span className="operator-card__number">0{index + 1}</span>
            {operator.fotoUrl ? <img className="operator-card__photo" src={operator.fotoUrl} alt={`Foto di ${operator.nome}`} /> : <div className="operator-card__monogram" aria-hidden="true">{operator.nome.slice(0, 1).toUpperCase()}</div>}
            <span className="customer-shell__eyebrow">{experience.role}</span>
            <h2>{operator.nome}</h2>
            <p>{experience.professionalDescription}</p>
            <Link to="/prenota">Scegli questo {experience.professional.toLowerCase()} →</Link>
          </article>
        ))}
        {operators.length > 0 && operators.length % 2 === 1 && (
          <div className="operator-card operator-card--filler" aria-hidden="true">
            <img src={experience.images.editorial} alt="" />
            <div className="operator-card__filler-copy">
              <span className="customer-shell__eyebrow">{salon?.nome}</span>
              <p>Il tuo prossimo taglio ti aspetta.</p>
            </div>
          </div>
        )}
        {operators.length === 0 && <div className="customer-empty"><span>—</span><p>Nessun operatore disponibile per questo salone.</p></div>}
      </div>
    </section>
  );
}
