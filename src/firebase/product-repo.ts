import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./app";
import type { Product } from "../domain/models";

export type ProductWithId = Product & { id: string };

const productsCol = (salonId: string) =>
  collection(db, "salons", salonId, "products");

export async function listProducts(salonId: string): Promise<ProductWithId[]> {
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
  await deleteDoc(doc(db, "salons", salonId, "products", id));
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
