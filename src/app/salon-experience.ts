import type { SalonBranding, SalonType } from "../domain/models";
import barberEditorial from "../assets/barber-editorial.webp";
import barberTools from "../assets/barber-tools.webp";
import beardTreatment from "../assets/beard-treatment.webp";
import hairEditorial from "../assets/hair/hair-editorial.webp";
import hairColor from "../assets/hair/hair-color.webp";
import hairProducts from "../assets/hair/hair-products.webp";

export type SalonExperience = {
  type: SalonType;
  professional: string;
  professionals: string;
  role: string;
  heroWords: [string, string];
  heroDescription: string;
  bookingDescription: string;
  serviceDescription: string;
  professionalDescription: string;
  teamHeading: string;
  teamPromise: string;
  featureLine: string;
  featureAlt: string;
  images: {
    editorial: string;
    treatment: string;
    products: string;
  };
};

const EXPERIENCES: Record<SalonType, SalonExperience> = {
  barberia: {
    type: "barberia",
    professional: "Barber",
    professionals: "barber",
    role: "Barber",
    heroWords: ["Barber", "Shop"],
    heroDescription: "Tecniche contemporanee e rituali su misura per il tuo stile.",
    bookingDescription: "Taglio, barba e styling su misura, quando vuoi tu.",
    serviceDescription: "Consulta trattamenti, durata e prezzo prima di scegliere il tuo appuntamento.",
    professionalDescription: "Taglio, barba e consulenza di stile.",
    teamHeading: "I tuoi barber",
    teamPromise: "Barber.\nUn solo standard.",
    featureLine: "Rituali precisi.\nRisultati che restano.",
    featureAlt: "Rituale tradizionale della barba",
    images: { editorial: barberEditorial, treatment: beardTreatment, products: barberTools },
  },
  parrucchieria: {
    type: "parrucchieria",
    professional: "Stylist",
    professionals: "stylist",
    role: "Hair stylist",
    heroWords: ["Hair", "Studio"],
    heroDescription: "Taglio, colore e trattamenti costruiti intorno alla tua personalità.",
    bookingDescription: "Taglio, colore e styling su misura, quando vuoi tu.",
    serviceDescription: "Scopri tagli, colore e trattamenti con durata e prezzo sempre trasparenti.",
    professionalDescription: "Taglio, colore e consulenza d’immagine.",
    teamHeading: "I tuoi stylist",
    teamPromise: "Stylist.\nUna sola visione.",
    featureLine: "Colore preciso.\nLuce naturale.",
    featureAlt: "Colorista durante un trattamento professionale",
    images: { editorial: hairEditorial, treatment: hairColor, products: hairProducts },
  },
};

export function getSalonExperience(type?: SalonType, branding?: SalonBranding | null): SalonExperience {
  const base = EXPERIENCES[type ?? "barberia"];
  if (!branding) return base;
  return {
    ...base,
    images: {
      editorial: branding.heroImageUrl || base.images.editorial,
      treatment: branding.treatmentImageUrl || base.images.treatment,
      products: branding.productsImageUrl || base.images.products,
    },
  };
}
