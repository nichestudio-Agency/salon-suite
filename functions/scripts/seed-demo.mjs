import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Questo seed può essere eseguito solo contro gli emulatori Firebase.");
}

initializeApp({ projectId: "demo-barbershop" });
const db = getFirestore();
const auth = getAuth();

async function ensureUser(email, password, displayName) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName });
    return user.uid;
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    const user = await auth.createUser({ email, password, displayName });
    return user.uid;
  }
}

const [clientUid, ownerUid] = await Promise.all([
  ensureUser("cliente.test@barberia.local", "TestBarber26!", "Cliente Test"),
  ensureUser("titolare.test@barberia.local", "OwnerBarber26!", "Titolare Test"),
]);

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
  db.doc(`users/${clientUid}`).set({
    nome: "Cliente Test",
    email: "cliente.test@barberia.local",
    sesso: "maschile",
    dataNascita: "1990-01-15",
    ruolo: "cliente",
    salonId: "salone-x",
    fcmTokens: [],
  }),
  db.doc(`users/${ownerUid}`).set({
    nome: "Titolare Test",
    email: "titolare.test@barberia.local",
    sesso: "altro",
    dataNascita: "1990-01-01",
    ruolo: "owner",
    salonId: "salone-x",
    fcmTokens: [],
  }),
]);

console.log("Demo Salone X, cliente e titolare ripristinati.");
