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
import { listMyBookings, type BookingWithId } from "../firebase/booking";
import { getMyLoyalty } from "../firebase/loyalty-repo";
import "./customer.css";

export function CustomerHomePage() {
  const { salon } = useSalonTenant();
  const { user } = useAuth();
  const salonId = salon?.id ?? "";
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [products, setProducts] = useState<ProductWithId[]>([]);
  const [nextBooking, setNextBooking] = useState<BookingWithId | null>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState<number | null>(null);

  useEffect(() => {
    if (!salonId) return;
    void Promise.all([listServices(salonId), listOperators(salonId), listProducts(salonId)]).then(([nextServices, nextOperators, nextProducts]) => {
      setServices(nextServices.filter((item) => item.attivo).slice(0, 3));
      setOperators(nextOperators.filter((item) => item.attivo).slice(0, 4));
      setProducts(nextProducts.filter((item) => item.attivo).slice(0, 2));
    });
    const now = new Date();
    const today = now.toLocaleDateString("sv-SE");
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    void listMyBookings(salonId).then((items) => setNextBooking(items.find((item) => (item.date > today || (item.date === today && item.endMin > currentMinute)) && ["in_attesa", "confermata"].includes(item.stato)) ?? null)).catch(() => setNextBooking(null));
    void getMyLoyalty(salonId).then((result) => setLoyaltyPoints(result.account?.punti ?? null)).catch(() => setLoyaltyPoints(null));
  }, [salonId]);

  const firstName = user?.displayName?.split(" ")[0];
  const experience = getSalonExperience(salon?.tipo, salon?.branding);
  return (
    <section className="customer-page customer-home">
      <header className="customer-home__welcome">
        <span>{firstName ? `Ciao, ${firstName}` : "Bentornato"}</span>
        <p>Il tuo spazio da {salon?.nome}.</p>
      </header>

      <article className="customer-home-hero">
        <img src={experience.images.editorial} alt={`${experience.professional} al lavoro da ${salon?.nome ?? "salone"}`} />
        <div className="customer-home-hero__shade" />
        <div className="customer-home-hero__copy">
          <span>{salon?.nome}</span>
          <h1>Il tuo stile,<br />al tuo ritmo.</h1>
          <p>{experience.heroDescription}</p>
          <Link to="/prenota">Prenota un appuntamento <AppIcon name="arrow" size={19} /></Link>
        </div>
      </article>

      <section className="customer-home-overview customer-home-overview--personal" aria-label="Riepilogo personale">
        <Link className="customer-overview-card customer-overview-card--appointment" to={nextBooking ? "/appuntamenti" : "/prenota"}>
          <span className="customer-overview-card__icon"><AppIcon name="calendar" /></span>
          <span><small>{nextBooking ? "Prossimo appuntamento" : "La tua agenda"}</small><strong>{nextBooking ? `${new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(new Date(`${nextBooking.date}T12:00:00`))} · ${String(Math.floor(nextBooking.startMin / 60)).padStart(2, "0")}:${String(nextBooking.startMin % 60).padStart(2, "0")}` : "Scegli quando venire"}</strong></span>
          <AppIcon name="arrow" size={18} />
        </Link>
        <Link className="customer-overview-card customer-overview-card--loyalty" to="/fidelity">
          <span className="customer-overview-card__icon"><AppIcon name="gift" /></span>
          <span><small>La tua fidelity</small><strong>{loyaltyPoints === null ? "Attiva la tua card" : `${loyaltyPoints} punti disponibili`}</strong></span>
          <AppIcon name="arrow" size={18} />
        </Link>
      </section>

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
