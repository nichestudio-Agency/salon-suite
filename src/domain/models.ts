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
  | "annullata"
  | "completata"
  | "no_show";

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
  scontoTipo?: CouponType;
  scontoValore?: number;
  validitaGiorni?: number;
  spesaMinima?: number;
  giftProductId?: string;
  giftProductTitle?: string;
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
  /** Codice pubblico usato esclusivamente per selezionare il tenant nell'app unica. */
  codiceAccesso?: string;
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
  fidelity?: FidelityConfig;
  cashIntegration?: CashIntegrationConfig;
  licenza?: SalonLicense;
  dominio?: string;
  createdAt?: Timestamp;
}

export type CashIntegrationMode = "manuale" | "api_webhook" | "gestionale";
export type CashIntegrationStatus = "operativa" | "da_configurare" | "richiesta" | "errore";

/** Configurazione non sensibile del collegamento cassa. Token e segreti restano lato server. */
export interface CashIntegrationConfig {
  mode: CashIntegrationMode;
  status: CashIntegrationStatus;
  providerName: string;
  storeReference: string;
  closeBookingsFromReceipts: boolean;
  creditLoyaltyFromReceipts: boolean;
  syncProductCatalog: boolean;
  updatedAtMs?: number;
}

export interface FidelityConfig {
  attiva: boolean;
  /** Punti assegnati per ogni euro intero confermato alla cassa. */
  puntiPerEuro: number;
  /** Soglia necessaria per riscattare il premio principale. */
  sogliaPremio: number;
  premioNome: string;
  /** Valore commerciale indicativo del premio, in centesimi. */
  premioValore: number;
  rewards?: FidelityReward[];
}

export type FidelityRewardType = "servizio" | "prodotto" | "buono";

export interface FidelityReward {
  id: string;
  nome: string;
  descrizione: string;
  tipo: FidelityRewardType;
  punti: number;
  valore: number;
  attivo: boolean;
}

export interface LoyaltyAccount {
  clientId: string;
  codice: string;
  nome: string;
  email: string;
  punti: number;
  puntiTotali: number;
  puntiRiscattati: number;
  visite: number;
}

export type RewardRedemptionStatus = "emesso" | "utilizzato" | "annullato" | "scaduto";
export interface RewardRedemption {
  id: string;
  clientId: string;
  clientNome: string;
  rewardId: string;
  rewardNome: string;
  punti: number;
  codice: string;
  stato: RewardRedemptionStatus;
  createdAt: string;
  usedAt?: string;
}

export type LoyaltyTransactionType = "accredito" | "riscatto" | "rettifica";

export interface LoyaltyTransaction {
  id: string;
  tipo: LoyaltyTransactionType;
  punti: number;
  descrizione: string;
  importo?: number;
  createdAt: string;
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
  fotoUrl?: string;
  fotoPath?: string;
  attivo: boolean;
}

export interface ManualClient {
  nome: string;
  email: string;
  telefono?: string;
  sesso: Gender;
  dataNascita: string;
}

export interface ClientVisit {
  clientId: string;
  serviceId?: string;
  serviceTitle: string;
  date: string;
  importo: number;
  note?: string;
  createdAt?: Timestamp;
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
  /** Servizi in sequenza; `serviceId` resta valorizzato per compatibilità. */
  serviceIds?: string[];
  serviceItems?: BookingServiceItem[];
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
  /** Operatore che ha realmente eseguito il servizio. */
  performedByOperatorId?: string;
  /** Vendita generata alla chiusura dell'appuntamento. */
  saleId?: string;
  completedAt?: Timestamp;
  seriesId?: string;
  occurrenceIndex?: number;
  occurrenceCount?: number;
  createdAt?: Timestamp;
}

export interface BookingServiceItem {
  serviceId: string;
  titolo: string;
  durataMin: number;
  prezzo: number;
  offsetStartMin: number;
  offsetEndMin: number;
}

export type WaitlistStatus = "active" | "notified" | "cancelled";

/** Richiesta del cliente di essere avvisato quando si libera uno slot. */
export interface WaitlistEntry {
  clientId: string;
  clientNome: string;
  clientEmail?: string | null;
  operatorId: string;
  serviceIds: string[];
  serviceItems: Array<Pick<BookingServiceItem, "serviceId" | "titolo" | "durataMin" | "prezzo">>;
  date: string;
  status: WaitlistStatus;
  notifiedAt?: Timestamp;
  createdAt?: Timestamp;
}

export type SaleStatus = "bozza" | "pagata" | "annullata" | "rimborsata";
export type SaleItemType = "servizio" | "prodotto";

export interface SaleItem {
  tipo: SaleItemType;
  referenceId: string;
  titolo: string;
  qta: number;
  prezzoUnitario: number;
  totale: number;
  performedByOperatorId?: string;
  soldByOperatorId?: string;
}

/** Documento economico in `salons/{salonId}/sales/{saleId}`. */
export interface Sale {
  clientId?: string;
  clientNome?: string;
  bookingId?: string;
  date: string;
  stato: SaleStatus;
  items: SaleItem[];
  subtotale: number;
  sconto: number;
  totale: number;
  paymentMethod: "in_salone";
  performedByOperatorId?: string;
  createdByUserId: string;
  createdAt?: Timestamp;
  paidAt?: Timestamp;
  cashRegister?: {
    source: "salon_suite" | "external";
    externalReceiptId?: string;
    syncedAt?: Timestamp;
  };
}

export type SaleWithId = Sale & { id: string };

export type OrderStatus = "in_attesa" | "pronto" | "ritirato" | "annullato";

/** Riga d'ordine: snapshot immutabile del prodotto al momento dell'ordine. */
export interface OrderItem {
  productId: string;
  titolo: string;
  /** Prezzo unitario in centesimi, congelato al momento dell'ordine. */
  prezzo: number;
  qta: number;
  isGift?: boolean;
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
  createdAt?: Timestamp;
  pointsEarned?: number;
  paymentMethod?: "in_salone";
  couponId?: string;
  couponCode?: string;
}

export type OrderWithId = Order & { id: string };

export type CouponType = "percentuale" | "fisso" | "prodotto_omaggio";

export type TicketChannel = "cliente_salone" | "salone_piattaforma";
export type TicketStatus = "aperto" | "in_lavorazione" | "risolto" | "chiuso";
export type TicketPriority = "bassa" | "normale" | "alta";

export interface Ticket {
  salonId: string;
  channel: TicketChannel;
  oggetto: string;
  categoria: string;
  priorita: TicketPriority;
  stato: TicketStatus;
  requesterId: string;
  requesterName: string;
  requesterRole: "cliente" | "owner";
  createdAtMs: number;
  updatedAtMs: number;
  lastMessage: string;
  messageCount: number;
  lastSenderRole: "cliente" | "salone" | "piattaforma";
}

export interface PlatformAnnouncement {
  titolo: string;
  testo: string;
  audience: "all" | "salon";
  salonId?: string;
  createdAtMs: number;
}

export interface TicketAttachment {
  nome: string;
  tipo: string;
  dimensione: number;
  dataUrl: string;
}

export interface TicketMessage {
  senderId: string;
  senderName: string;
  senderRole: "cliente" | "salone" | "piattaforma";
  testo: string;
  allegati: TicketAttachment[];
  createdAtMs: number;
}

/** Documento in `salons/{salonId}/coupons/{id}`. */
export interface Coupon {
  /** Codice personalizzato dal salone, es. "ESTATE20". */
  codice: string;
  tipo: CouponType;
  /** percentuale: 0-100; fisso: centesimi interi. */
  valore: number;
  /** Soglia minima dell'ordine in centesimi per ottenere l'omaggio. */
  spesaMinima?: number;
  giftProductId?: string;
  giftProductTitle?: string;
  /** Scadenza "YYYY-MM-DD", opzionale. */
  scadenza?: string;
  /** Se valorizzata il coupon vale solo per appuntamenti in questa data. */
  dataAppuntamento?: string;
  fasciaDa?: string;
  fasciaA?: string;
  serviceId?: string;
  clientId?: string;
  singleUse?: boolean;
  origin?: "manuale" | "compleanno" | "riempi_agenda";
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
  /** Selezione manuale di destinatari specifici. */
  recipientIds?: string[];
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
