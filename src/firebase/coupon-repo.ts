import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { db } from "./app";
import type { Coupon } from "../domain/models";

export type CouponWithId = Coupon & { id: string };
export interface CouponAnalytics {
  couponId: string;
  inviati: number;
  utilizzati: number;
  nonUtilizzati: number;
  scaduti: number;
  recipientIds: string[];
  usedClientIds: string[];
}

const couponsCol = (salonId: string) =>
  collection(db, "salons", salonId, "coupons");

export async function listCoupons(salonId: string): Promise<CouponWithId[]> {
  const snap = await getDocs(couponsCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Coupon) }));
}

export async function createCoupon(salonId: string, data: Coupon): Promise<string> {
  const ref = await addDoc(couponsCol(salonId), { ...data, codice: data.codice.trim().toUpperCase() });
  return ref.id;
}

export async function updateCoupon(
  salonId: string, id: string, data: Partial<Coupon>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "coupons", id), {
    ...data,
    ...(data.codice ? { codice: data.codice.trim().toUpperCase() } : {}),
  });
}

export async function getCouponAnalytics(
  salonId: string,
  coupons: CouponWithId[],
): Promise<CouponAnalytics[]> {
  const [campaignsSnap, redemptionsSnap] = await Promise.all([
    getDocs(collection(db, "salons", salonId, "campaigns")),
    getDocs(collection(db, "salons", salonId, "couponRedemptions")),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  return coupons.map((coupon) => {
    const recipients = new Set<string>();
    let legacyRecipients = 0;
    for (const campaignDoc of campaignsSnap.docs) {
      const campaign = campaignDoc.data();
      if (campaign.couponId !== coupon.id) continue;
      if (Array.isArray(campaign.recipientIds)) {
        campaign.recipientIds.forEach((id: unknown) => {
          if (typeof id === "string") recipients.add(id);
        });
      } else {
        legacyRecipients += Number(campaign.recipientCount) || 0;
      }
    }
    const usedClients = new Set<string>();
    for (const redemptionDoc of redemptionsSnap.docs) {
      const redemption = redemptionDoc.data();
      if (redemption.couponId === coupon.id && typeof redemption.clientId === "string") {
        usedClients.add(redemption.clientId);
      }
    }
    const inviati = recipients.size + legacyRecipients;
    const utilizzati = usedClients.size;
    const nonUtilizzati = Math.max(inviati - utilizzati, 0);
    const expired = (coupon.scadenza && coupon.scadenza < today)
      || (coupon.dataAppuntamento && coupon.dataAppuntamento < today);
    return {
      couponId: coupon.id,
      inviati,
      utilizzati,
      nonUtilizzati,
      scaduti: expired ? nonUtilizzati : 0,
      recipientIds: [...recipients],
      usedClientIds: [...usedClients],
    };
  });
}

export async function deleteCoupon(salonId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, "salons", salonId, "coupons", id));
}
