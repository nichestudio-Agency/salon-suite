import { httpsCallable } from "firebase/functions";
import { collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { auth, db, functions } from "./app";
import type { Booking } from "../domain/models";

export type BookingWithId = Booking & { id: string };

export interface CreateBookingInput {
  salonId: string;
  operatorId: string;
  serviceId: string;
  date: string;
  startMin: number;
  couponCode?: string;
}

export interface CreateBookingResult {
  bookingId: string;
  endMin: number;
  stato: "in_attesa";
  prezzoOriginale: number;
  sconto: number;
  prezzoFinale: number;
}

export interface GetAvailabilityInput {
  salonId: string;
  operatorId: string;
  serviceId: string;
  date: string;
}

export interface GetAvailabilityResult {
  date: string;
  durationMin: number;
  stepMin: number;
  starts: number[];
}

export async function getAvailability(
  input: GetAvailabilityInput,
): Promise<GetAvailabilityResult> {
  const callable = httpsCallable<GetAvailabilityInput, GetAvailabilityResult>(
    functions,
    "getAvailability",
  );
  const response = await callable(input);
  return response.data;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const callable = httpsCallable<CreateBookingInput, CreateBookingResult>(
    functions,
    "createBooking",
  );
  const response = await callable(input);
  return response.data;
}

export async function listMyBookings(salonId: string): Promise<BookingWithId[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Utente non autenticato.");
  const snap = await getDocs(
    query(
      collection(db, "salons", salonId, "bookings"),
      where("clientId", "==", uid),
    ),
  );
  return snap.docs
    .map((booking) => ({ id: booking.id, ...(booking.data() as Booking) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin);
}

export async function cancelBooking(salonId: string, bookingId: string): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "bookings", bookingId), {
    stato: "annullata",
  });
}
