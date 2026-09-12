import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../app/auth-context";
import {
  DEFAULT_SHORTCUTS,
  getDashboardPreferences,
  markDashboardNotificationsRead,
  saveDashboardShortcuts,
  type DashboardShortcutId,
} from "../firebase/dashboard-preferences";
import { listDashboardActivity, type DashboardActivityItem } from "../firebase/dashboard-activity";
import { AppIcon } from "./AppIcon";

type Shortcut = {
  id: DashboardShortcutId;
  label: string;
  to: string;
  icon: "calendar" | "users" | "bag" | "gift" | "plus" | "ticket";
  target?: string;
};

const ACTIONS: Shortcut[] = [
  { id: "agenda", label: "Apri agenda", to: "/dashboard/prenotazioni", icon: "calendar" },
  { id: "nuovo_cliente", label: "Nuovo cliente", to: "/dashboard/clienti?create=1", icon: "users" },
  { id: "nuovo_prodotto", label: "Nuovo prodotto", to: "/dashboard/prodotti", icon: "bag", target: ".entity-create" },
  { id: "nuovo_coupon", label: "Nuovo coupon", to: "/dashboard/notifiche", icon: "gift", target: "#nuovo-coupon" },
  { id: "nuovo_operatore", label: "Nuovo operatore", to: "/dashboard/operatori", icon: "plus", target: ".entity-create" },
  { id: "assistenza", label: "Apri ticket", to: "/dashboard/assistenza", icon: "ticket" },
];

function timeAgo(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Adesso";
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  return `${Math.floor(hours / 24)} g fa`;
}

export function DashboardCommandBar() {
  const { user, salonId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [shortcuts, setShortcuts] = useState<DashboardShortcutId[]>(DEFAULT_SHORTCUTS);
  const [draft, setDraft] = useState<DashboardShortcutId[]>(DEFAULT_SHORTCUTS);
  const [lastReadAt, setLastReadAt] = useState(0);
  const [activity, setActivity] = useState<DashboardActivityItem[]>([]);
  const [panel, setPanel] = useState<"notifications" | "shortcuts" | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedActions = useMemo(
    () => shortcuts.map((id) => ACTIONS.find((item) => item.id === id)).filter(Boolean) as Shortcut[],
    [shortcuts],
  );
  const unread = activity.filter((item) => item.timestamp > lastReadAt).length;

  useEffect(() => {
    if (!user) return;
    void getDashboardPreferences(user.uid).then((preferences) => {
      setShortcuts(preferences.shortcuts);
      setDraft(preferences.shortcuts);
      setLastReadAt(preferences.lastNotificationsReadAt);
    });
  }, [user]);

  useEffect(() => {
    if (!salonId) return;
    let active = true;
    const load = () => void listDashboardActivity(salonId)
      .then((items) => { if (active) setActivity(items); })
      .catch(() => {});
    load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [salonId]);

  useEffect(() => setPanel(null), [location.pathname]);

  async function openNotifications() {
    const next = panel === "notifications" ? null : "notifications";
    setPanel(next);
    if (next && user) {
      const now = Date.now();
      setLastReadAt(now);
      await markDashboardNotificationsRead(user.uid, now).catch(() => {});
    }
  }

  function toggleDraft(id: DashboardShortcutId) {
    setDraft((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : current.length < 4 ? [...current, id] : current);
  }

  async function save() {
    if (!user || draft.length === 0) return;
    setSaving(true);
    try {
      await saveDashboardShortcuts(user.uid, draft);
      setShortcuts(draft);
      setPanel(null);
    } finally {
      setSaving(false);
    }
  }

  function runAction(action: Shortcut) {
    navigate(action.to);
    if (!action.target) return;
    window.setTimeout(() => {
      document.querySelector(action.target!)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  }

  return (
    <header className="dashboard-commandbar">
      <nav aria-label="Scorciatoie personali">
        {selectedActions.map((action) => (
          <button type="button" key={action.id} onClick={() => runAction(action)}>
            <AppIcon name={action.icon} size={17} />
            <span>{action.label}</span>
          </button>
        ))}
      </nav>
      <div className="dashboard-commandbar__tools">
        <button
          type="button"
          className="dashboard-commandbar__customize"
          onClick={() => {
            setDraft(shortcuts);
            setPanel(panel === "shortcuts" ? null : "shortcuts");
          }}
        >
          <AppIcon name="menu" size={17} />
          Personalizza
        </button>
        <button
          type="button"
          className="dashboard-commandbar__bell"
          aria-label={unread ? `${unread} notifiche non lette` : "Centro notifiche"}
          aria-expanded={panel === "notifications"}
          onClick={() => void openNotifications()}
        >
          <AppIcon name="bell" size={20} />
          {unread > 0 && <b>{Math.min(unread, 99)}</b>}
        </button>
      </div>

      {panel && (
        <>
          <button className="dashboard-commandbar__backdrop" type="button" aria-label="Chiudi pannello" onClick={() => setPanel(null)} />
          <aside className="dashboard-commandbar__panel">
            {panel === "shortcuts" ? (
              <>
                <header>
                  <span>La tua barra</span>
                  <h3>Scegli fino a 4 scorciatoie</h3>
                  <p>Le preferenze restano legate al tuo account.</p>
                </header>
                <div className="shortcut-picker">
                  {ACTIONS.map((action) => (
                    <label key={action.id}>
                      <input
                        type="checkbox"
                        checked={draft.includes(action.id)}
                        onChange={() => toggleDraft(action.id)}
                        disabled={!draft.includes(action.id) && draft.length >= 4}
                      />
                      <AppIcon name={action.icon} size={18} />
                      <span>{action.label}</span>
                    </label>
                  ))}
                </div>
                <button className="shortcut-save" type="button" disabled={saving || draft.length === 0} onClick={() => void save()}>
                  {saving ? "Salvataggio…" : "Salva scorciatoie"}
                </button>
              </>
            ) : (
              <>
                <header>
                  <span>Centro notifiche</span>
                  <h3>Attività recente</h3>
                  <p>Prenotazioni, ordini, ticket e comunicazioni di Salon Suite.</p>
                </header>
                <div className="activity-feed">
                  {activity.length === 0 ? (
                    <div className="activity-feed__empty">
                      <AppIcon name="bell" />
                      <strong>Tutto sotto controllo</strong>
                      <p>Le nuove attività compariranno qui.</p>
                    </div>
                  ) : activity.map((item) => (
                    <button type="button" key={item.id} onClick={() => navigate(item.to)}>
                      <span className={`is-${item.tipo}`}>
                        <AppIcon name={item.tipo === "prenotazione" ? "calendar" : item.tipo === "ordine" ? "orders" : item.tipo === "ticket" ? "ticket" : "spark"} size={17} />
                      </span>
                      <div>
                        <strong>{item.titolo}</strong>
                        <p>{item.testo}</p>
                        <small>{timeAgo(item.timestamp)}</small>
                      </div>
                      {item.timestamp > lastReadAt && <i />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </header>
  );
}
