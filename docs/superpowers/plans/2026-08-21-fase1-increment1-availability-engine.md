# Fase 1 · Increment 1 — Fondamenta + Motore di disponibilità — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impostare il progetto e implementare in TDD il motore puro di calcolo disponibilità del calendario (scaglionamento per durata, passo configurabile), senza dipendenze da Firebase.

**Architecture:** Un progetto Vite + React + TypeScript per la PWA cliente/dashboard, con la logica di dominio isolata in `src/domain/` come funzioni pure e senza effetti collaterali. Il motore di disponibilità lavora su "minuti dalla mezzanotte" (interi 0–1440), così è indipendente da fusi orari e da Firestore; l'aggancio ai dati reali avverrà in un incremento successivo. I test girano con Vitest.

**Tech Stack:** Vite, React, TypeScript, Vitest. (Firebase e Cloud Functions arriveranno negli incrementi successivi.)

---

## Struttura file (Increment 1)

- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx` — scaffolding Vite/React/TS.
- Create: `src/domain/time.ts` — helper conversione orari `"HH:MM"` ↔ minuti e tipo `Interval`.
- Create: `src/domain/time.test.ts` — test dei helper.
- Create: `src/domain/availability.ts` — motore puro: `mergeIntervals`, `subtractIntervals`, `generateStartTimes`, `resolveWorkingHours`, `computeAvailableStartTimes`.
- Create: `src/domain/availability.test.ts` — test del motore, con focus sui casi limite.

Ogni file di dominio ha una responsabilità unica: `time.ts` = rappresentazione del tempo; `availability.ts` = calcolo disponibilità. Nessuno dei due importa React o Firebase.

---

### Task 1: Scaffolding del progetto

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Scaffold Vite React+TS**

Run:
```bash
cd "/Users/fabio_pace/App Barber Shop"
npm create vite@latest . -- --template react-ts
```
Se la cartella non è vuota, Vite chiede conferma: scegli "Ignore files and continue". Questo crea `package.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`.

- [ ] **Step 2: Installa le dipendenze + Vitest**

Run:
```bash
cd "/Users/fabio_pace/App Barber Shop"
npm install
npm install -D vitest
```
Expected: installazione senza errori; `vitest` compare in `devDependencies`.

- [ ] **Step 3: Aggiungi lo script di test**

Modifica `package.json` aggiungendo nella sezione `"scripts"` la riga:
```json
"test": "vitest run"
```

- [ ] **Step 4: Verifica che il progetto parta**

Run:
```bash
cd "/Users/fabio_pace/App Barber Shop"
npm run build
```
Expected: build completata senza errori (genera `dist/`).

- [ ] **Step 5: Commit**

```bash
cd "/Users/fabio_pace/App Barber Shop"
git add -A
git commit -m "chore: scaffold Vite + React + TS + Vitest"
```

---

### Task 2: Helper del tempo (`Interval` e conversione HH:MM)

**Files:**
- Create: `src/domain/time.ts`
- Test: `src/domain/time.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Create `src/domain/time.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hm, toHM } from "./time";

describe("hm", () => {
  it("converte HH:MM in minuti dalla mezzanotte", () => {
    expect(hm("00:00")).toBe(0);
    expect(hm("09:00")).toBe(540);
    expect(hm("11:30")).toBe(690);
    expect(hm("13:00")).toBe(780);
    expect(hm("23:59")).toBe(1439);
  });
});

describe("toHM", () => {
  it("converte i minuti in HH:MM con zero-padding", () => {
    expect(toHM(0)).toBe("00:00");
    expect(toHM(540)).toBe("09:00");
    expect(toHM(690)).toBe("11:30");
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/time.test.ts`
Expected: FAIL — modulo `./time` non trovato / `hm` non definita.

- [ ] **Step 3: Implementazione minima**

Create `src/domain/time.ts`:
```ts
/** Intervallo semiaperto [start, end) espresso in minuti dalla mezzanotte (0..1440). */
export interface Interval {
  start: number;
  end: number;
}

/** "HH:MM" -> minuti dalla mezzanotte. */
export function hm(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** minuti dalla mezzanotte -> "HH:MM" con zero-padding. */
export function toHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/time.test.ts`
Expected: PASS (2 test verdi).

- [ ] **Step 5: Commit**

```bash
git add src/domain/time.ts src/domain/time.test.ts
git commit -m "feat(domain): helper Interval e conversione HH:MM"
```

---

### Task 3: `mergeIntervals` (fusione intervalli sovrapposti)

**Files:**
- Create: `src/domain/availability.ts`
- Test: `src/domain/availability.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Create `src/domain/availability.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mergeIntervals } from "./availability";

describe("mergeIntervals", () => {
  it("ordina e fonde intervalli che si toccano o sovrappongono", () => {
    expect(
      mergeIntervals([
        { start: 690, end: 720 },
        { start: 540, end: 600 },
      ])
    ).toEqual([
      { start: 540, end: 600 },
      { start: 690, end: 720 },
    ]);

    expect(
      mergeIntervals([
        { start: 540, end: 620 },
        { start: 600, end: 700 },
      ])
    ).toEqual([{ start: 540, end: 700 }]);

    expect(
      mergeIntervals([
        { start: 540, end: 600 },
        { start: 600, end: 660 },
      ])
    ).toEqual([{ start: 540, end: 660 }]);
  });

  it("gestisce l'array vuoto", () => {
    expect(mergeIntervals([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: FAIL — `mergeIntervals` non definita.

- [ ] **Step 3: Implementazione minima**

Create `src/domain/availability.ts`:
```ts
import type { Interval } from "./time";

/** Ordina per inizio e fonde gli intervalli che si sovrappongono o si toccano. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }
  return merged;
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/availability.ts src/domain/availability.test.ts
git commit -m "feat(domain): mergeIntervals"
```

---

### Task 4: `subtractIntervals` (orari di lavoro meno gli impegni)

**Files:**
- Modify: `src/domain/availability.ts`
- Test: `src/domain/availability.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `src/domain/availability.test.ts`:
```ts
import { subtractIntervals } from "./availability";

describe("subtractIntervals", () => {
  it("rimuove gli intervalli occupati dagli orari di lavoro", () => {
    // Lavoro 9:00-13:00 (540-780), occupato 9:00-10:00 e 11:30-12:00.
    const free = subtractIntervals(
      [{ start: 540, end: 780 }],
      [
        { start: 540, end: 600 },
        { start: 690, end: 720 },
      ]
    );
    expect(free).toEqual([
      { start: 600, end: 690 }, // 10:00-11:30
      { start: 720, end: 780 }, // 12:00-13:00
    ]);
  });

  it("nessun impegno -> restituisce l'intero orario di lavoro", () => {
    expect(subtractIntervals([{ start: 540, end: 780 }], [])).toEqual([
      { start: 540, end: 780 },
    ]);
  });

  it("operatore completamente occupato -> nessun intervallo libero", () => {
    expect(
      subtractIntervals(
        [{ start: 540, end: 600 }],
        [{ start: 540, end: 600 }]
      )
    ).toEqual([]);
  });

  it("gestisce due fasce di lavoro separate (pausa pranzo)", () => {
    // Lavoro 9:00-12:00 e 14:00-18:00; occupato 10:00-10:30.
    const free = subtractIntervals(
      [
        { start: 540, end: 720 },
        { start: 840, end: 1080 },
      ],
      [{ start: 600, end: 630 }]
    );
    expect(free).toEqual([
      { start: 540, end: 600 },
      { start: 630, end: 720 },
      { start: 840, end: 1080 },
    ]);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: FAIL — `subtractIntervals` non definita.

- [ ] **Step 3: Implementazione minima**

Aggiungi a `src/domain/availability.ts`:
```ts
/** Restituisce le porzioni libere di `base` dopo aver tolto gli intervalli `busy`. */
export function subtractIntervals(base: Interval[], busy: Interval[]): Interval[] {
  const mergedBusy = mergeIntervals(busy);
  const result: Interval[] = [];
  for (const b of base) {
    let cursor = b.start;
    for (const x of mergedBusy) {
      if (x.end <= cursor || x.start >= b.end) continue; // nessuna sovrapposizione utile
      if (x.start > cursor) result.push({ start: cursor, end: x.start });
      cursor = Math.max(cursor, x.end);
      if (cursor >= b.end) break;
    }
    if (cursor < b.end) result.push({ start: cursor, end: b.end });
  }
  return result;
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: PASS (tutti i test di questo file verdi).

- [ ] **Step 5: Commit**

```bash
git add src/domain/availability.ts src/domain/availability.test.ts
git commit -m "feat(domain): subtractIntervals"
```

---

### Task 5: `generateStartTimes` (orari di inizio col passo, allineati alla griglia)

**Files:**
- Modify: `src/domain/availability.ts`
- Test: `src/domain/availability.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `src/domain/availability.test.ts`:
```ts
import { generateStartTimes } from "./availability";

describe("generateStartTimes", () => {
  it("passo 15 min: riproduce l'esempio approvato (servizio da 30')", () => {
    // Liberi 10:00-11:30 (600-690) e 12:00-13:00 (720-780).
    const starts = generateStartTimes(
      [
        { start: 600, end: 690 },
        { start: 720, end: 780 },
      ],
      30,
      15
    );
    // 11:15 (675) escluso: 675+30=705 supererebbe le 11:30.
    expect(starts).toEqual([600, 615, 630, 645, 660, 720, 735, 750]);
  });

  it("passo 30 min: stesse fasce, meno orari", () => {
    const starts = generateStartTimes(
      [
        { start: 600, end: 690 },
        { start: 720, end: 780 },
      ],
      30,
      30
    );
    expect(starts).toEqual([600, 630, 660, 720, 750]);
  });

  it("buco più corto della durata -> nessun orario", () => {
    // Libero solo 10:00-10:20 (20 min), servizio da 30 min.
    expect(generateStartTimes([{ start: 600, end: 620 }], 30, 15)).toEqual([]);
  });

  it("allinea l'inizio alla griglia del passo", () => {
    // Libero 10:07-10:50: il primo inizio valido col passo 15 è 10:15 (615);
    // 10:30 (630) escluso perché 630+30=660 supererebbe le 10:50 (650).
    expect(generateStartTimes([{ start: 607, end: 650 }], 30, 15)).toEqual([
      615,
    ]);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: FAIL — `generateStartTimes` non definita.

- [ ] **Step 3: Implementazione minima**

Aggiungi a `src/domain/availability.ts`:
```ts
/**
 * Enumera gli orari di inizio (minuti dalla mezzanotte) allineati alla griglia
 * del passo `stepMin`, tenendo solo quelli in cui [inizio, inizio+durataMin]
 * rientra interamente in un intervallo libero.
 */
export function generateStartTimes(
  free: Interval[],
  durationMin: number,
  stepMin: number
): number[] {
  const starts: number[] = [];
  for (const iv of free) {
    let start = Math.ceil(iv.start / stepMin) * stepMin;
    while (start + durationMin <= iv.end) {
      starts.push(start);
      start += stepMin;
    }
  }
  return starts;
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/availability.ts src/domain/availability.test.ts
git commit -m "feat(domain): generateStartTimes allineati alla griglia"
```

---

### Task 6: `resolveWorkingHours` (orari ibridi: salone + override operatore)

**Files:**
- Modify: `src/domain/availability.ts`
- Test: `src/domain/availability.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `src/domain/availability.test.ts`:
```ts
import { resolveWorkingHours, type WeeklyHours } from "./availability";

const salonHours: WeeklyHours = {
  lun: [{ start: 540, end: 1140 }], // 9:00-19:00
  mar: [{ start: 540, end: 1140 }],
  // mercoledì assente = salone chiuso
};

describe("resolveWorkingHours", () => {
  it("usa gli orari del salone quando l'operatore non ha override", () => {
    expect(resolveWorkingHours(salonHours, undefined, "lun")).toEqual([
      { start: 540, end: 1140 },
    ]);
  });

  it("usa l'override dell'operatore quando presente per quel giorno", () => {
    const opHours: WeeklyHours = { lun: [{ start: 600, end: 780 }] }; // part-time 10-13
    expect(resolveWorkingHours(salonHours, opHours, "lun")).toEqual([
      { start: 600, end: 780 },
    ]);
  });

  it("giorno di chiusura del salone -> nessun orario", () => {
    expect(resolveWorkingHours(salonHours, undefined, "mer")).toEqual([]);
  });

  it("override con giorno libero esplicito (array vuoto) -> nessun orario", () => {
    const opHours: WeeklyHours = { lun: [] }; // operatore libero il lunedì
    expect(resolveWorkingHours(salonHours, opHours, "lun")).toEqual([]);
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: FAIL — `resolveWorkingHours` / `WeeklyHours` non definiti.

- [ ] **Step 3: Implementazione minima**

Aggiungi a `src/domain/availability.ts`:
```ts
export type Weekday = "lun" | "mar" | "mer" | "gio" | "ven" | "sab" | "dom";

/** Orari settimanali: per ogni giorno, zero o più fasce di lavoro. */
export type WeeklyHours = Partial<Record<Weekday, Interval[]>>;

/**
 * Risolve gli orari di lavoro effettivi per un giorno, con logica ibrida:
 * se l'operatore ha un override per quel giorno (anche array vuoto = libero)
 * vince quello, altrimenti valgono gli orari del salone.
 */
export function resolveWorkingHours(
  salon: WeeklyHours,
  operator: WeeklyHours | undefined,
  day: Weekday
): Interval[] {
  if (operator && Object.prototype.hasOwnProperty.call(operator, day)) {
    return operator[day] ?? [];
  }
  return salon[day] ?? [];
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/availability.ts src/domain/availability.test.ts
git commit -m "feat(domain): resolveWorkingHours (orari ibridi)"
```

---

### Task 7: `computeAvailableStartTimes` (orchestratore end-to-end)

**Files:**
- Modify: `src/domain/availability.ts`
- Test: `src/domain/availability.test.ts`

- [ ] **Step 1: Scrivi il test che fallisce**

Aggiungi in fondo a `src/domain/availability.test.ts`:
```ts
import { computeAvailableStartTimes } from "./availability";

describe("computeAvailableStartTimes", () => {
  it("scenario completo dall'esempio approvato", () => {
    // Salone lun 9:00-13:00, operatore senza override.
    // Occupato 9:00-10:00 e 11:30-12:00. Servizio 30', passo 15'.
    const starts = computeAvailableStartTimes({
      salonHours: { lun: [{ start: 540, end: 780 }] },
      operatorHours: undefined,
      day: "lun",
      busy: [
        { start: 540, end: 600 },
        { start: 690, end: 720 },
      ],
      durationMin: 30,
      stepMin: 15,
    });
    expect(starts).toEqual([600, 615, 630, 645, 660, 720, 735, 750]);
  });

  it("giorno di chiusura -> nessuna disponibilità", () => {
    const starts = computeAvailableStartTimes({
      salonHours: { lun: [{ start: 540, end: 780 }] },
      operatorHours: undefined,
      day: "mer",
      busy: [],
      durationMin: 30,
      stepMin: 15,
    });
    expect(starts).toEqual([]);
  });

  it("l'override part-time dell'operatore restringe la disponibilità", () => {
    const starts = computeAvailableStartTimes({
      salonHours: { lun: [{ start: 540, end: 1140 }] }, // 9-19
      operatorHours: { lun: [{ start: 600, end: 660 }] }, // 10-11
      day: "lun",
      busy: [],
      durationMin: 30,
      stepMin: 15,
    });
    expect(starts).toEqual([600, 615, 630]); // 10:00,10:15,10:30 (10:30+30=11:00 ok)
  });
});
```

- [ ] **Step 2: Esegui il test per verificare che fallisca**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: FAIL — `computeAvailableStartTimes` non definita.

- [ ] **Step 3: Implementazione minima**

Aggiungi a `src/domain/availability.ts`:
```ts
export interface AvailabilityInput {
  salonHours: WeeklyHours;
  operatorHours: WeeklyHours | undefined;
  day: Weekday;
  busy: Interval[]; // prenotazioni in_attesa + confermate dell'operatore quel giorno
  durationMin: number;
  stepMin: number;
}

/**
 * Orchestratore: orari di lavoro effettivi -> sottrai gli impegni ->
 * genera gli orari di inizio col passo. Restituisce minuti dalla mezzanotte.
 */
export function computeAvailableStartTimes(input: AvailabilityInput): number[] {
  const working = resolveWorkingHours(
    input.salonHours,
    input.operatorHours,
    input.day
  );
  if (working.length === 0) return [];
  const free = subtractIntervals(working, input.busy);
  return generateStartTimes(free, input.durationMin, input.stepMin);
}
```

- [ ] **Step 4: Esegui il test per verificare che passi**

Run: `npx vitest run src/domain/availability.test.ts`
Expected: PASS (tutti i test del motore verdi).

- [ ] **Step 5: Esegui l'intera suite**

Run: `npm run test`
Expected: PASS — tutti i test (`time.test.ts` + `availability.test.ts`) verdi.

- [ ] **Step 6: Commit**

```bash
git add src/domain/availability.ts src/domain/availability.test.ts
git commit -m "feat(domain): computeAvailableStartTimes (orchestratore)"
```

---

## Verifica di completamento Increment 1

- [ ] `npm run test` → tutti verdi
- [ ] `npm run build` → build ok
- [ ] Il motore riproduce esattamente l'esempio approvato dall'utente (servizio 30', passo 15' → 10:00,10:15,10:30,10:45,11:00,12:00,12:15,12:30; 11:15 escluso)

## Cosa NON è in questo incremento (arriva dopo)

- Firebase (Auth, Firestore, Functions, FCM), Security Rules → Increment 2
- Conversione timestamp Firestore ↔ minuti-del-giorno + fuso orario del salone → Increment 2
- UI dashboard e app cliente → Increment 3–4
- Transazione anti doppia-prenotazione → Increment 4 (userà questo motore per validare)
