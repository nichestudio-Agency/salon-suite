import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatEuro } from "../domain/money";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import { useSalonTenant } from "../app/salon-tenant-context";
import { getSalonExperience } from "../app/salon-experience";
import { AppIcon } from "../components/AppIcon";
import "./customer.css";

export function CustomerServicesPage() {
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const experience = getSalonExperience(salon?.tipo, salon?.branding);
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salonId) return;
    setLoading(true);
    void listServices(salonId).then((items) => setServices(items.filter((item) => item.attivo))).catch(() => setServices([])).finally(() => setLoading(false));
  }, [salonId]);

  return (
    <section className="customer-page">
      <header className="customer-page__header">
        <div><span className="customer-shell__eyebrow">Listino del salone</span><h1>Servizi / Prezzi</h1></div>
        <span className="customer-page__tenant">{salon?.nome}</span>
      </header>
      <p className="customer-page__intro">{experience.serviceDescription}</p>
      {loading && <div className="customer-list-skeleton" aria-label="Caricamento servizi"><span /><span /><span /></div>}
      <div className="service-list">
        {!loading && services.map((service, index) => (
          <article className="service-row" key={service.id}>
            {service.fotoUrl ? <img className="service-row__image" src={service.fotoUrl} alt={`Servizio ${service.titolo}`} /> : <div className="service-row__image service-row__image--empty" aria-hidden="true"><span>{String(index + 1).padStart(2, "0")}</span></div>}
            <span className="service-row__index">{String(index + 1).padStart(2, "0")}</span>
            <div><h2>{service.titolo}</h2><p>{service.descrizione || "Un servizio curato nei dettagli, pensato per il tuo stile."}</p></div>
            <div className="service-row__meta"><span>{service.durataMin} min</span><strong>€ {formatEuro(service.prezzo)}</strong></div>
            <Link className="customer-button customer-button--secondary" to={`/prenota?servizio=${encodeURIComponent(service.id)}`}>Prenota</Link>
          </article>
        ))}
        {!loading && services.length === 0 && <EmptyState text="Nessun servizio disponibile per questo salone." />}
      </div>
      <aside className="service-editorial-feature">
        <img src={experience.images.treatment} alt={experience.featureAlt} />
        <div><small>Il consiglio del salone</small><span className="service-editorial-feature__line">{experience.featureLine}</span><Link to="/prenota">Scegli e prenota <AppIcon name="arrow" size={20} /></Link></div>
      </aside>
    </section>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="customer-empty"><span>—</span><p>{text}</p></div>; }
