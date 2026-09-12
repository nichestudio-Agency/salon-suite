import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import type { Booking, BookingStatus } from "../domain/models";
import { db } from "./app";

export type BookingWithId = Booking & { id: string };

const statusOrder: Record<BookingStatus, number> = {
  in_attesa: 0,
  confermata: 1,
  completata: 2,
  no_show: 3,
  rifiutata: 4,
  annullata: 5,
};
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export async function listBookings(salonId: string): Promise<BookingWithId[]> {
  const snap = await getDocs(collection(db, "salons", salonId, "bookings"));
  return snap.docs
    .map((booking) => {
      const item = { id: booking.id, ...(booking.data() as Booking) };
      if (/^demo-(hair-)?today-/.test(item.id)) item.date = localDate(new Date());
      const week = item.id.match(/^demo-week-(\d+)$/);
      if (week) { const date = new Date(); date.setDate(date.getDate() - Number(week[1])); item.date = localDate(date); }
      return item;
    })
    .sort(
      (a, b) =>
        statusOrder[a.stato] - statusOrder[b.stato] ||
        a.date.localeCompare(b.date) ||
        a.startMin - b.startMin,
    );
}

export async function updateBookingStatus(
  salonId: string,
  bookingId: string,
  stato: Extract<BookingStatus, "confermata" | "rifiutata">,
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "bookings", bookingId), { stato });
}
