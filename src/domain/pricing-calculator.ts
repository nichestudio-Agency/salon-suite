export interface CommercialQuoteInput {
  monthlyPriceCents: number;
  billingCycle: "monthly" | "annual";
  locations: number;
  additionalLocationDiscountPercent: number;
  commercialDiscountPercent: number;
  setupFeeCents: number;
  minimumMonthlyPerLocationCents: number;
  averageTicketCents: number;
}

export interface CommercialQuoteResult {
  listAnnualCents: number;
  annualPaymentDiscountCents: number;
  locationDiscountCents: number;
  commercialDiscountCents: number;
  totalDiscountCents: number;
  totalDiscountPercent: number;
  recurringAnnualCents: number;
  firstYearCents: number;
  effectiveMonthlyCents: number;
  effectiveMonthlyPerLocationCents: number;
  maximumCommercialDiscountPercent: number;
  remainingNegotiationPercent: number;
  breakEvenBookings: number;
  health: "healthy" | "attention" | "below_floor";
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
const money = (value: number) => Math.max(0, Math.round(value));

export function calculateCommercialQuote(input: CommercialQuoteInput): CommercialQuoteResult {
  const monthlyPrice = money(input.monthlyPriceCents);
  const locations = Math.max(1, Math.round(input.locations || 1));
  const locationDiscountRate = clamp(input.additionalLocationDiscountPercent, 0, 100) / 100;
  const commercialDiscountRate = clamp(input.commercialDiscountPercent, 0, 100) / 100;
  const billedMonths = input.billingCycle === "annual" ? 10 : 12;
  const perLocationBeforeLocationDiscount = monthlyPrice * billedMonths;
  const listAnnualCents = monthlyPrice * 12 * locations;
  const annualPaymentDiscountCents = input.billingCycle === "annual" ? monthlyPrice * 2 * locations : 0;
  const additionalLocationsValue = perLocationBeforeLocationDiscount * Math.max(0, locations - 1);
  const locationDiscountCents = money(additionalLocationsValue * locationDiscountRate);
  const beforeCommercialDiscount = perLocationBeforeLocationDiscount * locations - locationDiscountCents;
  const commercialDiscountCents = money(beforeCommercialDiscount * commercialDiscountRate);
  const recurringAnnualCents = money(beforeCommercialDiscount - commercialDiscountCents);
  const setupFeeCents = money(input.setupFeeCents);
  const firstYearCents = recurringAnnualCents + setupFeeCents;
  const totalDiscountCents = annualPaymentDiscountCents + locationDiscountCents + commercialDiscountCents;
  const totalDiscountPercent = listAnnualCents ? (totalDiscountCents / listAnnualCents) * 100 : 0;
  const effectiveMonthlyCents = money(recurringAnnualCents / 12);
  const effectiveMonthlyPerLocationCents = money(effectiveMonthlyCents / locations);
  const floorAnnual = money(input.minimumMonthlyPerLocationCents) * 12 * locations;
  const maximumCommercialDiscountPercent = beforeCommercialDiscount > 0
    ? clamp((1 - floorAnnual / beforeCommercialDiscount) * 100, 0, 100)
    : 0;
  const remainingNegotiationPercent = Math.max(0, maximumCommercialDiscountPercent - clamp(input.commercialDiscountPercent, 0, 100));
  const averageTicket = Math.max(1, money(input.averageTicketCents));
  const breakEvenBookings = Math.ceil(firstYearCents / averageTicket);
  const health = effectiveMonthlyPerLocationCents < money(input.minimumMonthlyPerLocationCents)
    ? "below_floor"
    : remainingNegotiationPercent < 3
      ? "attention"
      : "healthy";

  return {
    listAnnualCents,
    annualPaymentDiscountCents,
    locationDiscountCents,
    commercialDiscountCents,
    totalDiscountCents,
    totalDiscountPercent,
    recurringAnnualCents,
    firstYearCents,
    effectiveMonthlyCents,
    effectiveMonthlyPerLocationCents,
    maximumCommercialDiscountPercent,
    remainingNegotiationPercent,
    breakEvenBookings,
    health,
  };
}
