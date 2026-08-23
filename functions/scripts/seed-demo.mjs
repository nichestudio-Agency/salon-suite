import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Questo seed può essere eseguito solo contro Firestore Emulator.");
}

initializeApp({ projectId: "demo-barbershop" });
const db = getFirestore();

await Promise.all([
  db.doc("salons/salone-x").set({
    nome: "Salone X",
    timezone: "Europe/Rome",
    orariApertura: {
      lun: [{ start: 540, end: 1140 }],
      mar: [{ start: 540, end: 1140 }],
      mer: [{ start: 540, end: 1140 }],
      gio: [{ start: 540, end: 1140 }],
      ven: [{ start: 540, end: 1140 }],
      sab: [{ start: 540, end: 1140 }],
    },
    impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
  }),
  db.doc("salons/salone-x/services/taglio-sartoriale").set({
    titolo: "Taglio sartoriale",
    descrizione: "Consulenza, taglio e styling finale.",
    prezzo: 3200,
    durataMin: 45,
    attivo: true,
  }),
  db.doc("salons/salone-x/services/rituale-barba").set({
    titolo: "Rituale barba",
    descrizione: "Panno caldo, rasatura e trattamento idratante.",
    prezzo: 2400,
    durataMin: 30,
    attivo: true,
  }),
  db.doc("salons/salone-x/operators/marco-rinaldi").set({
    nome: "Marco Rinaldi",
    attivo: true,
  }),
  db.doc("salons/salone-x/products/cera-opaca").set({
    titolo: "Cera opaca",
    descrizione: "Tenuta naturale e finish asciutto.",
    prezzo: 1800,
    attivo: true,
  }),
]);

console.log("Tenant demo Salone X ripristinato.");
