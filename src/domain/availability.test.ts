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
