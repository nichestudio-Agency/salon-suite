import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db } from "./app";
import { functions } from "./app";
import type { Order, OrderStatus, OrderWithId } from "../domain/models";

export type { OrderWithId } from "../domain/models";

const statusOrder: Record<OrderStatus, number> = {
  in_attesa: 0, pronto: 1, ritirato: 2, annullato: 3,
};

export async function listSalonOrders(salonId: string): Promise<OrderWithId[]> {
  const snap = await getDocs(collection(db, "salons", salonId, "orders"));
  return snap.docs
    .map((o) => ({ id: o.id, ...(o.data() as Order) }))
    .sort((a, b) => statusOrder[a.stato] - statusOrder[b.stato]);
}

export async function updateOrderStatus(
  salonId: string,
  orderId: string,
  stato: Extract<OrderStatus, "pronto" | "ritirato" | "annullato">,
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "orders", orderId), { stato });
}

export interface CompleteOrderResult {
  orderId: string;
  saleId: string;
  alreadyProcessed: boolean;
  puntiAccreditati: number;
}

export async function completeOrder(salonId: string, orderId: string): Promise<CompleteOrderResult> {
  const callable = httpsCallable<{ salonId: string; orderId: string }, CompleteOrderResult>(functions, "completeOrder");
  return (await callable({ salonId, orderId })).data;
}
