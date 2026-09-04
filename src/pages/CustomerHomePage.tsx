import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import { formatEuro } from "../domain/money";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listProducts, type ProductWithId } from "../firebase/product-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import barberEditorial from "../assets/barber-editorial.webp";
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

  return (
    <section className="customer-page customer-home">
      <header className="app-page-topbar">
        <div>
          <span className="app-page-topbar__kicker">{firstName ? `Ciao, ${firstName}` : "Bentornato"}</span>
          <strong>{salon?.nome}</strong>
        </div>
        <Link className="round-action" to="/i-miei-ordini" aria-label="I miei ordini"><AppIcon name="bell" /></Link>
      </header>

      <article className="home-hero">
        <img src={barberEditorial} alt="Barbiere al lavoro" />
        <div className="home-hero__scrim" />
        <div className="home-hero__copy">
          <span>Il tuo salone</span>
          <h1>Il tuo stile,<br />senza attese.</h1>
          <p>Taglio, barba e cura personale nel momento giusto per te.</p>
          <Link className="customer-button" to="/prenota">Prenota ora <AppIcon name="arrow" size={18} /></Link>
        </div>
      </article>

      <div className="home-quick-actions" aria-label="Azioni rapide">
        <Link to="/servizi"><AppIcon name="scissors" /><span>Servizi</span></Link>
        <Link to="/operatori"><AppIcon name="users" /><span>Il team</span></Link>
        <Link to="/prenota"><AppIcon name="calendar" /><span>Disponibilità</span></Link>
        <Link to="/catalogo"><AppIcon name="bag" /><span>Prodotti</span></Link>
      </div>

      <section className="home-section">
        <div className="home-section__heading"><div><span>Scelti dai clienti</span><h2>Servizi più richiesti</h2></div><Link to="/servizi">Vedi tutti</Link></div>
        <div className="service-card-grid">
          {services.map((service, index) => (
            <Link className="service-card" to="/prenota" key={service.id}>
              <div className={`service-card__visual service-card__visual--${index + 1}`}><img src={barberEditorial} alt="" /></div>
              <div className="service-card__body"><strong>{service.titolo}</strong><span><AppIcon name="clock" size={15} /> {service.durataMin} min</span><b>€ {formatEuro(service.prezzo)}</b></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="home-section home-team">
        <div className="home-section__heading"><div><span>Le mani giuste</span><h2>Il team</h2></div><Link to="/operatori">Conosci tutti</Link></div>
        <div className="team-preview">
          {operators.map((operator, index) => (
            <Link to="/operatori" key={operator.id}><span className={`team-avatar team-avatar--${index + 1}`}>{operator.nome.slice(0, 1)}</span><strong>{operator.nome.split(" ")[0]}</strong></Link>
          ))}
        </div>
      </section>

      {products.length > 0 && <section className="home-product-banner"><div><span>Hair care</span><h2>Continua la cura anche a casa.</h2><Link to="/catalogo">Scopri i prodotti <AppIcon name="arrow" size={17} /></Link></div><AppIcon name="spark" size={42} /></section>}
    </section>
  );
}
