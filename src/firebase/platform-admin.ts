import { httpsCallable } from "firebase/functions";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { functions, storage } from "./app";
import type { LicensePlan, LicenseStatus, SalonBranding, SalonLicense, SalonType } from "../domain/models";

export interface PlatformSalon {
  id: string;
  nome: string;
  tipo: SalonType;
  dominio: string;
  timezone: string;
  branding: SalonBranding | null;
  licenza: SalonLicense;
  owner: { nome: string; email: string } | null;
  clienti: number;
  operatori: number;
  prenotazioni30g: number;
  fatturato30g: number;
}

export interface CreatePlatformSalonInput {
  salonId: string;
  nome: string;
  tipo: SalonType;
  dominio: string;
  ownerNome: string;
  ownerEmail: string;
  ownerPassword: string;
  stato: LicenseStatus;
  piano: LicensePlan;
  scadenza: string;
  prezzoMensile: number;
}

export type UpdateBrandingInput = { salonId: string } & SalonBranding;

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

export async function createPlatformSalon(input: CreatePlatformSalonInput): Promise<string> {
  const callable = httpsCallable<CreatePlatformSalonInput, { salonId: string }>(functions, "createPlatformSalon");
  return (await callable(input)).data.salonId;
}

export async function updatePlatformSalonBranding(input: UpdateBrandingInput): Promise<void> {
  const callable = httpsCallable<UpdateBrandingInput, { success: boolean }>(functions, "updateSalonBranding");
  await callable(input);
}

export type BrandAssetSlot = "logo" | "heroImage" | "treatmentImage" | "productsImage";

export async function uploadPlatformBrandAsset(salonId: string, slot: BrandAssetSlot, file: Blob & { name?: string }) {
  const safeName = (file.name || `${slot}.webp`).replace(/[^a-z0-9.]+/gi, "-").toLowerCase();
  const path = `salons/${salonId}/branding/${slot}-${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return { url: await getDownloadURL(storageRef), path };
}
