import { httpsCallable } from "firebase/functions";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { auth, db, functions } from "./app";
import type { Order } from "../domain/models";

export type OrderWithId = Order & { id: string };

export interface CreateOrderInput {
  salonId: string;
  items: { productId: string; qta: number }[];
}
export interface CreateOrderResult {
  orderId: string;
  totale: number;
  stato: "in_attesa";
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const callable = httpsCallable<CreateOrderInput, CreateOrderResult>(functions, "createOrder");
  const res = await callable(input);
  return res.data;
}

export async function listMyOrders(salonId: string): Promise<OrderWithId[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utente non autenticato.");
  const snap = await getDocs(
    query(collection(db, "salons", salonId, "orders"), where("clientId", "==", uid)),
  );
  return snap.docs.map((o) => ({ id: o.id, ...(o.data() as Order) }));
}

export async function cancelOrder(salonId: string, orderId: string): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "orders", orderId), { stato: "annullato" });
}
