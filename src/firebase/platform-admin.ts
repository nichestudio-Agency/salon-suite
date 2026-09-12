import { httpsCallable } from "firebase/functions";
import { collection, getDocs, query, where } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, functions, storage } from "./app";
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
  try {
    const callable = httpsCallable<Record<string, never>, { salons: PlatformSalon[] }>(functions, "listPlatformSalons");
    return (await callable({})).data.salons;
  } catch {
    return listPlatformSalonsDirect();
  }
}

async function listPlatformSalonsDirect(): Promise<PlatformSalon[]> {
  const [salonsSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, "salons")),
    getDocs(collection(db, "users")),
  ]);
  const users = usersSnap.docs.map((item) => ({ id: item.id, ...item.data() })) as Array<{
    id: string; salonId?: string; ruolo?: string; nome?: string; email?: string;
  }>;
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const salons = await Promise.all(salonsSnap.docs.map(async (salonDoc): Promise<PlatformSalon> => {
    const salonId = salonDoc.id;
    const salon = salonDoc.data();
    const [operatorsSnap, bookingsSnap, servicesSnap] = await Promise.all([
      getDocs(collection(db, `salons/${salonId}/operators`)),
      getDocs(query(collection(db, `salons/${salonId}/bookings`), where("date", ">=", cutoffDate))),
      getDocs(collection(db, `salons/${salonId}/services`)),
    ]);
    const servicePrices = new Map(servicesSnap.docs.map((item) => [item.id, Number(item.data().prezzo) || 0]));
    const validBookings = bookingsSnap.docs.map((item) => item.data())
      .filter((booking) => !["annullata", "rifiutata"].includes(String(booking.stato)));
    const owner = users.find((user) => user.salonId === salonId && user.ruolo === "owner");
    const clients = users.filter((user) => user.salonId === salonId && user.ruolo === "cliente");
    return {
      id: salonId,
      nome: String(salon.nome ?? "Salone senza nome"),
      tipo: salon.tipo === "parrucchieria" ? "parrucchieria" : "barberia",
      dominio: String(salon.dominio ?? `${salonId}.barberia.app`),
      timezone: String(salon.timezone ?? "Europe/Rome"),
      branding: (salon.branding ?? null) as SalonBranding | null,
      licenza: (salon.licenza ?? { stato: "trial", piano: "start", scadenza: "", prezzoMensile: 0 }) as SalonLicense,
      owner: owner ? { nome: owner.nome ?? "Titolare", email: owner.email ?? "" } : null,
      clienti: clients.length,
      operatori: operatorsSnap.docs.filter((item) => item.data().attivo === true).length,
      prenotazioni30g: validBookings.length,
      fatturato30g: validBookings.filter((booking) => booking.stato === "confermata")
        .reduce((sum, booking) => sum + (Number(booking.prezzoFinale) || servicePrices.get(String(booking.serviceId)) || 0), 0),
    };
  }));
  return salons.sort((a, b) => a.nome.localeCompare(b.nome, "it"));
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
