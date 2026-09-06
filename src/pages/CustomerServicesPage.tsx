import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatEuro } from "../domain/money";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import { useSalonTenant } from "../app/salon-tenant-context";
import { getSalonExperience } from "../app/salon-experience";
import "./customer.css";

export function CustomerServicesPage() {
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const experience = getSalonExperience(salon?.tipo, salon?.branding);
  const [services, setServices] = useState<ServiceWithId[]>([]);

  useEffect(() => {
    if (!salonId) return;
    void listServices(salonId).then((items) => setServices(items.filter((item) => item.attivo)));
  }, [salonId]);

  return (
    <section className="customer-page">
      <header className="customer-page__header">
        <div><span className="customer-shell__eyebrow">Listino del salone</span><h1>Servizi / Prezzi</h1></div>
        <span className="customer-page__tenant">{salon?.nome}</span>
      </header>
      <p className="customer-page__intro">{experience.serviceDescription}</p>
      <div className="service-list">
        {services.map((service, index) => (
          <article className="service-row" key={service.id}>
            <span className="service-row__index">{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{service.titolo}</h2><p>{service.descrizione || "Un servizio curato nei dettagli, pensato per il tuo stile."}</p></div>
            <div className="service-row__meta"><span>{service.durataMin} min</span><strong>€ {formatEuro(service.prezzo)}</strong></div>
            <Link className="customer-button customer-button--secondary" to="/prenota">Prenota</Link>
          </article>
        ))}
        {services.length === 0 && <EmptyState text="Nessun servizio disponibile per questo salone." />}
      </div>
      <aside className="service-editorial-feature">
        <img src={experience.images.treatment} alt={experience.featureAlt} />
        <div><span className="service-editorial-feature__line">{experience.featureLine}</span><Link to="/prenota">Scegli e prenota →</Link></div>
      </aside>
    </section>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="customer-empty"><span>—</span><p>{text}</p></div>; }
