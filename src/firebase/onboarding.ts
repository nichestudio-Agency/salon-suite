import { createUserWithEmailAndPassword } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./app";
import type { WeeklyHours } from "../domain/availability";

export interface RegisterOwnerInput {
  email: string;
  password: string;
  nomeSalone: string;
  timezone: string;
  orariApertura: WeeklyHours;
}

export interface RegisterOwnerResult {
  salonId: string;
}

/**
 * Registra il titolare (auth) e crea il suo salone via Cloud Function.
 * Il profilo owner NON viene creato lato client (le rules lo vietano):
 * ci pensa la function `createSalon` con privilegi admin.
 */
export async function registerOwner(
  input: RegisterOwnerInput
): Promise<RegisterOwnerResult> {
  await createUserWithEmailAndPassword(auth, input.email, input.password);
  const createSalon = httpsCallable<
    { nome: string; timezone: string; orariApertura: WeeklyHours },
    { salonId: string }
  >(functions, "createSalon");
  const res = await createSalon({
    nome: input.nomeSalone,
    timezone: input.timezone,
    orariApertura: input.orariApertura,
  });
  return { salonId: res.data.salonId };
}
