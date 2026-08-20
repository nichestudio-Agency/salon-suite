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
