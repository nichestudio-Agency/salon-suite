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
});
