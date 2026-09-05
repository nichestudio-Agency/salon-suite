import { httpsCallable } from "firebase/functions";
import { functions } from "./app";
import type { LicensePlan, LicenseStatus, SalonLicense } from "../domain/models";

export interface PlatformSalon {
  id: string;
  nome: string;
  dominio: string;
  timezone: string;
  licenza: SalonLicense;
  owner: { nome: string; email: string } | null;
  clienti: number;
  operatori: number;
  prenotazioni30g: number;
  fatturato30g: number;
}

export interface UpdateLicenseInput {
  salonId: string;
  stato: LicenseStatus;
  piano: LicensePlan;
  scadenza: string;
  prezzoMensile: number;
}

export async function listPlatformSalons(): Promise<PlatformSalon[]> {
  const callable = httpsCallable<Record<string, never>, { salons: PlatformSalon[] }>(functions, "listPlatformSalons");
  return (await callable({})).data.salons;
}

export async function updatePlatformSalonLicense(input: UpdateLicenseInput): Promise<void> {
  const callable = httpsCallable<UpdateLicenseInput, { success: boolean }>(functions, "updateSalonLicense");
  await callable(input);
}
