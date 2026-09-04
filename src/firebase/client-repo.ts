import { httpsCallable } from "firebase/functions";
import { functions } from "./app";
import type { Gender } from "../domain/models";

export interface SalonClient {
  id: string;
  nome: string;
  email: string;
  sesso: Gender;
  dataNascita: string;
  hasPush: boolean;
  bookingCount: number;
  lastBookingDate: string | null;
  orderCount: number;
  lastOrderDate: string | null;
  totalSpent: number;
}

export async function listSalonClients(salonId: string): Promise<SalonClient[]> {
  const callable = httpsCallable<{ salonId: string }, { clients: SalonClient[] }>(functions, "listSalonClients");
  return (await callable({ salonId })).data.clients;
}
