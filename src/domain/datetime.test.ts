import { describe, it, expect } from "vitest";
import { weekdayOf, isValidDateKey } from "./datetime";

describe("weekdayOf", () => {
  it("restituisce il giorno della settimana in formato breve italiano", () => {
    // 2026-08-24 è un lunedì.
    expect(weekdayOf("2026-08-24")).toBe("lun");
    expect(weekdayOf("2026-08-25")).toBe("mar");
    expect(weekdayOf("2026-08-30")).toBe("dom");
  });
});

describe("isValidDateKey", () => {
  it("accetta solo il formato YYYY-MM-DD valido", () => {
    expect(isValidDateKey("2026-08-24")).toBe(true);
    expect(isValidDateKey("2026-8-24")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("not-a-date")).toBe(false);
  });
});
