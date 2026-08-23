import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatEuro } from "../domain/money";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import { useSalonTenant } from "../app/salon-tenant-context";
import "./customer.css";

export function CustomerServicesPage() {
  const { salon } = useSalonTenant();
  const salonId = salon?.id ?? "";
  const [services, setServices] = useState<ServiceWithId[]>([]);

  useEffect(() => {
    if (!salonId) return;
    void listServices(salonId).then((items) => setServices(items.filter((item) => item.attivo)));
  }, [salonId]);

  return (
    <section className="customer-page">
      <header className="customer-page__header">
        <div><span className="customer-shell__eyebrow">Menu del salone</span><h1>Servizi</h1></div>
        <span className="customer-page__tenant">{salon?.nome}</span>
      </header>
      <p className="customer-page__intro">Consulta trattamenti, durata e prezzo prima di scegliere il tuo appuntamento.</p>
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
    </section>
  );
}

function EmptyState({ text }: { text: string }) { return <div className="customer-empty"><span>—</span><p>{text}</p></div>; }
