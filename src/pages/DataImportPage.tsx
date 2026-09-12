import { useMemo, useState } from "react";
import { useAuth } from "../app/auth-context";
import { csvRecords } from "../domain/csv";
import { importCsvRecords, type ImportEntity, type ImportResult } from "../firebase/import-repo";

const CONFIG: Record<ImportEntity, { label: string; columns: string; example: string }> = {
  clienti: { label: "Clienti", columns: "nome,email,telefono,sesso,data_nascita", example: "Mario Rossi,mario@example.it,3331234567,maschile,1990-05-12" },
  servizi: { label: "Servizi", columns: "titolo,descrizione,prezzo,durata_min", example: "Taglio uomo,Taglio e styling,25.00,30" },
  operatori: { label: "Operatori", columns: "nome", example: "Marco Rossi" },
  prodotti: { label: "Prodotti", columns: "titolo,descrizione,prezzo", example: "Cera opaca,Finitura naturale,18.50" },
};

export function DataImportPage() {
  const { salonId } = useAuth();
  const [entity, setEntity] = useState<ImportEntity>("clienti");
  const [filename, setFilename] = useState("");
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headers = useMemo(() => Object.keys(rows[0] ?? {}), [rows]);

  async function chooseFile(file?: File) {
    setResult(null); setError(null); setRows([]); setFilename(file?.name ?? "");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) { setError("Esporta il file da Excel o dal vecchio gestionale in formato CSV."); return; }
    try {
      const parsed = csvRecords(await file.text());
      if (!parsed.length) throw new Error("empty");
      setRows(parsed);
    } catch { setError("Il file non contiene righe CSV leggibili."); }
  }

  async function runImport() {
    if (!salonId || !rows.length) return;
    setBusy(true); setError(null);
    try { setResult(await importCsvRecords(salonId, entity, rows)); }
    catch { setError("Importazione interrotta. Nessun lotto incompleto viene ripetuto automaticamente."); }
    finally { setBusy(false); }
  }

  function downloadTemplate() {
    const config = CONFIG[entity];
    const url = URL.createObjectURL(new Blob([`${config.columns}\n${config.example}\n`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `modello-${entity}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <section className="data-import-page">
    <header className="dashboard-page-header"><div><span>Portabilità</span><h2>Importa dati</h2><p>Trasferisci i dati dal vecchio gestionale con anteprima e controllo duplicati.</p></div><button className="btn btn--ghost" type="button" onClick={downloadTemplate}>Scarica modello CSV</button></header>
    <div className="data-import-flow">
      <section className="data-import-setup">
        <span>01 · Scegli cosa importare</span>
        <div className="data-import-types">{(Object.keys(CONFIG) as ImportEntity[]).map((key) => <button className={entity === key ? "is-active" : ""} type="button" onClick={() => { setEntity(key); setRows([]); setFilename(""); setResult(null); }} key={key}>{CONFIG[key].label}</button>)}</div>
        <span>02 · Carica il file</span>
        <label className="data-import-drop"><input aria-label="File CSV" type="file" accept=".csv,text/csv" onChange={(event) => void chooseFile(event.target.files?.[0])} /><strong>{filename || "Seleziona un file CSV"}</strong><small>Puoi esportarlo da Excel, Google Sheets o dal gestionale precedente.</small></label>
        <p>Colonne riconosciute: <code>{CONFIG[entity].columns}</code></p>
      </section>
      <section className="data-import-preview">
        <header><div><span>03 · Controlla</span><h3>Anteprima</h3></div><strong>{rows.length} righe</strong></header>
        {rows.length ? <div className="data-import-table"><table><thead><tr>{headers.map((header) => <th key={header}>{header.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{rows.slice(0, 6).map((row, index) => <tr key={index}>{headers.map((header) => <td key={header}>{row[header] || "—"}</td>)}</tr>)}</tbody></table>{rows.length > 6 && <p>Anteprima delle prime 6 righe su {rows.length}.</p>}</div> : <div className="data-import-empty">Carica un file per visualizzare i dati prima dell’importazione.</div>}
        {error && <p className="owner-home__error" role="alert">{error}</p>}
        {result && <div className="data-import-result" role="status"><strong>{result.imported} righe importate</strong><span>{result.skipped} duplicati ignorati · {result.errors.length} righe non valide</span>{result.errors.length > 0 && <details><summary>Mostra errori</summary>{result.errors.slice(0, 20).map((item) => <p key={item}>{item}</p>)}</details>}</div>}
        <button className="btn data-import-submit" type="button" disabled={!rows.length || busy || Boolean(result)} onClick={() => void runImport()}>{busy ? "Importazione…" : `Importa ${CONFIG[entity].label.toLowerCase()}`}</button>
      </section>
    </div>
  </section>;
}
