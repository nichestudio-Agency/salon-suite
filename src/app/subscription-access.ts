import { useEffect, useMemo, useState } from "react";
import type { SalonLicense, SubscriptionFeatureKey, SubscriptionPlansConfig } from "../domain/models";
import { DEFAULT_SUBSCRIPTION_PLANS, getSubscriptionPlansConfig } from "../firebase/platform-admin";
import { useSalonTenant } from "./salon-tenant-context";

const ALL_FEATURES: SubscriptionFeatureKey[] = [
  "agenda", "clienti", "servizi_team", "prodotti_ordini", "marketing",
  "fidelity", "statistiche", "integrazioni", "importazione", "app_cliente",
];

export function hasSubscriptionFeature(
  feature: SubscriptionFeatureKey,
  config: SubscriptionPlansConfig,
  license?: SalonLicense,
): boolean {
  if (!license) return true;
  const temporary = license.funzionalitaTemporanee?.find((item) => item.funzione === feature);
  if (temporary?.scadeIl && temporary.scadeIl >= new Date().toISOString().slice(0, 10)) return true;
  const override = license.funzionalitaPersonalizzate?.[feature];
  if (override !== undefined) return override;
  return config.piani[license.piano]?.funzionalita.includes(feature) ?? false;
}

export function useSubscriptionAccess() {
  const { salon } = useSalonTenant();
  const [config, setConfig] = useState<SubscriptionPlansConfig>(DEFAULT_SUBSCRIPTION_PLANS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void getSubscriptionPlansConfig()
      .then((value) => { if (active) setConfig(value); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const access = useMemo(() => new Set(
    ALL_FEATURES.filter((feature) => hasSubscriptionFeature(feature, config, salon?.licenza)),
  ), [config, salon?.licenza]);

  return { loading, config, has: (feature: SubscriptionFeatureKey) => access.has(feature) };
}
