import { beforeEach, describe, expect, it } from "vitest";
import {
  clearDemoBrandPreview,
  demoBrandFromSearch,
  mixWithWhite,
  readDemoBrandPreview,
  readableAccentOnDark,
  readableAccentOnLight,
  readableOn,
  storeDemoBrandPreview,
  supportTone,
} from "./demo-brand-preview";

describe("demo brand preview", () => {
  beforeEach(() => clearDemoBrandPreview());

  it("reads, sanitizes and persists a presentation brand", () => {
    const preview = demoBrandFromSearch(new URLSearchParams({
      nome: "Atelier Aurora",
      logo: "https://example.com/logo.png",
      accento: "#ffffff",
      supporto: "#17212b",
    }));
    expect(preview).toEqual({ name: "Atelier Aurora", logo: "https://example.com/logo.png", accent: "#ffffff", support: "#17212b" });
    storeDemoBrandPreview(preview!);
    expect(readDemoBrandPreview()).toEqual(preview);
  });

  it("chooses readable text for light and dark accents", () => {
    expect(readableOn("#ffffff")).toBe("#18201b");
    expect(readableOn("#000000")).toBe("#ffffff");
    expect(readableAccentOnLight("#ffffff")).toBe("#343733");
    expect(readableAccentOnLight("#000000")).toBe("#000000");
    expect(readableAccentOnDark("#ffffff")).toBe("#ffffff");
    expect(readableAccentOnDark("#000000")).toBe("#f4f7f4");
  });

  it("creates a subtle support surface", () => {
    expect(mixWithWhite("#000000", .2)).toBe("#cccccc");
    expect(mixWithWhite("#ffffff", .2)).toBe("#ffffff");
    expect(supportTone("#ffffff", .2)).not.toBe("#ffffff");
    expect(supportTone("#000000", .2)).toBe("#cccccc");
  });
});
