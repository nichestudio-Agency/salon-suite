import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

function fail(error) {
  console.error(`DECK_ERROR: ${error?.message ?? error}`);
  console.error(error?.stack ?? "");
  process.exit(1);
}
process.on("uncaughtException", fail);
process.on("unhandledRejection", fail);

const workspaceDir = "/Users/fabio_pace/App Barber Shop";
const SKILL_DIR = "/Users/fabio_pace/.codex/plugins/cache/openai-primary-runtime/presentations/26.904.11930/skills/presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-deck-v4");
const FINAL_PPTX = path.join(workspaceDir, "output", "Salon-Suite-Presentazione-Clienti-Finale.pptx");
const RUNTIME_PYTHON = "/Users/fabio_pace/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";
const { resolvePresentationFont, applyPresentationChartFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href,
);
const font = resolvePresentationFont({ fontFamily: "Helvetica Neue" });
const presentation = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = {
  coal: "#171513", coal2: "#26211E", cream: "#F4EFE7", paper: "#FBF8F3",
  coral: "#FF5B36", blush: "#D5A0AA", sage: "#688976", amber: "#E7B744",
  ink: "#1B1816", taupe: "#716961", line: "#D5CDC3", white: "#FFFDFC",
};
const library = path.join(workspaceDir, "presentazione-clienti");
const generated = path.join(library, "immagini");
const screens = path.join(library, "screenshots");
const assets = path.join(library, "immagini");

function shape(slide, x, y, w, h, fill, radius = 0, line = "none", shadow) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: line === "none" ? { fill: "none", width: 0 } : { fill: line, width: 1 },
    borderRadius: radius || undefined,
    shadow,
  });
}

function text(slide, value, x, y, w, h, size, color = C.ink, bold = false, options = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  box.text = value;
  box.text.style = {
    typeface: font,
    fontSize: size,
    bold,
    color,
    italic: options.italic ?? false,
    autoFit: "none",
  };
  return box;
}

function line(slide, x, y, w, color, width = 1) {
  return slide.shapes.add({
    geometry: "line",
    position: { left: x, top: y, width: w, height: 0 },
    fill: "none",
    line: { fill: color, width },
  });
}

function footer(slide, n, dark = false, source = "") {
  const color = dark ? "#958E87" : "#8D857D";
  text(slide, `SALON SUITE  ${String(n).padStart(2, "0")}`, 64, 681, 200, 16, 10, color, true);
  if (source) text(slide, source, 350, 681, 720, 16, 9, color, false);
}

function heading(slide, title, dark = false, x = 64, y = 52, w = 1120, size = 45) {
  return text(slide, title, x, y, w, 74, size, dark ? C.cream : C.ink, true);
}

async function addImage(slide, file, x, y, w, h, alt, fit = "cover", radius = 0, crop) {
  const ext = path.extname(file).toLowerCase();
  const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return slide.images.add({
    blob: new Uint8Array(await fs.readFile(file)),
    contentType,
    alt,
    fit,
    crop,
    geometry: radius ? "roundRect" : "rect",
    borderRadius: radius || undefined,
    position: { left: x, top: y, width: w, height: h },
  });
}

// 1 — cover
{
  const s = presentation.slides.add();
  s.background.fill = C.coal;
  await addImage(s, path.join(generated, "hero-salone.png"), 0, 0, 1280, 720, "Hair stylist al lavoro in un salone contemporaneo", "cover");
  shape(s, 0, 0, 650, 720, C.coal);
  shape(s, 64, 66, 54, 8, C.coral);
  text(s, "SALON SUITE", 64, 91, 240, 30, 15, C.blush, true);
  text(s, "Più prenotazioni.\nMeno interruzioni.", 64, 172, 610, 166, 58, C.cream, true);
  line(s, 64, 380, 440, C.coral, 3);
  text(s, "L’app del tuo salone e gli strumenti per gestire agenda, clienti e comunicazioni in un unico posto.", 64, 414, 500, 105, 22, "#D7D0C8");
  text(s, "PRESENTAZIONE PER IL SALONE", 64, 631, 300, 20, 11, "#918981", true);
  s.speakerNotes.textFrame.setText("Immagine di copertina illustrativa generata per il deck. Non raffigura un cliente reale.");
}

// 2 — evidence
{
  const s = presentation.slides.add();
  s.background.fill = C.cream;
  await addImage(s, path.join(assets, "trattamento-colore.webp"), 800, 0, 480, 720, "Trattamento colore in salone", "cover");
  shape(s, 0, 0, 845, 720, C.cream);
  text(s, "COME PRENOTANO OGGI", 64, 52, 260, 22, 12, C.sage, true);
  heading(s, "Il telefono è già la porta d’ingresso del salone", false, 64, 82, 700, 44);
  text(s, "80%", 64, 214, 260, 95, 76, C.coral, true);
  text(s, "dei clienti di saloni e spa è interessato a prenotare dal proprio smartphone", 64, 307, 560, 75, 21, C.ink, true);
  line(s, 64, 405, 660, C.line, 1);
  text(s, "46%", 64, 438, 160, 56, 43, C.ink, true);
  text(s, "delle prenotazioni online analizzate da Phorest arrivava quando il salone era chiuso", 210, 441, 510, 68, 19, C.taupe);
  text(s, "81%", 64, 536, 160, 56, 43, C.blush, true);
  text(s, "è interessato a ricevere promemoria via messaggio", 210, 543, 460, 52, 19, C.taupe);
  footer(s, 2, false, "Fonti: Zenoti 2024, n=1.413 USA; Phorest 2019, oltre 5.000 attività");
  s.speakerNotes.textFrame.setText([
    "Fonti:",
    "Zenoti, 2024 Salon and Spa Consumer Survey Results. Campione: 1.413 consumatori statunitensi. https://www.zenoti.com/resources/salon-and-spa-consumer-survey-results-2024",
    "Il report indica che l'80% è interessato alla prenotazione mobile e l'81% ai promemoria via SMS.",
    "Phorest, analisi 2019 su oltre 5.000 saloni e spa: 46% delle prenotazioni online avveniva fuori dagli orari di apertura. https://www.phorest.com/blog/click-play-with-the-brand-new-phorest-salon-app/",
    "I dati descrivono i campioni delle ricerche citate e non garantiscono lo stesso risultato per ogni salone.",
  ].join("\n"));
}

// 3 — realistic phone mockup
{
  const s = presentation.slides.add();
  s.background.fill = C.paper;
  await addImage(s, path.join(generated, "mockup-telefono-salone.png"), 200, 0, 1080, 720, "Smartphone tenuto in mano all'interno di un salone", "cover");
  // Real app screenshot aligned to the generated phone's flat black screen, preserving source ratio.
  await addImage(s, path.join(screens, "app-home-telefono.jpg"), 844, 87, 232, 502, "Home reale dell'app Atelier Luce", "cover", 16);
  shape(s, 0, 0, 585, 720, C.coal);
  text(s, "PRENOTAZIONE 24 ORE SU 24", 64, 67, 330, 22, 12, C.blush, true);
  text(s, "Il cliente prenota quando gli è più comodo", 64, 111, 485, 154, 48, C.cream, true);
  text(s, "Vede subito servizi, prezzi, professionisti e disponibilità. Conferma senza telefonate e ritrova tutto nello stesso spazio.", 64, 304, 430, 118, 21, "#CEC7BF");
  line(s, 64, 468, 420, C.coral, 3);
  text(s, "Un’esperienza con il nome, i colori e le fotografie del tuo salone.", 64, 503, 430, 76, 20, C.white, true);
  footer(s, 3, true);
  s.speakerNotes.textFrame.setText("Il contenuto sul display è una schermata reale dell'app demo Atelier Luce. La fotografia del telefono è un'immagine illustrativa generata e non raffigura un cliente reale.");
}

// 4 — real app flow
{
  const s = presentation.slides.add();
  s.background.fill = "#E8DDD8";
  text(s, "L’ESPERIENZA DEL CLIENTE", 64, 46, 300, 22, 12, C.sage, true);
  heading(s, "Dal desiderio alla conferma in pochi passaggi", false, 64, 76, 1050, 44);
  const items = [
    { file: "app-home.jpg", x: 88, y: 176, label: "01  SCOPRE", note: "Il salone, il listino e il team" },
    { file: "app-servizi.jpg", x: 471, y: 151, label: "02  SCEGLIE", note: "Servizio, durata e prezzo" },
    { file: "app-prenotazione.jpg", x: 854, y: 176, label: "03  PRENOTA", note: "Professionista, data e orario" },
  ];
  for (const item of items) {
    shape(s, item.x - 9, item.y - 9, 286, 420, C.coal, 24, "#3A342F", "shadow-lg");
    await addImage(s, path.join(screens, item.file), item.x, item.y, 268, 386, item.note, "cover", 17);
    text(s, item.label, item.x, 582, 200, 22, 12, item.x === 471 ? C.blush : C.coral, true);
    text(s, item.note, item.x, 608, 286, 42, 16, C.ink, true);
  }
  footer(s, 4);
  s.speakerNotes.textFrame.setText("Tutte e tre le immagini mostrano schermate reali dell'app demo Atelier Luce. Le proporzioni originali sono state mantenute.");
}

// 5 — owner dashboard
{
  const s = presentation.slides.add();
  s.background.fill = C.coal;
  text(s, "GESTIONE QUOTIDIANA", 64, 48, 260, 22, 12, C.blush, true);
  heading(s, "La giornata del salone in una sola vista", true, 64, 78, 900, 46);
  text(s, "Incasso, occupazione, prossimi appuntamenti e carico del team restano leggibili anche dal telefono.", 64, 146, 720, 58, 19, "#BEB6AF");
  shape(s, 132, 230, 1082, 395, "#0D0C0B", 24, C.blush, "shadow-xl");
  await addImage(s, path.join(screens, "dashboard-home.png"), 144, 242, 1058, 371, "Dashboard reale del titolare Atelier Luce", "cover", 16);
  footer(s, 5, true);
  s.speakerNotes.textFrame.setText("Schermata reale della dashboard demo Atelier Luce. I valori mostrati sono dati dimostrativi del prodotto.");
}

// 6 — personalized communication
{
  const s = presentation.slides.add();
  s.background.fill = C.paper;
  text(s, "Automazioni e coupon", 64, 53, 520, 48, 34, C.ink, true);
  text(s, "Comunicazioni collegate ai dati reali del cliente", 64, 103, 590, 30, 17, C.taupe);
  await addImage(s, path.join(screens, "dashboard-notifiche.png"), 0, 150, 790, 444, "Dashboard reale per notifiche e coupon", "cover");
  shape(s, 742, 0, 538, 720, C.coal);
  text(s, "CLIENTI CHE TORNANO", 790, 54, 280, 22, 12, C.blush, true);
  text(s, "81%", 790, 108, 350, 105, 82, C.coral, true);
  text(s, "dei clienti di saloni e spa dichiara una maggiore propensione a riprenotare quando riceve offerte personalizzate", 790, 215, 414, 126, 22, C.cream, true);
  line(s, 790, 380, 360, C.blush, 2);
  text(s, "Il sistema può contattare chi compie gli anni, chi non prenota da tempo o chi può riempire uno slot libero oggi.", 790, 414, 405, 110, 19, "#C9C1B9");
  text(s, "Ogni coupon resta misurabile: inviato, utilizzato, non utilizzato o scaduto.", 790, 558, 405, 66, 17, C.white, true);
  footer(s, 6, true, "Fonte: Zenoti 2024 Salon and Spa Consumer Survey");
  s.speakerNotes.textFrame.setText([
    "Fonte: Zenoti, 2024 Salon and Spa Consumer Survey Results. https://www.zenoti.com/thecheckin/4-key-salon-consumer-trends-every-business-owner-should-know-for-2025",
    "La fonte riporta che l'81% dei clienti intervistati è più propenso a riprenotare quando riceve offerte personalizzate.",
    "Campione della ricerca Zenoti: oltre 1.400 consumatori statunitensi di saloni e spa. Il dato non garantisce un incremento identico per ogni attività.",
    "La schermata di sinistra proviene dalla dashboard demo Atelier Luce; i numeri del coupon sono dimostrativi.",
  ].join("\n"));
}

// 7 — benchmark chart
{
  const s = presentation.slides.add();
  s.background.fill = C.cream;
  text(s, "FIDELITY CARD", 64, 48, 260, 22, 12, C.sage, true);
  heading(s, "Premi gestiti direttamente in negozio", false, 64, 78, 1080, 44);
  text(s, "Il cliente mostra il QR. Lo staff conferma l’importo pagato e accredita i punti. Quando raggiunge la soglia, il cliente utilizza il premio alla cassa.", 64, 139, 1110, 62, 19, C.taupe);

  shape(s, 64, 211, 274, 474, C.coal, 24, "#3A342F", "shadow-lg");
  await addImage(s, path.join(screens, "app-fidelity.png"), 76, 223, 250, 450, "Card fidelity reale nell'app cliente", "contain", 16);

  shape(s, 398, 235, 806, 434, C.coal, 24, C.blush, "shadow-xl");
  await addImage(s, path.join(screens, "dashboard-fidelity-cliente-selezionato.png"), 410, 247, 782, 410, "Gestione fidelity reale con cliente selezionato", "cover", 16);
  footer(s, 7);
  s.speakerNotes.textFrame.setText("Le immagini mostrano schermate reali del progetto demo Salone X. I punti e i premi visualizzati sono dati dimostrativi. Il pagamento resta in negozio tramite i sistemi già usati dal salone.");
}

// 8 — benchmark chart
{
  const s = presentation.slides.add();
  s.background.fill = C.cream;
  text(s, "BENCHMARK DI SETTORE", 64, 48, 300, 22, 12, C.sage, true);
  heading(s, "Prenotazioni online: 59% nei saloni top", false, 64, 78, 1080, 44);
  text(s, "Quota di appuntamenti prenotati direttamente dal cliente online", 64, 146, 730, 30, 18, C.taupe);
  const chart = s.charts.add("bar", {
    position: { left: 64, top: 225, width: 760, height: 345 },
    categories: ["Media del settore", "Top 10% per ricavi"],
    series: [{ name: "Prenotazioni online", values: [0.30, 0.59], fill: C.coral }],
    barOptions: { direction: "column", grouping: "clustered" },
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd", numberFormatCode: "0%" },
  });
  applyPresentationChartFont(chart, { fontFamily: font });
  chart.yAxis.minimumScale = 0;
  chart.yAxis.maximumScale = 0.7;
  chart.yAxis.majorUnit = 0.1;
  chart.yAxis.numberFormatCode = "0%";
  shape(s, 870, 216, 330, 355, C.coal, 26);
  text(s, "59%", 908, 252, 230, 84, 68, C.blush, true);
  text(s, "tasso di prenotazione online dei saloni nel 10% più alto per ricavi", 908, 342, 240, 95, 20, C.cream, true);
  line(s, 908, 467, 220, C.coral, 3);
  text(s, "Il dato mostra una correlazione. Non dimostra che la prenotazione online, da sola, causi l’aumento dei ricavi.", 908, 496, 240, 62, 14, "#BEB6AF");
  text(s, "Fonte: Zenoti, Beauty & Wellness Benchmark Report 2025", 64, 608, 670, 18, 11, C.taupe, true);
  footer(s, 8);
  s.speakerNotes.textFrame.setText([
    "Fonte: Zenoti, 2025 Beauty and Wellness Benchmark Report. https://www.zenoti.com/wp-content/uploads/2025/09/2025_Benchmark-Report_Rebranded_Final.pdf",
    "Il report riporta per i saloni un tasso di prenotazione online del 59% nel 10% più alto per ricavi e del 30% nella media.",
    "I dati provengono dalle attività presenti nella base Zenoti. La relazione è una correlazione e non prova causalità.",
  ].join("\n"));
}

// 9 — practical value
{
  const s = presentation.slides.add();
  s.background.fill = C.coal;
  await addImage(s, path.join(assets, "prodotti-professionali.webp"), 820, 0, 460, 720, "Prodotti professionali in salone", "cover");
  shape(s, 0, 0, 865, 720, C.coal);
  text(s, "COSA CAMBIA OGNI GIORNO", 64, 49, 310, 22, 12, C.blush, true);
  heading(s, "Meno attività manuali. Più tempo per il cliente", true, 64, 82, 700, 44);
  const rows = [
    ["01", "Agenda sempre aggiornata", "Prenotazioni, spostamenti e indisponibilità nello stesso calendario"],
    ["02", "Clienti riconoscibili", "Storico delle visite, preferenze, acquisti e prossima occasione di contatto"],
    ["03", "Promozioni mirate", "Messaggi e coupon collegati a un comportamento reale, non invii indistinti"],
    ["04", "Risultati leggibili", "Incassi, occupazione, utilizzo dei coupon e andamento del team"],
  ];
  rows.forEach(([n, h, b], i) => {
    const y = 236 + i * 94;
    text(s, n, 64, y, 48, 30, 14, i === 3 ? C.coral : C.blush, true);
    text(s, h, 128, y - 4, 280, 34, 23, C.cream, true);
    text(s, b, 430, y - 2, 350, 54, 17, "#BEB6AF");
    line(s, 64, y + 63, 716, "#3A3531", 1);
  });
  footer(s, 9, true);
  s.speakerNotes.textFrame.setText("La fotografia è un'immagine di prodotto usata nell'app demo. I benefici elencati corrispondono alle funzioni disponibili nel progetto.");
}

// 10 — plans
{
  const s = presentation.slides.add();
  s.background.fill = C.paper;
  text(s, "PIANI", 64, 47, 120, 22, 12, C.sage, true);
  heading(s, "Il livello giusto per il tuo salone", false, 64, 78, 920, 45);
  const plans = [
    { x: 64, w: 345, bg: "#E8E2D9", c: C.ink, name: "START", price: "€49", note: "Per iniziare", lines: ["Prenotazione online e agenda", "Fino a 2 operatori", "250 clienti registrati", "Report essenziali"] },
    { x: 435, w: 382, bg: C.blush, c: C.ink, name: "STUDIO", price: "€79", note: "Il piano consigliato", lines: ["Fino a 5 operatori", "Fidelity card con QR", "Prodotti e ordini", "Brand e campagne completi"] },
    { x: 843, w: 373, bg: C.coal, c: C.cream, name: "PRO", price: "€129", note: "Per crescere", lines: ["Operatori e clienti illimitati", "Fidelity e coupon dinamici", "Recupero clienti inattivi", "Report avanzati"] },
  ];
  for (const p of plans) {
    shape(s, p.x, 194, p.w, 410, p.bg, 26, p.name === "STUDIO" ? C.coral : "none", p.name === "STUDIO" ? "shadow-xl" : undefined);
    text(s, p.name, p.x + 28, 227, p.w - 56, 24, 13, p.name === "STUDIO" ? C.ink : (p.name === "PRO" ? C.blush : C.sage), true);
    text(s, p.price, p.x + 28, 272, 180, 70, 54, p.c, true);
    text(s, "/ mese", p.x + 170, 310, 100, 28, 16, p.c, false);
    text(s, p.note, p.x + 28, 354, p.w - 56, 28, 17, p.c, true);
    line(s, p.x + 28, 397, p.w - 56, p.name === "PRO" ? "#4A4440" : "#BDB4AA", 1);
    p.lines.forEach((item, i) => {
      text(s, `+  ${item}`, p.x + 28, 427 + i * 39, p.w - 56, 28, 16, p.c, i === 0);
    });
  }
  text(s, "Prezzi indicativi. Attivazione, dominio e condizioni commerciali vengono definiti nella proposta.", 64, 633, 900, 26, 14, C.taupe);
  footer(s, 10);
  s.speakerNotes.textFrame.setText("Prezzi e soglie corrispondono alla proposta commerciale attuale del progetto e restano indicativi fino alla definizione del contratto.");
}

// 11 — close
{
  const s = presentation.slides.add();
  s.background.fill = C.coal;
  await addImage(s, path.join(assets, "hair-stylist-editoriale.webp"), 760, 0, 520, 720, "Hair stylist al lavoro", "cover");
  shape(s, 0, 0, 760, 720, C.coal);
  shape(s, 64, 62, 54, 8, C.coral);
  text(s, "PROSSIMO PASSO", 64, 90, 220, 22, 12, C.blush, true);
  text(s, "Una demo costruita\nsul tuo salone", 64, 145, 610, 138, 56, C.cream, true);
  text(s, "Portiamo logo, colori, listino, team e orari dentro il prodotto. Tu valuti l’esperienza come la vedranno i tuoi clienti.", 64, 329, 520, 100, 21, "#D2CBC3");
  shape(s, 64, 482, 500, 74, C.coral, 14);
  text(s, "PREPARIAMO LA TUA DEMO", 105, 506, 420, 30, 20, C.coal, true);
  text(s, "SALON SUITE", 64, 629, 220, 25, 16, C.white, true);
  s.speakerNotes.textFrame.setText("Chiusura commerciale. La fotografia proviene dagli asset dimostrativi del progetto.");
}

await fs.mkdir(path.join(workspaceDir, "output"), { recursive: true });
const stagingDir = path.join(workspaceDir, ".codex-finalizer-v4");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "salon-suite-clienti-fidelity-candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const requirements = {
  explicitTotalSlideCount: 11,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [8],
  requiredEmbeddedWorkbookChartOwnerSlides: [],
  materializeLiteralChartWorkbooks: true,
};
const result = await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  fontPolicy: { basis: "design", families: [font] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "Salon-Suite-Presentazione-Clienti-Finale.validation.json"),
});
console.log(JSON.stringify({ finalPath: FINAL_PPTX, result }, null, 2));
