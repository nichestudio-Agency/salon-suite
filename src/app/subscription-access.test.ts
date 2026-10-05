import { describe, expect, it } from "vitest";
import { DEFAULT_SUBSCRIPTION_PLANS } from "../firebase/platform-admin";
import type { SalonLicense } from "../domain/models";
import { hasSubscriptionFeature } from "./subscription-access";

const studio: SalonLicense = {
  stato: "attiva",
  piano: "studio",
  scadenza: "2027-12-31",
  prezzoMensile: 7900,
};

describe("accesso funzionalità per abbonamento", () => {
  it("eredita le funzionalità dal piano", () => {
    expect(hasSubscriptionFeature("marketing", DEFAULT_SUBSCRIPTION_PLANS, studio)).toBe(true);
    expect(hasSubscriptionFeature("statistiche", DEFAULT_SUBSCRIPTION_PLANS, studio)).toBe(false);
  });

  it("applica eccezioni permanenti", () => {
    expect(hasSubscriptionFeature("statistiche", DEFAULT_SUBSCRIPTION_PLANS, {
      ...studio,
      funzionalitaPersonalizzate: { statistiche: true, marketing: false },
    })).toBe(true);
    expect(hasSubscriptionFeature("marketing", DEFAULT_SUBSCRIPTION_PLANS, {
      ...studio,
      funzionalitaPersonalizzate: { marketing: false },
    })).toBe(false);
  });

  it("riconosce soltanto le prove temporanee non scadute", () => {
    expect(hasSubscriptionFeature("statistiche", DEFAULT_SUBSCRIPTION_PLANS, {
      ...studio,
      funzionalitaTemporanee: [{ funzione: "statistiche", scadeIl: "2099-12-31" }],
    })).toBe(true);
    expect(hasSubscriptionFeature("statistiche", DEFAULT_SUBSCRIPTION_PLANS, {
      ...studio,
      funzionalitaTemporanee: [{ funzione: "statistiche", scadeIl: "2020-01-01" }],
    })).toBe(false);
  });
});
