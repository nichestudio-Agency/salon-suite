import { httpsCallable } from "firebase/functions";
import { functions } from "./app";
import type { CampaignFilters } from "../domain/models";

export interface SendCampaignInput {
  salonId: string;
  filtri: CampaignFilters;
  titolo: string;
  testo: string;
  couponId?: string;
}
export interface SendCampaignResult {
  campaignId: string;
  recipientCount: number;
}

export async function sendCampaign(input: SendCampaignInput): Promise<SendCampaignResult> {
  const callable = httpsCallable<SendCampaignInput, SendCampaignResult>(functions, "sendCampaign");
  const res = await callable(input);
  return res.data;
}
