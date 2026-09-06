import type { Timestamp } from "firebase/firestore";
import type { Interval } from "./time";
import type { WeeklyHours } from "./availability";

export type Gender = "maschile" | "femminile" | "altro";
export type UserRole = "cliente" | "staff" | "owner" | "superadmin";
export type SalonType = "barberia" | "parrucchieria";
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

export interface SalonBranding {
  /** Colore principale delle superfici. */
  backgroundColor: string;
  /** Colore di testo e contrasto. */
  foregroundColor: string;
  /** Colore usato per CTA, link e stati attivi. */
  accentColor: string;
  logoUrl?: string;
  logoPath?: string;
  heroImageUrl?: string;
  heroImagePath?: string;
  treatmentImageUrl?: string;
  treatmentImagePath?: string;
  productsImageUrl?: string;
  productsImagePath?: string;
}

/** Documento in `salons/{salonId}`. */
export interface Salon {
  nome: string;
  /** Verticale visuale e lessicale usato dall'app white-label. */
  tipo?: SalonType;
  /** Identità visiva configurabile dal pannello di piattaforma. */
  branding?: SalonBranding;
  /** Fuso orario IANA, es. "Europe/Rome". */
  timezone: string;
  orariApertura: WeeklyHours;
  impostazioni: {
    passoMinuti: number;
    modalitaConferma: "manuale" | "auto";
  };
  compleanno?: CompleannoConfig;
  licenza?: SalonLicense;
  dominio?: string;
  createdAt?: Timestamp;
}

export type LicenseStatus = "trial" | "attiva" | "scaduta" | "sospesa";
export type LicensePlan = "start" | "studio" | "pro";

export interface SalonLicense {
  stato: LicenseStatus;
  piano: LicensePlan;
  scadenza: string;
  /** Canone mensile in centesimi. */
  prezzoMensile: number;
}

/** Documento in `salons/{salonId}/operators/{id}`. */
export interface Operator {
  nome: string;
  attivo: boolean;
  /** Foto profilo mostrata nelle esperienze cliente e titolare. */
  fotoUrl?: string;
  fotoPath?: string;
  /** Override degli orari; se assente valgono quelli del salone. */
  orariPersonalizzati?: WeeklyHours;
  /** Periodi programmati nei quali l'operatore non può ricevere prenotazioni. */
  indisponibilita?: OperatorUnavailability[];
}

export interface OperatorUnavailability {
  id: string;
  /** Estremi inclusivi, nel formato "YYYY-MM-DD". */
  dal: string;
  al: string;
  motivo?: string;
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
  couponId?: string;
  couponCode?: string;
  /** Importi in centesimi, calcolati e congelati dal server. */
  prezzoOriginale?: number;
  sconto?: number;
  prezzoFinale?: number;
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
  /** Se valorizzata il coupon vale solo per appuntamenti in questa data. */
  dataAppuntamento?: string;
  attivo: boolean;
}

export interface CampaignFilters {
  sesso?: "maschile" | "femminile";
  /** Data di nascita minima "YYYY-MM-DD" (nato da). */
  natoDa?: string;
  /** Data di nascita massima "YYYY-MM-DD" (nato a). */
  natoA?: string;
  /** Include chi non prenota da almeno questo numero di giorni. */
  bookingInactiveDays?: number;
  /** Include chi non acquista prodotti da almeno questo numero di giorni. */
  productInactiveDays?: number;
}

/** Documento in `salons/{salonId}/campaigns/{id}` (audit, creato dalla Cloud Function). */
export interface Campaign {
  filtri: CampaignFilters;
  titolo: string;
  testo: string;
  couponId?: string | null;
  recipientCount: number;
  /** Destinatari unici, usati per misurare il funnel del coupon. */
  recipientIds?: string[];
  sentAt?: Timestamp;
}

/** Un impegno che occupa l'agenda: le prenotazioni in_attesa e confermate. */
export function bookingToInterval(b: Pick<Booking, "startMin" | "endMin">): Interval {
  return { start: b.startMin, end: b.endMin };
}
