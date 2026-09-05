import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

const demoClients = [
  { email: "cliente.test@barberia.local", password: "TestBarber26!", nome: "Cliente Test", sesso: "maschile", dataNascita: "1990-01-15" },
  { email: "luca.bianchi@barberia.local", password: "TestBarber26!", nome: "Luca Bianchi", sesso: "maschile", dataNascita: "1988-09-04" },
  { email: "alessandro.conti@barberia.local", password: "TestBarber26!", nome: "Alessandro Conti", sesso: "maschile", dataNascita: "1995-11-22" },
  { email: "paolo.romano@barberia.local", password: "TestBarber26!", nome: "Paolo Romano", sesso: "maschile", dataNascita: "1979-03-09" },
  { email: "davide.russo@barberia.local", password: "TestBarber26!", nome: "Davide Russo", sesso: "maschile", dataNascita: "1992-07-18" },
  { email: "simone.ricci@barberia.local", password: "TestBarber26!", nome: "Simone Ricci", sesso: "maschile", dataNascita: "1985-12-03" },
];

const platformSalons = [
  { id: "officina-27", nome: "Officina 27", dominio: "officina27.barberia.app", owner: "Riccardo Serra", email: "riccardo@officina27.demo", piano: "pro", stato: "attiva", prezzo: 12900, scadenza: dateOffset(142), clienti: 18, prenotazioni: 11 },
  { id: "barbieri-navigli", nome: "Barbieri Navigli", dominio: "navigli.barberia.app", owner: "Matteo Villa", email: "matteo@navigli.demo", piano: "start", stato: "trial", prezzo: 4900, scadenza: dateOffset(9), clienti: 9, prenotazioni: 5 },
  { id: "bottega-1932", nome: "Bottega 1932", dominio: "bottega1932.barberia.app", owner: "Andrea Greco", email: "andrea@bottega1932.demo", piano: "studio", stato: "sospesa", prezzo: 7900, scadenza: dateOffset(-8), clienti: 27, prenotazioni: 3 },
  { id: "uomo-torino", nome: "Uomo Torino", dominio: "uomotorino.barberia.app", owner: "Stefano Ferri", email: "stefano@uomotorino.demo", piano: "studio", stato: "attiva", prezzo: 7900, scadenza: dateOffset(67), clienti: 14, prenotazioni: 8 },
];

const [adminUid, ownerUid, ...clientUids] = await Promise.all([
  ensureUser("admin@barberia.local", "AdminBarber26!", "Fabio Pace"),
  ensureUser("titolare.test@barberia.local", "OwnerBarber26!", "Titolare Test"),
  ...demoClients.map((client) => ensureUser(client.email, client.password, client.nome)),
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
    compleanno: { attivo: true, messaggio: "Buon compleanno dal team di Salone X. Oggi festeggiamo il tuo stile.", couponId: "birthday-15" },
    dominio: "salonex.barberia.app",
    licenza: { stato: "attiva", piano: "pro", scadenza: dateOffset(118), prezzoMensile: 9900 },
    createdAt: Timestamp.fromDate(new Date(Date.now() - 210 * 86_400_000)),
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
  db.doc("salons/salone-x/services/combo-signature").set({ titolo: "Combo signature", descrizione: "Taglio sartoriale e rituale barba.", prezzo: 5200, durataMin: 75, attivo: true }),
  db.doc("salons/salone-x/services/styling-express").set({ titolo: "Styling express", descrizione: "Piega e definizione per un risultato rapido.", prezzo: 1800, durataMin: 20, attivo: true }),
  db.doc("salons/salone-x/operators/marco-rinaldi").set({
    nome: "Marco Rinaldi",
    attivo: true,
    fotoUrl: "/demo/team-marco.webp",
  }),
  db.doc("salons/salone-x/operators/lorenzo-bassi").set({ nome: "Lorenzo Bassi", attivo: true, fotoUrl: "/demo/team-luca.webp" }),
  db.doc("salons/salone-x/operators/giuseppe-moretti").set({ nome: "Giuseppe Moretti", attivo: true, indisponibilita: [{ id: "demo-ferie", dal: dateOffset(8), al: dateOffset(12), motivo: "Ferie programmate" }] }),
  db.doc("salons/salone-x/operators/antonio-piras").set({ nome: "Antonio Piras", attivo: false }),
  db.doc("salons/salone-x/products/cera-opaca").set({
    titolo: "Cera opaca",
    descrizione: "Tenuta naturale e finish asciutto.",
    prezzo: 1800,
    attivo: true,
  }),
  db.doc("salons/salone-x/products/olio-barba").set({ titolo: "Olio barba", descrizione: "Nutrimento leggero con finitura asciutta.", prezzo: 2200, attivo: true }),
  db.doc("salons/salone-x/products/shampoo-daily").set({ titolo: "Shampoo daily", descrizione: "Detersione delicata per uso quotidiano.", prezzo: 1600, attivo: true }),
  db.doc("salons/salone-x/products/pomata-lucida").set({ titolo: "Pomata lucida", descrizione: "Tenuta media e brillantezza controllata.", prezzo: 1950, attivo: true }),
  db.doc("salons/salone-x/coupons/birthday-15").set({ codice: "AUGURI15", tipo: "percentuale", valore: 15, attivo: true }),
  db.doc("salons/salone-x/coupons/ritorna-20").set({ codice: "RITORNA20", tipo: "percentuale", valore: 20, scadenza: dateOffset(30), attivo: true }),
  db.doc("salons/salone-x/coupons/estate-scaduto").set({ codice: "ESTATE15", tipo: "percentuale", valore: 15, scadenza: dateOffset(-10), attivo: false }),
  db.doc("salons/salone-x/campaigns/demo-ritorna").set({ filtri: { bookingInactiveDays: 60 }, titolo: "Ci manchi", testo: "Torna a trovarci.", couponId: "ritorna-20", recipientCount: 5, recipientIds: clientUids.slice(0, 5), sentAt: Timestamp.fromDate(new Date(Date.now() - 3 * 86_400_000)) }),
  db.doc("salons/salone-x/campaigns/demo-estate").set({ filtri: {}, titolo: "Estate", testo: "Un nuovo look per l'estate.", couponId: "estate-scaduto", recipientCount: 6, recipientIds: clientUids, sentAt: Timestamp.fromDate(new Date(Date.now() - 20 * 86_400_000)) }),
  db.doc(`salons/salone-x/couponRedemptions/ritorna-20_${clientUids[0]}`).set({ couponId: "ritorna-20", couponCode: "RITORNA20", clientId: clientUids[0], bookingId: "demo-week-1", appointmentDate: dateOffset(-1), discountAmount: 640, redeemedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 86_400_000)) }),
  db.doc(`salons/salone-x/couponRedemptions/ritorna-20_${clientUids[1]}`).set({ couponId: "ritorna-20", couponCode: "RITORNA20", clientId: clientUids[1], bookingId: "demo-today-01", appointmentDate: dateOffset(0), discountAmount: 640, redeemedAt: Timestamp.now() }),
  db.doc(`salons/salone-x/couponRedemptions/estate-scaduto_${clientUids[2]}`).set({ couponId: "estate-scaduto", couponCode: "ESTATE15", clientId: clientUids[2], bookingId: "demo-week-4", appointmentDate: dateOffset(-16), discountAmount: 480, redeemedAt: Timestamp.fromDate(new Date(Date.now() - 16 * 86_400_000)) }),
  ...demoClients.map((client, index) => db.doc(`users/${clientUids[index]}`).set({ nome: client.nome, email: client.email, sesso: client.sesso, dataNascita: client.dataNascita, ruolo: "cliente", salonId: "salone-x", fcmTokens: [] })),
  db.doc(`users/${ownerUid}`).set({
    nome: "Titolare Test",
    email: "titolare.test@barberia.local",
    sesso: "altro",
    dataNascita: "1990-01-01",
    ruolo: "owner",
    salonId: "salone-x",
    fcmTokens: [],
  }),
  db.doc(`users/${adminUid}`).set({ nome: "Fabio Pace", email: "admin@barberia.local", ruolo: "superadmin", fcmTokens: [] }),
  db.doc("salons/salone-x/bookings/demo-today-01").set({ clientId: clientUids[1], clientNome: "Luca Bianchi", clientEmail: demoClients[1].email, operatorId: "marco-rinaldi", serviceId: "taglio-sartoriale", date: dateOffset(0), startMin: 570, endMin: 615, stato: "confermata", createdAt: Timestamp.now() }),
  db.doc("salons/salone-x/bookings/demo-today-02").set({ clientId: clientUids[2], clientNome: "Alessandro Conti", clientEmail: demoClients[2].email, operatorId: "lorenzo-bassi", serviceId: "combo-signature", date: dateOffset(0), startMin: 630, endMin: 705, stato: "in_attesa", createdAt: Timestamp.now() }),
  db.doc("salons/salone-x/bookings/demo-today-03").set({ clientId: clientUids[3], clientNome: "Paolo Romano", clientEmail: demoClients[3].email, operatorId: "marco-rinaldi", serviceId: "rituale-barba", date: dateOffset(0), startMin: 720, endMin: 750, stato: "confermata", createdAt: Timestamp.now() }),
  db.doc("salons/salone-x/bookings/demo-today-04").set({ clientId: clientUids[4], clientNome: "Davide Russo", clientEmail: demoClients[4].email, operatorId: "giuseppe-moretti", serviceId: "styling-express", date: dateOffset(0), startMin: 840, endMin: 860, stato: "confermata", createdAt: Timestamp.now() }),
  db.doc("salons/salone-x/bookings/demo-today-05").set({ clientId: clientUids[5], clientNome: "Simone Ricci", clientEmail: demoClients[5].email, operatorId: "lorenzo-bassi", serviceId: "taglio-sartoriale", date: dateOffset(0), startMin: 930, endMin: 975, stato: "confermata", createdAt: Timestamp.now() }),
  ...[-1, -2, -3, -4, -5, -6].map((offset, index) => db.doc(`salons/salone-x/bookings/demo-week-${index + 1}`).set({ clientId: clientUids[index % clientUids.length], clientNome: demoClients[index % demoClients.length].nome, clientEmail: demoClients[index % demoClients.length].email, operatorId: index % 2 ? "marco-rinaldi" : "lorenzo-bassi", serviceId: index % 2 ? "combo-signature" : "taglio-sartoriale", date: dateOffset(offset), startMin: 600, endMin: index % 2 ? 675 : 645, stato: "confermata", createdAt: Timestamp.fromDate(new Date(Date.now() + offset * 86_400_000)) })),
  db.doc("salons/salone-x/orders/demo-order-01").set({ clientId: clientUids[1], clientNome: "Luca Bianchi", clientEmail: demoClients[1].email, items: [{ productId: "cera-opaca", titolo: "Cera opaca", prezzo: 1800, qta: 1 }], totale: 1800, stato: "ritirato", createdAt: Timestamp.fromDate(new Date(Date.now() - 12 * 86_400_000)) }),
  db.doc("salons/salone-x/orders/demo-order-02").set({ clientId: clientUids[3], clientNome: "Paolo Romano", clientEmail: demoClients[3].email, items: [{ productId: "olio-barba", titolo: "Olio barba", prezzo: 2200, qta: 2 }], totale: 4400, stato: "pronto", createdAt: Timestamp.fromDate(new Date(Date.now() - 95 * 86_400_000)) }),
  db.doc("salons/salone-x/orders/demo-order-03").set({ clientId: clientUids[4], clientNome: "Davide Russo", clientEmail: demoClients[4].email, items: [{ productId: "shampoo-daily", titolo: "Shampoo daily", prezzo: 1600, qta: 1 }], totale: 1600, stato: "in_attesa", createdAt: Timestamp.fromDate(new Date(Date.now() - 4 * 86_400_000)) }),
]);

for (const [salonIndex, salon] of platformSalons.entries()) {
  const ownerUid = await ensureUser(salon.email, "OwnerBarber26!", salon.owner);
  await Promise.all([
    db.doc(`salons/${salon.id}`).set({
      nome: salon.nome,
      dominio: salon.dominio,
      timezone: "Europe/Rome",
      orariApertura: { lun: [{ start: 540, end: 1080 }], mar: [{ start: 540, end: 1080 }], mer: [{ start: 540, end: 1080 }], gio: [{ start: 540, end: 1080 }], ven: [{ start: 540, end: 1080 }], sab: [{ start: 540, end: 1080 }] },
      impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
      licenza: { stato: salon.stato, piano: salon.piano, scadenza: salon.scadenza, prezzoMensile: salon.prezzo },
      createdAt: Timestamp.fromDate(new Date(Date.now() - (40 + salonIndex * 37) * 86_400_000)),
    }),
    db.doc(`users/${ownerUid}`).set({ nome: salon.owner, email: salon.email, ruolo: "owner", salonId: salon.id, fcmTokens: [] }),
    db.doc(`salons/${salon.id}/operators/barber-1`).set({ nome: "Operatore principale", attivo: true }),
    db.doc(`salons/${salon.id}/operators/barber-2`).set({ nome: "Secondo operatore", attivo: salonIndex !== 1 }),
    db.doc(`salons/${salon.id}/services/taglio`).set({ titolo: "Taglio", descrizione: "", prezzo: 2800 + salonIndex * 300, durataMin: 40, attivo: true }),
    ...Array.from({ length: salon.clienti }, (_, index) => db.doc(`users/demo-${salon.id}-${index}`).set({ nome: `Cliente ${index + 1}`, email: `cliente${index + 1}@${salon.id}.demo`, ruolo: "cliente", salonId: salon.id, fcmTokens: [] })),
    ...Array.from({ length: salon.prenotazioni }, (_, index) => db.doc(`salons/${salon.id}/bookings/demo-${index}`).set({ clientId: `demo-${salon.id}-${index % salon.clienti}`, clientNome: `Cliente ${(index % salon.clienti) + 1}`, operatorId: index % 2 ? "barber-1" : "barber-2", serviceId: "taglio", date: dateOffset(-(index % 24)), startMin: 570 + (index % 8) * 60, endMin: 610 + (index % 8) * 60, stato: index % 5 === 0 ? "in_attesa" : "confermata", createdAt: Timestamp.now() })),
  ]);
}

console.log("Demo Salone X e piattaforma Super Admin ripristinati.");
