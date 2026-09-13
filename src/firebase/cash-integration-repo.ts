import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import type { CashIntegrationConfig, Sale } from "../domain/models";
import { db, functions } from "./app";

export const DEFAULT_CASH_INTEGRATION: CashIntegrationConfig = {
  mode: "manuale",
  status: "operativa",
  providerName: "",
  storeReference: "",
  closeBookingsFromReceipts: false,
  creditLoyaltyFromReceipts: false,
  syncProductCatalog: false,
};

export interface CashActivityItem {
  id: string;
  date: string;
  customer: string;
  total: number;
  source: "salon_suite" | "external";
  externalReceiptId?: string;
}

export interface RecordManualSaleInput {
  salonId: string;
  sourceId: string;
  clientId?: string;
  clientSource?: "account" | "manual";
  amount: number;
  description: string;
  itemType: "servizio" | "prodotto";
  date: string;
}

export interface RecordManualSaleResult {
  saleId: string;
  alreadyProcessed: boolean;
  puntiAccreditati: number;
}

export async function getCashIntegration(
  salonId: string,
): Promise<CashIntegrationConfig> {
  const snap = await getDoc(doc(db, "salons", salonId));
  return {
    ...DEFAULT_CASH_INTEGRATION,
    ...(snap.data()?.cashIntegration ?? {}),
  };
}

export async function saveCashIntegration(
  salonId: string,
  value: CashIntegrationConfig,
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId), {
    cashIntegration: { ...value, updatedAtMs: Date.now() },
  });
}

export async function listCashActivity(
  salonId: string,
): Promise<CashActivityItem[]> {
  const snap = await getDocs(collection(db, `salons/${salonId}/sales`));
  return snap.docs
    .map((item) => {
      const sale = item.data() as Sale;
      return {
        id: item.id,
        date: sale.date,
        customer: sale.clientNome || "Cliente di passaggio",
        total: Number(sale.totale) || 0,
        source: sale.cashRegister?.source ?? "salon_suite",
        externalReceiptId: sale.cashRegister?.externalReceiptId,
      } satisfies CashActivityItem;
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);
}

export async function recordManualSale(input: RecordManualSaleInput): Promise<RecordManualSaleResult> {
  const callable = httpsCallable<RecordManualSaleInput, RecordManualSaleResult>(functions, "recordManualSale");
  return (await callable(input)).data;
}
