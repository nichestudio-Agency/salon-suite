import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { AppIcon } from "../components/AppIcon";
import { DashboardFilePicker } from "../components/DashboardFilePicker";
import { createService, deleteService, listServices, updateService, uploadServicePhoto, type ServiceWithId } from "../firebase/service-repo";
import { formatEuro } from "../domain/money";

export function ServicesPage() {
  const { salonId } = useAuth(); const [items, setItems] = useState<ServiceWithId[]>([]);
  const [titolo, setTitolo] = useState(""); const [descrizione, setDescrizione] = useState(""); const [prezzoEuro, setPrezzoEuro] = useState(""); const [durata, setDurata] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false); const [warning, setWarning] = useState<string | null>(null);
  async function reload(id: string) { setItems(await listServices(id)); }
  useEffect(() => { if (salonId) void reload(salonId); }, [salonId]);
  async function onSubmit(event: FormEvent) { event.preventDefault(); if (!salonId) return; setBusy(true); setWarning(null); try {
    const id = await createService(salonId, { titolo, descrizione, prezzo: Math.round(Number.parseFloat(prezzoEuro || "0") * 100), durataMin: Number.parseInt(durata || "0", 10), attivo: true });
    if (file) try { const photo = await uploadServicePhoto(salonId, id, file, file.name); await updateService(salonId, id, photo); } catch { setWarning("Servizio creato, ma la foto non è stata caricata."); }
    setTitolo(""); setDescrizione(""); setPrezzoEuro(""); setDurata(""); setFile(null); await reload(salonId);
  } finally { setBusy(false); } }
  async function onDelete(id: string) { if (!salonId) return; await deleteService(salonId, id); await reload(salonId); }
  return <section className="entity-page"><header className="dashboard-page-header"><div><span>Catalogo</span><h2>Servizi</h2><p>Un colpo d’occhio su proposta, durata e prezzo.</p></div><strong>{items.length}</strong></header>
    <div className="entity-card-grid">{items.map((service) => <article className="entity-card" key={service.id}><div className="entity-card__media">{service.fotoUrl ? <img src={service.fotoUrl} alt="" /> : <AppIcon name="scissors" size={34} />}<span className={service.attivo ? "is-active" : "is-off"}>{service.attivo ? "Attivo" : "Non attivo"}</span></div><div className="entity-card__body"><small>Servizio</small><h3>{service.titolo}</h3><p>{service.descrizione || "Nessuna descrizione inserita."}</p><footer><span><AppIcon name="clock" size={15} /> {service.durataMin} min</span><strong>€ {formatEuro(service.prezzo)}</strong></footer></div><button className="entity-card__delete" type="button" onClick={() => void onDelete(service.id)}>Elimina</button></article>)}</div>
    <form className="entity-create" onSubmit={onSubmit}><header><span>Nuovo</span><h3>Aggiungi servizio</h3></header><div className="entity-create__grid"><label>Titolo<input value={titolo} onChange={(e) => setTitolo(e.target.value)} required /></label><label>Durata (min)<input type="number" min="5" step="5" value={durata} onChange={(e) => setDurata(e.target.value)} required /></label><label>Prezzo (€)<input type="number" min="0" step="0.01" value={prezzoEuro} onChange={(e) => setPrezzoEuro(e.target.value)} required /></label><DashboardFilePicker id="service-photo" label="Foto" file={file} onChange={setFile} /><label className="is-wide">Descrizione<textarea value={descrizione} onChange={(e) => setDescrizione(e.target.value)} /></label></div>{warning && <p role="alert">{warning}</p>}<button className="btn" type="submit" disabled={busy}>{busy ? "Salvataggio…" : "Aggiungi servizio"}</button></form>
  </section>;
}
