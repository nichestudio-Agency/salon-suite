import { httpsCallable } from "firebase/functions";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, functions } from "./app";
import { listSalonClients } from "./client-repo";
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
  try { const callable = httpsCallable<SendCampaignInput, SendCampaignResult>(functions, "sendCampaign"); return (await callable(input)).data; }
  catch {
    const clients = await listSalonClients(input.salonId); const now = Date.now();
    const selected = clients.filter((client) => {
      if (input.filtri.recipientIds?.length && !input.filtri.recipientIds.includes(client.id)) return false;
      if (input.filtri.sesso && client.sesso !== input.filtri.sesso) return false;
      if (input.filtri.natoDa && client.dataNascita < input.filtri.natoDa) return false;
      if (input.filtri.natoA && client.dataNascita > input.filtri.natoA) return false;
      const lastVisit = client.lastVisitDate ?? client.lastBookingDate;
      if (input.filtri.bookingInactiveDays && lastVisit && (now - new Date(lastVisit + "T12:00:00").getTime()) / 86400000 < input.filtri.bookingInactiveDays) return false;
      if (input.filtri.productInactiveDays && client.lastOrderDate && (now - new Date(client.lastOrderDate + "T12:00:00").getTime()) / 86400000 < input.filtri.productInactiveDays) return false;
      return true;
    });
    const campaign = await addDoc(collection(db, `salons/${input.salonId}/campaigns`), { filtri: input.filtri, titolo: input.titolo, testo: input.testo, couponId: input.couponId ?? null, recipientCount: selected.length, recipientIds: selected.map((item) => item.id), sentAt: serverTimestamp() });
    await Promise.all(selected.map((client) => addDoc(collection(db, `salons/${input.salonId}/notifications`), { clientId: client.id, titolo: input.titolo, testo: input.testo, couponId: input.couponId ?? null, campaignId: campaign.id, read: false, createdAt: serverTimestamp() })));
    return { campaignId: campaign.id, recipientCount: selected.length };
  }
}
