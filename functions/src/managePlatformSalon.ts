import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  findAvailableSalonAccessCode,
  normalizeSalonAccessCode,
  writeSalonAccessCode,
} from "./salonAccessCode.js";

if (getApps().length === 0) initializeApp();

const TYPES = ["barberia", "parrucchieria"] as const;
const STATUSES = ["trial", "attiva", "scaduta", "sospesa"] as const;
const PLANS = ["start", "studio", "pro"] as const;
const HEX = /^#[0-9a-f]{6}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function requireSuperAdmin(uid?: string) {
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const caller = await getFirestore().doc(`users/${uid}`).get();
  if (!caller.exists || caller.data()?.ruolo !== "superadmin") {
    throw new HttpsError(
      "permission-denied",
      "Accesso riservato all'amministratore della piattaforma.",
    );
  }
  return uid;
}

interface CreatePlatformSalonData {
  salonId: string;
  nome: string;
  tipo: (typeof TYPES)[number];
  dominio: string;
  ownerNome: string;
  ownerEmail: string;
  ownerPassword: string;
  stato: (typeof STATUSES)[number];
  piano: (typeof PLANS)[number];
  scadenza: string;
  prezzoMensile: number;
}

export const createPlatformSalon = onCall<CreatePlatformSalonData>(
  async (request) => {
    await requireSuperAdmin(request.auth?.uid);
    const data = request.data;
    if (
      !data ||
      !SLUG.test(data.salonId) ||
      !data.nome?.trim() ||
      !data.dominio?.trim() ||
      !data.ownerNome?.trim() ||
      !data.ownerEmail?.trim() ||
      data.ownerPassword?.length < 8 ||
      !TYPES.includes(data.tipo) ||
      !STATUSES.includes(data.stato) ||
      !PLANS.includes(data.piano) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data.scadenza) ||
      !Number.isInteger(data.prezzoMensile) ||
      data.prezzoMensile < 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Dati dell'attività non validi.",
      );
    }

    const db = getFirestore();
    const salonRef = db.doc(`salons/${data.salonId}`);
    if ((await salonRef.get()).exists)
      throw new HttpsError(
        "already-exists",
        "Questo identificativo è già in uso.",
      );
    const codiceAccesso = await findAvailableSalonAccessCode(db, data.nome);

    let ownerUid: string | null = null;
    try {
      const owner = await getAuth().createUser({
        email: data.ownerEmail.trim().toLowerCase(),
        password: data.ownerPassword,
        displayName: data.ownerNome.trim(),
      });
      ownerUid = owner.uid;
      await db.runTransaction(async (tx) => {
        const [salonSnap, codeSnap] = await Promise.all([
          tx.get(salonRef),
          tx.get(db.doc(`salonAccessCodes/${codiceAccesso}`)),
        ]);
        if (salonSnap.exists)
          throw new HttpsError(
            "already-exists",
            "Questo identificativo è già in uso.",
          );
        if (codeSnap.exists)
          throw new HttpsError("aborted", "Riprova a creare l'attività.");
        tx.set(salonRef, {
          nome: data.nome.trim(),
          tipo: data.tipo,
          dominio: data.dominio.trim().toLowerCase(),
          timezone: "Europe/Rome",
          codiceAccesso,
          orariApertura: {},
          impostazioni: { passoMinuti: 15, modalitaConferma: "manuale" },
          licenza: {
            stato: data.stato,
            piano: data.piano,
            scadenza: data.scadenza,
            prezzoMensile: data.prezzoMensile,
          },
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.set(db.doc(`users/${owner.uid}`), {
          nome: data.ownerNome.trim(),
          email: data.ownerEmail.trim().toLowerCase(),
          sesso: "altro",
          dataNascita: "",
          ruolo: "owner",
          salonId: data.salonId,
          fcmTokens: [],
        });
        writeSalonAccessCode(tx, data.salonId, codiceAccesso);
      });
      return { salonId: data.salonId, ownerUid: owner.uid, codiceAccesso };
    } catch (error) {
      if (ownerUid)
        await getAuth()
          .deleteUser(ownerUid)
          .catch(() => undefined);
      if (error instanceof HttpsError) throw error;
      const code = (error as { code?: string }).code;
      if (code === "auth/email-already-exists")
        throw new HttpsError(
          "already-exists",
          "L'email del titolare è già registrata.",
        );
      throw new HttpsError(
        "internal",
        "Non siamo riusciti a creare l'attività.",
      );
    }
  },
);

interface EnsureSalonAccessCodeData {
  salonId: string;
}

export const ensureSalonAccessCode = onCall<EnsureSalonAccessCodeData>(
  async (request) => {
    await requireSuperAdmin(request.auth?.uid);
    const salonId = request.data?.salonId;
    if (!salonId || salonId.includes("/"))
      throw new HttpsError("invalid-argument", "Attività non valida.");
    const db = getFirestore();
    const salonRef = db.doc(`salons/${salonId}`);
    const initial = await salonRef.get();
    if (!initial.exists)
      throw new HttpsError("not-found", "Attività non trovata.");
    const existing = normalizeSalonAccessCode(
      String(initial.data()?.codiceAccesso ?? ""),
    );
    const code =
      existing ||
      (await findAvailableSalonAccessCode(
        db,
        String(initial.data()?.nome ?? salonId),
      ));
    await db.runTransaction(async (tx) => {
      const [salonSnap, codeSnap] = await Promise.all([
        tx.get(salonRef),
        tx.get(db.doc(`salonAccessCodes/${code}`)),
      ]);
      if (!salonSnap.exists)
        throw new HttpsError("not-found", "Attività non trovata.");
      if (codeSnap.exists && codeSnap.data()?.salonId !== salonId) {
        throw new HttpsError(
          "already-exists",
          "Codice già assegnato. Riprova.",
        );
      }
      tx.update(salonRef, { codiceAccesso: code });
      writeSalonAccessCode(tx, salonId, code);
    });
    return { codiceAccesso: code };
  },
);

interface UpdateSalonBrandingData {
  salonId: string;
  backgroundColor: string;
  foregroundColor: string;
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

export const updateSalonBranding = onCall<UpdateSalonBrandingData>(
  async (request) => {
    const uid = await requireSuperAdmin(request.auth?.uid);
    const data = request.data;
    if (
      !data ||
      !data.salonId ||
      data.salonId.includes("/") ||
      !HEX.test(data.backgroundColor) ||
      !HEX.test(data.foregroundColor) ||
      !HEX.test(data.accentColor)
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Configurazione grafica non valida.",
      );
    }
    const salonRef = getFirestore().doc(`salons/${data.salonId}`);
    if (!(await salonRef.get()).exists)
      throw new HttpsError("not-found", "Attività non trovata.");
    const assetFields = [
      "logoUrl",
      "logoPath",
      "heroImageUrl",
      "heroImagePath",
      "treatmentImageUrl",
      "treatmentImagePath",
      "productsImageUrl",
      "productsImagePath",
    ] as const;
    const branding: Record<string, string> = {
      backgroundColor: data.backgroundColor,
      foregroundColor: data.foregroundColor,
      accentColor: data.accentColor,
    };
    for (const field of assetFields)
      if (typeof data[field] === "string" && data[field])
        branding[field] = data[field]!;
    await salonRef.update({
      branding: {
        ...branding,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: uid,
      },
    });
    return { success: true };
  },
);
