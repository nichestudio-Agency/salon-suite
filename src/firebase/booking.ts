import { httpsCallable } from "firebase/functions";
import { functions } from "./app";

export interface CreateBookingInput {
  salonId: string;
  operatorId: string;
  serviceId: string;
  date: string;
  startMin: number;
}

export interface CreateBookingResult {
  bookingId: string;
  endMin: number;
  stato: "in_attesa";
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
