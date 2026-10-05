import { httpsCallable } from "firebase/functions";
import type { SubscriptionFeatureKey } from "../domain/models";
import { functions } from "./app";

export async function activateFeatureTrial(feature: SubscriptionFeatureKey) {
  const callable = httpsCallable<
    { feature: SubscriptionFeatureKey },
    { success: boolean; salonId: string; scadeIl: string; giorni: number }
  >(functions, "requestFeatureTrial");
  return (await callable({ feature })).data;
}
