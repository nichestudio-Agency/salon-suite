import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "./app";
import type { WeeklyHours } from "../domain/availability";
import type { SalonType } from "../domain/models";

export interface RegisterOwnerInput {
  email: string;
  password: string;
  nomeSalone: string;
  tipo?: SalonType;
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
  const cred = await createUserWithEmailAndPassword(auth, input.email, input.password);
  const createSalon = httpsCallable<
    { nome: string; tipo?: SalonType; timezone: string; orariApertura: WeeklyHours },
    { salonId: string }
  >(functions, "createSalon");
  try {
    const res = await createSalon({
      nome: input.nomeSalone,
      tipo: input.tipo ?? "barberia",
      timezone: input.timezone,
      orariApertura: input.orariApertura,
    });
    return { salonId: res.data.salonId };
  } catch (e) {
    // Rollback: rimuovi l'utente auth orfano così l'onboarding resta ritentabile.
    try { await deleteUser(cred.user); } catch { /* best effort */ }
    throw e;
  }
}
