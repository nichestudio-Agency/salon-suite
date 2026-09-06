import { describe, expect, it } from "vitest";
import { getSalonExperience } from "./salon-experience";

describe("getSalonExperience", () => {
  it("mantiene la barberia come esperienza predefinita", () => {
    const experience = getSalonExperience();

    expect(experience.type).toBe("barberia");
    expect(experience.heroWords).toEqual(["Barber", "Shop"]);
    expect(experience.professional).toBe("Barber");
  });

  it("restituisce contenuti e immagini dedicati alla parrucchieria", () => {
    const experience = getSalonExperience("parrucchieria");

    expect(experience.type).toBe("parrucchieria");
    expect(experience.heroWords).toEqual(["Hair", "Studio"]);
    expect(experience.professional).toBe("Stylist");
    expect(experience.images.editorial).toContain("hair-editorial");
  });

  it("sostituisce le immagini predefinite con gli asset del tenant", () => {
    const experience = getSalonExperience("barberia", {
      backgroundColor: "#111111", foregroundColor: "#ffffff", accentColor: "#cc5522",
      heroImageUrl: "https://assets.test/hero.webp",
      treatmentImageUrl: "https://assets.test/treatment.webp",
    });
    expect(experience.images.editorial).toBe("https://assets.test/hero.webp");
    expect(experience.images.treatment).toBe("https://assets.test/treatment.webp");
    expect(experience.images.products).toContain("barber-tools");
  });
});
