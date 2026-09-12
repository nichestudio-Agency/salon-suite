import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { TicketCenter } from "../components/TicketCenter";
import { createPlatformAnnouncement } from "../firebase/platform-announcement-repo";
import { listPlatformSalons, type PlatformSalon } from "../firebase/platform-admin";

export function PlatformSupportPage() {
  const { user } = useAuth();
  const [salons, setSalons] = useState<PlatformSalon[]>([]);
  const [target, setTarget] = useState("all");
  const [titolo, setTitolo] = useState("");
  const [testo, setTesto] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    void listPlatformSalons().then(setSalons).catch(() => setSalons([]));
  }, []);

  async function publish(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      await createPlatformAnnouncement(target === "all"
        ? { titolo, testo, audience: "all" }
        : { titolo, testo, audience: "salon", salonId: target });
      const salonName = salons.find((salon) => salon.id === target)?.nome;
      setResult(target === "all" ? "Comunicazione inviata a tutte le attività." : `Comunicazione inviata a ${salonName ?? "questa attività"}.`);
      setTitolo("");
      setTesto("");
    } catch {
      setResult("Invio non riuscito. Riprova tra poco.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="platform-support-page">
      <header className="platform-title">
        <div><span>Supporto attività</span><h1>Ticket dei saloni.</h1></div>
        <div><p>Bug, problemi di configurazione e richieste operative inviati direttamente dalle attività.</p></div>
      </header>

      <form className="platform-announcement-composer" onSubmit={publish}>
        <header>
          <span>Centro notifiche</span>
          <h2>Comunica un aggiornamento</h2>
          <p>La comunicazione comparirà nella campanella della dashboard del salone.</p>
        </header>
        <div className="platform-announcement-composer__fields">
          <label>
            Destinatari
            <select value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="all">Tutte le attività</option>
              {salons.map((salon) => <option value={salon.id} key={salon.id}>{salon.nome}</option>)}
            </select>
          </label>
          <label>
            Titolo
            <input value={titolo} onChange={(event) => setTitolo(event.target.value)} placeholder="Novità nella gestione agenda" required />
          </label>
          <label className="is-wide">
            Messaggio
            <textarea value={testo} onChange={(event) => setTesto(event.target.value)} placeholder="Descrivi in modo breve cosa è cambiato…" required />
          </label>
        </div>
        <footer>
          {result && <p role="status">{result}</p>}
          <button className="platform-button" type="submit" disabled={busy}>{busy ? "Invio…" : "Pubblica comunicazione"}</button>
        </footer>
      </form>

      <TicketCenter mode="platform" viewerName={user?.displayName || "Salon Suite"} />
    </section>
  );
}
