import { createHash, randomBytes } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (getApps().length === 0) initializeApp();

type ConnectorAction = "status" | "issue" | "revoke";

interface ManageCashConnectorData {
  salonId: string;
  action: ConnectorAction;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim() || value.includes("/")) {
    throw new HttpsError("invalid-argument", `${field} non valido.`);
  }
  return value.trim();
}

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export const manageCashConnector = onCall<ManageCashConnectorData>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Devi essere autenticato.");
  const salonId = requireId(request.data?.salonId, "salonId");
  const action = request.data?.action;
  if (action !== "status" && action !== "issue" && action !== "revoke") {
    throw new HttpsError("invalid-argument", "Azione non valida.");
  }

  const db = getFirestore();
  const actor = (await db.doc(`users/${uid}`).get()).data();
  if (actor?.salonId !== salonId || !["owner", "staff"].includes(actor?.ruolo)) {
    throw new HttpsError("permission-denied", "Utente non autorizzato per questo salone.");
  }
  if (action !== "status" && actor?.ruolo !== "owner") {
    throw new HttpsError("permission-denied", "Solo il titolare può gestire la chiave del connettore.");
  }

  const connectorRef = db.doc(`salons/${salonId}/privateIntegrations/cash`);
  const salonRef = db.doc(`salons/${salonId}`);
  if (action === "status") {
    const connector = await connectorRef.get();
    return {
      enabled: connector.exists && connector.data()?.enabled === true,
      lastFour: connector.exists ? String(connector.data()?.lastFour ?? "") : "",
    };
  }
  if (action === "revoke") {
    await connectorRef.set({
      enabled: false,
      revokedAt: FieldValue.serverTimestamp(),
      revokedByUserId: uid,
    }, { merge: true });
    await salonRef.update({
      "cashIntegration.status": "da_configurare",
      "cashIntegration.updatedAtMs": Date.now(),
    });
    return { enabled: false, lastFour: "" };
  }

  const secret = `ss_live_${randomBytes(24).toString("base64url")}`;
  const lastFour = secret.slice(-4);
  await connectorRef.set({
    enabled: true,
    secretHash: hashSecret(secret),
    lastFour,
    createdAt: FieldValue.serverTimestamp(),
    createdByUserId: uid,
    revokedAt: FieldValue.delete(),
    revokedByUserId: FieldValue.delete(),
  }, { merge: true });
  await salonRef.update({
    "cashIntegration.mode": "api_webhook",
    "cashIntegration.status": "operativa",
    "cashIntegration.updatedAtMs": Date.now(),
  });
  return { enabled: true, lastFour, secret };
});
