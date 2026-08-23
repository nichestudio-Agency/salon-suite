import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import type { Booking, BookingStatus } from "../domain/models";
import { db } from "./app";

export type BookingWithId = Booking & { id: string };

const statusOrder: Record<BookingStatus, number> = {
  in_attesa: 0,
  confermata: 1,
  rifiutata: 2,
  annullata: 3,
};

export async function listBookings(salonId: string): Promise<BookingWithId[]> {
  const snap = await getDocs(collection(db, "salons", salonId, "bookings"));
  return snap.docs
    .map((booking) => ({ id: booking.id, ...(booking.data() as Booking) }))
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
