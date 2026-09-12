import { describe, expect, it } from "vitest";
import { normalizeSalonAccessCode, parseSalonAccessCode } from "./salon-access";

describe("codice di accesso salone", () => {
  it("normalizza spazi e separatori", () => {
    expect(normalizeSalonAccessCode(" studio-7 k4p ")).toBe("STUDIO7K4P");
  });

  it("estrae il codice da un link QR", () => {
    expect(parseSalonAccessCode("https://app.example/salone/Studio7K4P")).toBe(
      "STUDIO7K4P",
    );
  });

  it("accetta anche il payload QR compatto", () => {
    expect(parseSalonAccessCode("salon-access:forma82XY")).toBe("FORMA82XY");
  });
});
