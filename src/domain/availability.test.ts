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
