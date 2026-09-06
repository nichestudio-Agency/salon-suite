import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import { formatEuro } from "../domain/money";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listProducts, type ProductWithId } from "../firebase/product-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import { getSalonExperience } from "../app/salon-experience";
import "./customer.css";

export function CustomerHomePage() {
  const { salon } = useSalonTenant();
  const { user } = useAuth();
  const salonId = salon?.id ?? "";
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [products, setProducts] = useState<ProductWithId[]>([]);

  useEffect(() => {
    if (!salonId) return;
    void Promise.all([listServices(salonId), listOperators(salonId), listProducts(salonId)]).then(([nextServices, nextOperators, nextProducts]) => {
      setServices(nextServices.filter((item) => item.attivo).slice(0, 3));
      setOperators(nextOperators.filter((item) => item.attivo).slice(0, 4));
      setProducts(nextProducts.filter((item) => item.attivo).slice(0, 2));
    });
  }, [salonId]);

  const firstName = user?.displayName?.split(" ")[0];
  const experience = getSalonExperience(salon?.tipo);
  return (
    <section className="customer-page customer-home">
      <header className="app-page-topbar">
        <div>
          <span className="app-page-topbar__kicker">{firstName ? `Ciao, ${firstName}` : "Bentornato"}</span>
          <strong>{salon?.nome}</strong>
        </div>
        <Link className="round-action" to="/i-miei-ordini" aria-label="I miei ordini"><AppIcon name="bell" /></Link>
      </header>

      <article className="industrial-hero">
        <div className="industrial-wordline"><span>{experience.heroWords[0]}</span><img src={experience.images.products} alt={experience.type === "parrucchieria" ? "Prodotti e strumenti professionali per capelli" : "Strumenti professionali da barbiere"} /><span>{experience.heroWords[1]}</span></div>
        <div className="industrial-mosaic">
          <div className="industrial-mosaic__portrait"><img src={experience.images.editorial} alt={`${experience.professional} al lavoro`} /></div>
          <div className="industrial-mosaic__detail"><img src={experience.images.treatment} alt={experience.featureAlt} /></div>
          <div className="industrial-mosaic__copy"><span>{salon?.nome}</span><p>Un solo salone. {experience.heroDescription}</p></div>
          <Link className="industrial-mosaic__cta" to="/prenota"><span>Prenota ora</span><AppIcon name="arrow" size={34} /></Link>
        </div>
        <div className="industrial-promo"><b>ON</b><strong>Prenota senza attese</strong><span>Scegli servizio, {experience.professional.toLowerCase()} e orario in autonomia.</span></div>
      </article>

      <section className="industrial-section industrial-services-preview">
        <header><span>01 / Listino</span><h2>Servizi <i>&</i> prezzi</h2><Link to="/servizi">Listino completo →</Link></header>
        <div className="industrial-service-list">
          {services.map((service, index) => <Link to="/prenota" key={service.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{service.titolo}</strong><p>{service.descrizione || "Servizio su misura, eseguito con precisione."}</p><data>{service.durataMin} min</data><b>€ {formatEuro(service.prezzo)}</b></Link>)}
        </div>
      </section>

      <section className="industrial-section industrial-team">
        <header><span>02 / Il team</span><h2>Le mani<br />giuste.</h2><Link to="/operatori">Conosci gli {experience.professionals} →</Link></header>
        <div className="industrial-team__gallery">
          <img src={experience.images.editorial} alt="Il team del salone al lavoro" />
          <img src={experience.images.treatment} alt={experience.featureAlt} />
          <Link to="/operatori"><strong>{operators.length || "01"}</strong><span>{experience.teamPromise}</span></Link>
        </div>
      </section>

      {products.length > 0 && <section className="industrial-products"><img src={experience.images.products} alt="Strumenti e prodotti professionali" /><div><span>03 / Shop</span><h2>La cura<br />continua.</h2><p>Prodotti scelti dal salone per mantenere il risultato anche a casa.</p><Link to="/catalogo">Scopri i prodotti <AppIcon name="arrow" size={20} /></Link></div></section>}
    </section>
  );
}
