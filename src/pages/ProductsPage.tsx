import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../app/auth-context";
import {
  listProducts, createProduct, updateProduct, deleteProduct, uploadProductPhoto,
  type ProductWithId,
} from "../firebase/product-repo";

function euro(centesimi: number): string {
  return (centesimi / 100).toLocaleString("it-IT", { minimumFractionDigits: 2 });
}

export function ProductsPage() {
  const { salonId } = useAuth();
  const [items, setItems] = useState<ProductWithId[]>([]);
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [prezzoEuro, setPrezzoEuro] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload(id: string) {
    setItems(await listProducts(id));
  }
  useEffect(() => {
    if (salonId) void reload(salonId);
  }, [salonId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!salonId) return;
    setBusy(true);
    try {
      const id = await createProduct(salonId, {
        titolo,
        descrizione,
        prezzo: Math.round(parseFloat(prezzoEuro || "0") * 100),
        attivo: true,
      });
      if (file) {
        const { fotoUrl, fotoPath } = await uploadProductPhoto(salonId, id, file, file.name);
        await updateProduct(salonId, id, { fotoUrl, fotoPath });
      }
      setTitolo(""); setDescrizione(""); setPrezzoEuro(""); setFile(null);
      await reload(salonId);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: string) {
    if (!salonId) return;
    await deleteProduct(salonId, id);
    await reload(salonId);
  }

  return (
    <section>
      <h2>Prodotti</h2>
      {items.map((p) => (
        <div className="card row" key={p.id} style={{ justifyContent: "space-between" }}>
          <span className="row">
            {p.fotoUrl && (
              <img src={p.fotoUrl} alt="" width={44} height={44} style={{ borderRadius: 8, objectFit: "cover" }} />
            )}
            <span><strong>{p.titolo}</strong> · € {euro(p.prezzo)}{!p.attivo && " (non attivo)"}</span>
          </span>
          <button className="btn btn--danger" onClick={() => onDelete(p.id)}>Elimina</button>
        </div>
      ))}
      <form className="card" onSubmit={onSubmit}>
        <h3>Nuovo prodotto</h3>
        <div className="field"><label htmlFor="pt">Titolo</label>
          <input id="pt" aria-label="Titolo" value={titolo} onChange={(e) => setTitolo(e.target.value)} required /></div>
        <div className="field"><label htmlFor="pd">Descrizione</label>
          <textarea id="pd" aria-label="Descrizione" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} /></div>
        <div className="field"><label htmlFor="pp">Prezzo (€)</label>
          <input id="pp" aria-label="Prezzo (€)" type="number" min="0" step="0.01" value={prezzoEuro} onChange={(e) => setPrezzoEuro(e.target.value)} required /></div>
        <div className="field"><label htmlFor="pf">Foto (opzionale)</label>
          <input id="pf" aria-label="Foto (opzionale)" type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <button className="btn" type="submit" disabled={busy}>Aggiungi prodotto</button>
      </form>
    </section>
  );
}
