import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import { AppIcon } from "../components/AppIcon";
import { DashboardFilePicker } from "../components/DashboardFilePicker";
import { listProducts, createProduct, updateProduct, deleteProduct, uploadProductPhoto, type ProductWithId } from "../firebase/product-repo";
import { formatEuro } from "../domain/money";

export function ProductsPage() {
  const { salonId } = useAuth(); const [items, setItems] = useState<ProductWithId[]>([]); const [titolo, setTitolo] = useState(""); const [descrizione, setDescrizione] = useState(""); const [prezzoEuro, setPrezzoEuro] = useState(""); const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false); const [warning, setWarning] = useState<string | null>(null);
  async function reload(id: string) { setItems(await listProducts(id)); }
  useEffect(() => { if (salonId) void reload(salonId); }, [salonId]);
  async function onSubmit(e: FormEvent) { e.preventDefault(); if (!salonId) return; setBusy(true); setWarning(null); try { const id = await createProduct(salonId, { titolo, descrizione, prezzo: Math.round(parseFloat(prezzoEuro || "0") * 100), attivo: true }); if (file) try { const photo = await uploadProductPhoto(salonId, id, file, file.name); await updateProduct(salonId, id, photo); } catch { setWarning("Prodotto creato, ma la foto non è stata caricata."); } setTitolo(""); setDescrizione(""); setPrezzoEuro(""); setFile(null); await reload(salonId); } finally { setBusy(false); } }
  async function onDelete(id: string) { if (!salonId) return; await deleteProduct(salonId, id); await reload(salonId); }
  return <section className="entity-page"><header className="dashboard-page-header"><div><span>Vendita</span><h2>Prodotti</h2><p>Catalogo retail con immagini, descrizioni e prezzi.</p></div><strong>{items.length}</strong></header>
    <div className="entity-card-grid">{items.map((product) => <article className="entity-card" key={product.id}><div className="entity-card__media">{product.fotoUrl ? <img src={product.fotoUrl} alt="" /> : <AppIcon name="bag" size={34} />}<span className={product.attivo ? "is-active" : "is-off"}>{product.attivo ? "Disponibile" : "Nascosto"}</span></div><div className="entity-card__body"><small>Prodotto</small><h3>{product.titolo}</h3><p>{product.descrizione || "Nessuna descrizione inserita."}</p><footer><span>Prezzo al cliente</span><strong>€ {formatEuro(product.prezzo)}</strong></footer></div><button className="entity-card__delete" type="button" onClick={() => void onDelete(product.id)}>Elimina</button></article>)}</div>
    <form className="entity-create" onSubmit={onSubmit}><header><span>Nuovo</span><h3>Aggiungi prodotto</h3></header><div className="entity-create__grid"><label>Titolo<input value={titolo} onChange={(e) => setTitolo(e.target.value)} required /></label><label>Prezzo (€)<input type="number" min="0" step="0.01" value={prezzoEuro} onChange={(e) => setPrezzoEuro(e.target.value)} required /></label><DashboardFilePicker id="product-photo" label="Foto" file={file} onChange={setFile} /><label className="is-wide">Descrizione<textarea value={descrizione} onChange={(e) => setDescrizione(e.target.value)} /></label></div>{warning && <p role="alert">{warning}</p>}<button className="btn" type="submit" disabled={busy}>{busy ? "Salvataggio…" : "Aggiungi prodotto"}</button></form>
  </section>;
}
