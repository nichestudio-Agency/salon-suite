import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { auth, db, storage } from "./app";
import type { Product } from "../domain/models";
import { getEmulatorCollection } from "./emulator-rest";

export type ProductWithId = Product & { id: string };
const useEmulator = import.meta.env?.VITE_USE_EMULATOR === "true";

const productsCol = (salonId: string) =>
  collection(db, "salons", salonId, "products");

export async function listProducts(salonId: string): Promise<ProductWithId[]> {
  if (useEmulator) {
    const token = await auth.currentUser?.getIdToken();
    const items = await getEmulatorCollection(`salons/${encodeURIComponent(salonId)}/products`, token);
    return items as unknown as ProductWithId[];
  }
  const snap = await getDocs(productsCol(salonId));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Product) }));
}

export async function createProduct(salonId: string, data: Product): Promise<string> {
  const ref = await addDoc(productsCol(salonId), data);
  return ref.id;
}

export async function updateProduct(
  salonId: string, id: string, data: Partial<Product>
): Promise<void> {
  await updateDoc(doc(db, "salons", salonId, "products", id), data);
}

export async function deleteProduct(salonId: string, id: string): Promise<void> {
  const productRef = doc(db, "salons", salonId, "products", id);
  const snap = await getDoc(productRef);
  const fotoPath = snap.data()?.fotoPath as string | undefined;
  if (fotoPath) {
    try { await deleteObject(ref(storage, fotoPath)); } catch { /* best effort */ }
  }
  await deleteDoc(productRef);
}

export interface ProductPhoto {
  fotoUrl: string;
  fotoPath: string;
}

/** Carica la foto del prodotto su Cloud Storage e ne restituisce URL e path. */
export async function uploadProductPhoto(
  salonId: string,
  productId: string,
  file: Blob,
  filename: string
): Promise<ProductPhoto> {
  const fotoPath = `salons/${salonId}/products/${productId}/${filename}`;
  const storageRef = ref(storage, fotoPath);
  await uploadBytes(storageRef, file);
  const fotoUrl = await getDownloadURL(storageRef);
  return { fotoUrl, fotoPath };
}
