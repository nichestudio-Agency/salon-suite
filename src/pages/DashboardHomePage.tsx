import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import { useSalonTenant } from "../app/salon-tenant-context";
import { AppIcon } from "../components/AppIcon";
import { formatEuro } from "../domain/money";
import { listBookings, type BookingWithId } from "../firebase/booking-repo";
import { listOperators, type OperatorWithId } from "../firebase/operator-repo";
import { listServices, type ServiceWithId } from "../firebase/service-repo";
import barberEditorial from "../assets/barber-editorial.webp";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function weekDays() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      key: dateKey(date),
      label: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date).replace(".", ""),
    };
  });
}

export function DashboardHomePage() {
  const { salonId, user } = useAuth();
  const { salon } = useSalonTenant();
  const [bookings, setBookings] = useState<BookingWithId[]>([]);
  const [services, setServices] = useState<ServiceWithId[]>([]);
  const [operators, setOperators] = useState<OperatorWithId[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salonId) return;
    void Promise.all([listBookings(salonId), listServices(salonId), listOperators(salonId)])
      .then(([nextBookings, nextServices, nextOperators]) => {
        setBookings(nextBookings);
        setServices(nextServices);
        setOperators(nextOperators.filter((operator) => operator.attivo));
      })
      .catch(() => setError("Non è stato possibile caricare il riepilogo."));
  }, [salonId]);

  const dashboard = useMemo(() => {
    const today = dateKey(new Date());
    const serviceById = new Map(services.map((service) => [service.id, service]));
    const operatorById = new Map(operators.map((operator) => [operator.id, operator]));
    const activeStatuses = new Set(["confermata", "in_attesa"]);
    const todayBookings = bookings
      .filter((booking) => booking.date === today && activeStatuses.has(booking.stato))
      .sort((a, b) => a.startMin - b.startMin);
    const confirmedToday = todayBookings.filter((booking) => booking.stato === "confermata");
    const revenue = confirmedToday.reduce((total, booking) => total + (serviceById.get(booking.serviceId)?.prezzo ?? 0), 0);
    const bookedMinutes = todayBookings.reduce((total, booking) => total + Math.max(0, booking.endMin - booking.startMin), 0);
    const capacity = Math.max(1, operators.length) * 8 * 60;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const next = todayBookings.find((booking) => booking.startMin >= currentMinutes) ?? todayBookings[0];
    const days = weekDays().map((day) => ({
      ...day,
      revenue: bookings
        .filter((booking) => booking.date === day.key && booking.stato === "confermata")
        .reduce((total, booking) => total + (serviceById.get(booking.serviceId)?.prezzo ?? 0), 0),
    }));
    const maxRevenue = Math.max(1, ...days.map((day) => day.revenue));
    const team = operators.map((operator) => {
      const minutes = todayBookings
        .filter((booking) => booking.operatorId === operator.id)
        .reduce((total, booking) => total + Math.max(0, booking.endMin - booking.startMin), 0);
      return { operator, percentage: Math.min(100, Math.round((minutes / 480) * 100)) };
    });

    return { todayBookings, serviceById, operatorById, revenue, bookedMinutes, capacity, next, days, maxRevenue, team };
  }, [bookings, operators, services]);

  const firstName = user?.displayName?.split(" ")[0] || "Fabio";
  const occupation = Math.round((dashboard.bookedMinutes / dashboard.capacity) * 100);
  const uniqueClients = new Set(dashboard.todayBookings.map((booking) => booking.clientId)).size;
  const pending = dashboard.todayBookings.filter((booking) => booking.stato === "in_attesa").length;

  return (
    <section className="owner-home">
      <header className="owner-welcome">
        <div>
          <span>Riepilogo del salone</span>
          <h1>Buongiorno, {firstName}</h1>
          <p>{salon?.nome ?? "Il tuo salone"} · ecco cosa succede oggi.</p>
          <Link to="/dashboard/prenotazioni">Apri agenda <AppIcon name="arrow" size={17} /></Link>
        </div>
        <img src={barberEditorial} alt="Barbiere al lavoro" />
      </header>

      {error && <p className="owner-home__error" role="alert">{error}</p>}

      <div className="owner-kpis">
        <article><AppIcon name="orders" /><div><span>Incasso oggi</span><strong>€ {formatEuro(dashboard.revenue)}</strong><small>{dashboard.todayBookings.length} appuntamenti</small></div></article>
        <article><AppIcon name="clock" /><div><span>Occupazione</span><strong>{occupation}%</strong><small>{dashboard.bookedMinutes} min prenotati</small></div></article>
        <article><AppIcon name="users" /><div><span>Clienti oggi</span><strong>{uniqueClients}</strong><small>{pending} richieste in attesa</small></div></article>
        <article><AppIcon name="calendar" /><div><span>Prossimo appuntamento</span><strong>{dashboard.next ? formatTime(dashboard.next.startMin) : "—"}</strong><small>{dashboard.next?.clientNome ?? "Agenda libera"}</small></div></article>
      </div>

      <div className="owner-home__grid">
        <section className="owner-agenda-panel">
          <header><div><span>Oggi</span><h2>Appuntamenti di oggi</h2></div><Link to="/dashboard/prenotazioni">Vedi agenda →</Link></header>
          <div className="owner-timeline">
            {dashboard.todayBookings.slice(0, 7).map((booking) => (
              <article key={booking.id}>
                <time>{formatTime(booking.startMin)}</time><i className={`is-${booking.stato}`} />
                <div><strong>{booking.clientNome ?? "Cliente"}</strong><span>{dashboard.serviceById.get(booking.serviceId)?.titolo ?? "Servizio"} · {dashboard.operatorById.get(booking.operatorId)?.nome ?? "Team"}</span></div>
                <small>{booking.stato === "in_attesa" ? "Da confermare" : "Confermato"}</small>
              </article>
            ))}
            {dashboard.todayBookings.length === 0 && <div className="owner-panel-empty"><AppIcon name="calendar" /><strong>Nessun appuntamento oggi</strong><span>La giornata è ancora libera.</span></div>}
          </div>
        </section>

        <section className="owner-chart-panel">
          <header><div><span>Settimana corrente</span><h2>Andamento settimanale</h2></div><strong>€ {formatEuro(dashboard.days.reduce((sum, day) => sum + day.revenue, 0))}</strong></header>
          <div className={`owner-chart ${dashboard.days.some((day) => day.revenue > 0) ? "" : "is-empty"}`} aria-label="Incasso della settimana">
            {dashboard.days.map((day) => <div key={day.key}><span style={{ height: `${Math.max(4, (day.revenue / dashboard.maxRevenue) * 100)}%` }} /><b>€ {Math.round(day.revenue)}</b><small>{day.label}</small></div>)}
            {!dashboard.days.some((day) => day.revenue > 0) && <p><AppIcon name="orders" /><strong>Nessun incasso confermato</strong><span>I dati compariranno con le prenotazioni della settimana.</span></p>}
          </div>
          <footer><span><i /> Incasso confermato</span><Link to="/dashboard/prenotazioni">Dettagli →</Link></footer>
        </section>

        <aside className="owner-team-panel">
          <header><span>Team</span><h2>Carico di lavoro</h2></header>
          <div>
            {dashboard.team.slice(0, 5).map(({ operator, percentage }) => <article key={operator.id}><span>{operator.nome.slice(0, 1)}</span><div><strong>{operator.nome}</strong><small>{percentage}% della giornata</small><i><b style={{ width: `${percentage}%` }} /></i></div></article>)}
            {dashboard.team.length === 0 && <div className="owner-panel-empty"><AppIcon name="users" /><strong>Nessun operatore attivo</strong></div>}
          </div>
          <Link to="/dashboard/operatori">Gestisci team →</Link>
        </aside>

        <aside className="owner-next-panel">
          <AppIcon name="clock" size={26} />
          <span>Prossimo appuntamento</span>
          <strong>{dashboard.next ? formatTime(dashboard.next.startMin) : "Agenda libera"}</strong>
          <p>{dashboard.next ? `${dashboard.next.clientNome ?? "Cliente"} · ${dashboard.serviceById.get(dashboard.next.serviceId)?.titolo ?? "Servizio"}` : "Non ci sono altri appuntamenti programmati per oggi."}</p>
          <Link to="/dashboard/prenotazioni">Apri agenda</Link>
        </aside>
      </div>
    </section>
  );
}
