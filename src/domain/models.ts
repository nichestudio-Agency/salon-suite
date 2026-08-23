import type { Timestamp } from "firebase/firestore";
import type { Interval } from "./time";
import type { WeeklyHours } from "./availability";

export type Gender = "maschile" | "femminile" | "altro";
export type UserRole = "cliente" | "staff" | "owner";
export type BookingStatus =
  | "in_attesa"
  | "confermata"
  | "rifiutata"
  | "annullata";

/** Documento in `users/{uid}`. */
export interface UserProfile {
  nome: string;
  email: string;
  sesso: Gender;
  /** Data di nascita come "YYYY-MM-DD" (nessun fuso: è una data anagrafica). */
  dataNascita: string;
  ruolo: UserRole;
  /** Salone di appartenenza o tenant white-label di registrazione. */
  salonId?: string;
  /** Token FCM dei dispositivi registrati per le notifiche push. */
  fcmTokens: string[];
}

export interface CompleannoConfig {
  attivo: boolean;
  messaggio: string;
  couponId?: string | null;
}

/** Documento in `salons/{salonId}`. */
export interface Salon {
  nome: string;
  /** Fuso orario IANA, es. "Europe/Rome". */
  timezone: string;
  orariApertura: WeeklyHours;
  impostazioni: {
    passoMinuti: number;
    modalitaConferma: "manuale" | "auto";
  };
  compleanno?: CompleannoConfig;
}

/** Documento in `salons/{salonId}/operators/{id}`. */
export interface Operator {
  nome: string;
  attivo: boolean;
  /** Override degli orari; se assente valgono quelli del salone. */
  orariPersonalizzati?: WeeklyHours;
}

/** Documento in `salons/{salonId}/services/{id}`. */
export interface Service {
  titolo: string;
  descrizione: string;
  /** Prezzo in centesimi interi. */
  prezzo: number;
  durataMin: number;
  attivo: boolean;
}

/** Documento in `salons/{salonId}/products/{id}`. */
export interface Product {
  titolo: string;
  descrizione: string;
  /** Prezzo in centesimi interi. */
  prezzo: number;
  /** URL scaricabile della foto (assente se senza foto). */
  fotoUrl?: string;
  /** Path in Cloud Storage della foto (per eventuale eliminazione). */
  fotoPath?: string;
  attivo: boolean;
}

/** Documento in `salons/{salonId}/bookings/{id}`. */
export interface Booking {
  clientId: string;
  /** Snapshot per la dashboard: il profilo completo resta privato. */
  clientNome?: string;
  clientEmail?: string;
  operatorId: string;
  serviceId: string;
  /** Data locale del salone, "YYYY-MM-DD". */
  date: string;
  /** Minuti dalla mezzanotte (ora locale del salone). */
  startMin: number;
  endMin: number;
  stato: BookingStatus;
}

export type OrderStatus = "in_attesa" | "pronto" | "ritirato" | "annullato";

/** Riga d'ordine: snapshot immutabile del prodotto al momento dell'ordine. */
export interface OrderItem {
  productId: string;
  titolo: string;
  /** Prezzo unitario in centesimi, congelato al momento dell'ordine. */
  prezzo: number;
  qta: number;
}

/** Documento in `salons/{salonId}/orders/{id}`. */
export interface Order {
  clientId: string;
  clientNome?: string;
  clientEmail?: string;
  items: OrderItem[];
  /** Totale in centesimi, calcolato dal server. */
  totale: number;
  stato: OrderStatus;
}

export type OrderWithId = Order & { id: string };

export type CouponType = "percentuale" | "fisso";

/** Documento in `salons/{salonId}/coupons/{id}`. */
export interface Coupon {
  /** Codice personalizzato dal salone, es. "ESTATE20". */
  codice: string;
  tipo: CouponType;
  /** percentuale: 0-100; fisso: centesimi interi. */
  valore: number;
  /** Scadenza "YYYY-MM-DD", opzionale. */
  scadenza?: string;
  attivo: boolean;
}

export interface CampaignFilters {
  sesso?: "maschile" | "femminile";
  /** Data di nascita minima "YYYY-MM-DD" (nato da). */
  natoDa?: string;
  /** Data di nascita massima "YYYY-MM-DD" (nato a). */
  natoA?: string;
}

/** Documento in `salons/{salonId}/campaigns/{id}` (audit, creato dalla Cloud Function). */
export interface Campaign {
  filtri: CampaignFilters;
  titolo: string;
  testo: string;
  couponId?: string | null;
  recipientCount: number;
  sentAt?: Timestamp;
}

/** Un impegno che occupa l'agenda: le prenotazioni in_attesa e confermate. */
export function bookingToInterval(b: Pick<Booking, "startMin" | "endMin">): Interval {
  return { start: b.startMin, end: b.endMin };
}
