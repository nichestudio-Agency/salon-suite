import { describe, expect, it } from "vitest";
import { calculateCommercialQuote } from "./pricing-calculator";

describe("calculateCommercialQuote", () => {
  it("calcola due mesi inclusi, seconda sede e sconto commerciale", () => {
    const result = calculateCommercialQuote({
      monthlyPriceCents: 7900,
      billingCycle: "annual",
      locations: 2,
      additionalLocationDiscountPercent: 20,
      commercialDiscountPercent: 10,
      setupFeeCents: 0,
      minimumMonthlyPerLocationCents: 4000,
      averageTicketCents: 3500,
    });

    expect(result.listAnnualCents).toBe(189600);
    expect(result.annualPaymentDiscountCents).toBe(31600);
    expect(result.locationDiscountCents).toBe(15800);
    expect(result.commercialDiscountCents).toBe(14220);
    expect(result.recurringAnnualCents).toBe(127980);
    expect(result.effectiveMonthlyPerLocationCents).toBe(5333);
    expect(result.health).toBe("healthy");
  });

  it("segnala quando il prezzo effettivo scende sotto la soglia", () => {
    const result = calculateCommercialQuote({
      monthlyPriceCents: 4900,
      billingCycle: "annual",
      locations: 1,
      additionalLocationDiscountPercent: 0,
      commercialDiscountPercent: 25,
      setupFeeCents: 0,
      minimumMonthlyPerLocationCents: 3500,
      averageTicketCents: 3000,
    });

    expect(result.effectiveMonthlyPerLocationCents).toBe(3063);
    expect(result.health).toBe("below_floor");
    expect(result.remainingNegotiationPercent).toBe(0);
  });
});
