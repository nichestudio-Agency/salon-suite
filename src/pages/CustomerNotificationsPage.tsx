import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AppIcon } from "../components/AppIcon";
import { useSalonTenant } from "../app/salon-tenant-context";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type CustomerNotification,
} from "../firebase/customer-notification-repo";
import { acceptWaitlistOffer, cancelWaitlist } from "../firebase/waitlist-repo";
import "./customer.css";

const KIND_LABEL: Record<CustomerNotification["kind"], string> = {
  booking: "Prenotazione",
  order: "Ordine",
  waitlist: "Disponibilità",
  birthday: "Per te",
  campaign: "Offerta",
  general: "Salone",
};

function actionFor(item: CustomerNotification) {
  if (item.kind === "order") return { to: "/i-miei-ordini", label: "Vedi ordine" };
  if (item.kind === "birthday" || item.kind === "campaign") return { to: item.couponId ? "/prenota" : "/catalogo", label: "Scopri" };
  if (item.kind === "waitlist") return { to: "/prenota", label: "Cerca un altro orario" };
  return { to: "/appuntamenti", label: "Vedi appuntamenti" };
}

function dateLabel(value: number) {
  if (!value) return "Adesso";
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(value);
}

export function CustomerNotificationsPage() {
  const { salon } = useSalonTenant();
  const [items, setItems] = useState<CustomerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busyWaitlistId, setBusyWaitlistId] = useState<string | null>(null);
  const [resolvedWaitlistIds, setResolvedWaitlistIds] = useState<string[]>([]);
  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);

  useEffect(() => {
    if (!salon?.id) return;
    void listMyNotifications(salon.id)
      .then(setItems)
      .catch(() => setError("Non siamo riusciti a caricare gli aggiornamenti."))
      .finally(() => setLoading(false));
  }, [salon?.id]);

  async function read(item: CustomerNotification) {
    if (!salon?.id || item.read) return;
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry));
    try {
      await markNotificationRead(salon.id, item.id);
      window.dispatchEvent(new Event("customer-notifications-updated"));
    }
    catch { setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read: false } : entry)); }
  }

  async function readAll() {
    if (!salon?.id || unread === 0) return;
    const previous = items;
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    try {
      await markAllNotificationsRead(salon.id, previous);
      window.dispatchEvent(new Event("customer-notifications-updated"));
    }
    catch { setItems(previous); setError("Non è stato possibile aggiornare le notifiche."); }
  }

  async function acceptWaitlist(item: CustomerNotification) {
    if (!salon?.id || !item.waitlistEntryId) return;
    setBusyWaitlistId(item.waitlistEntryId);
    setError(null);
    setFeedback(null);
    try {
      const booking = await acceptWaitlistOffer(salon.id, item.waitlistEntryId);
      setResolvedWaitlistIds((current) => [...current, item.waitlistEntryId!]);
      setFeedback(booking.stato === "confermata" ? "Appuntamento confermato: lo slot è tuo." : "Slot richiesto. Il salone deve ancora confermare l’appuntamento.");
      await read(item);
    } catch {
      setError("Questo slot è appena stato scelto. Puoi cercare un altro orario o restare in coda per una nuova disponibilità.");
    } finally { setBusyWaitlistId(null); }
  }

  async function declineWaitlist(item: CustomerNotification) {
    if (!salon?.id || !item.waitlistEntryId) return;
    setBusyWaitlistId(item.waitlistEntryId);
    setError(null);
    try {
      await cancelWaitlist(salon.id, item.waitlistEntryId);
      setResolvedWaitlistIds((current) => [...current, item.waitlistEntryId!]);
      setFeedback("Disponibilità lasciata libera. Non riceverai altri avvisi per questo slot.");
      await read(item);
    } catch { setError("Non è stato possibile aggiornare la lista d’attesa."); }
    finally { setBusyWaitlistId(null); }
  }

  return (
    <section className="customer-page customer-notifications-page">
      <header className="customer-shell__header">
        <div><span className="customer-shell__eyebrow">Centro aggiornamenti</span><h1>Per te</h1><p>Conferme, ordini, disponibilità e offerte del tuo salone, tutte nello stesso posto.</p></div>
        {unread > 0 && <button className="customer-text-action" type="button" onClick={() => void readAll()}>Segna lette</button>}
      </header>
      {error && <p className="customer-error" role="alert">{error}</p>}
      {feedback && <p className="customer-feedback" role="status">{feedback}</p>}
      {loading ? <div className="customer-list-skeleton" aria-label="Caricamento notifiche"><span /><span /><span /></div> : items.length === 0 ? (
        <div className="customer-empty customer-empty--stacked"><AppIcon name="bell" size={28} /><strong>Tutto tranquillo</strong><p>Le conferme e le novità del salone appariranno qui.</p></div>
      ) : (
        <div className="customer-notification-list">
          {items.map((item) => {
            const action = actionFor(item);
            return <article className={item.read ? "" : "is-unread"} key={item.id}>
              <div className={`customer-notification-icon is-${item.kind}`}><AppIcon name={item.kind === "order" ? "bag" : item.kind === "birthday" || item.kind === "campaign" ? "gift" : item.kind === "waitlist" ? "clock" : "calendar"} size={20} /></div>
              <div><span>{KIND_LABEL[item.kind]} · {dateLabel(item.createdAtMs)}</span><h2>{item.title}</h2><p>{item.body}</p>{item.kind === "waitlist" && item.waitlistEntryId && !resolvedWaitlistIds.includes(item.waitlistEntryId) ? <div className="customer-notification-waitlist-actions"><button type="button" disabled={busyWaitlistId === item.waitlistEntryId} onClick={() => void acceptWaitlist(item)}>{busyWaitlistId === item.waitlistEntryId ? "Verifica…" : "Sì, prenota lo slot"}</button><button type="button" disabled={busyWaitlistId === item.waitlistEntryId} onClick={() => void declineWaitlist(item)}>Non mi interessa più</button></div> : <Link to={action.to} onClick={() => void read(item)}>{action.label} <AppIcon name="arrow" size={16} /></Link>}{!item.read && <button className="customer-notification-read" type="button" onClick={() => void read(item)}>Segna come letta</button>}</div>
              {!item.read && <i aria-label="Non letta" />}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
