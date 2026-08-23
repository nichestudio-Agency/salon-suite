import { describe, it, expect } from "vitest";
import { birthdaysToday, isLeapYear } from "./birthday";

const people = [
  { clientId: "a", dataNascita: "1990-06-15" },
  { clientId: "b", dataNascita: "1985-06-15" },
  { clientId: "c", dataNascita: "2000-02-29" },
  { clientId: "d", dataNascita: "1995-12-01" },
];

describe("birthdaysToday", () => {
  it("seleziona chi compie gli anni oggi (per mese-giorno)", () => {
    expect(birthdaysToday(people, "2026-06-15").sort()).toEqual(["a", "b"]);
    expect(birthdaysToday(people, "2026-12-01")).toEqual(["d"]);
    expect(birthdaysToday(people, "2026-07-04")).toEqual([]);
  });

  it("in anno bisestile i nati il 29/2 festeggiano il 29/2", () => {
    expect(birthdaysToday(people, "2028-02-29")).toEqual(["c"]); // 2028 bisestile
  });

  it("in anno non bisestile i nati il 29/2 festeggiano il 28/2", () => {
    expect(birthdaysToday(people, "2026-02-28")).toEqual(["c"]); // 2026 non bisestile
    expect(birthdaysToday(people, "2028-02-28")).toEqual([]); // bisestile: nessuno il 28
  });

  it("data odierna non valida → nessuno", () => {
    expect(birthdaysToday(people, "non-una-data")).toEqual([]);
  });
});

describe("isLeapYear", () => {
  it("riconosce gli anni bisestili", () => {
    expect(isLeapYear(2028)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
  });
});
