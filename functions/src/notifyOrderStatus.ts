import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";

if (getApps().length === 0) initializeApp();

type NotifiableStatus = "pronto" | "annullato";

function isNotifiableStatus(value: unknown): value is NotifiableStatus {
  return value === "pronto" || value === "annullato";
}

function messageFor(status: NotifiableStatus) {
  if (status === "pronto") {
    return {
      title: "Ordine pronto per il ritiro",
      body: "Il tuo ordine è pronto: passa in salone a ritirarlo e pagarlo.",
    };
  }
  return {
    title: "Ordine annullato",
    body: "Il tuo ordine è stato annullato.",
  };
}

export const notifyOrderStatus = onDocumentUpdated(
  "salons/{salonId}/orders/{orderId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const salonId = event.params.salonId;
    const orderId = event.params.orderId;
    if (!before || !after || before.stato === after.stato || !isNotifiableStatus(after.stato)) {
      return;
    }

    const db = getFirestore();
    const profile = await db.doc(`users/${after.clientId}`).get();
    const profileData = profile.data() ?? {};
    const email =
      (typeof after.clientEmail === "string" && after.clientEmail) ||
      (typeof profileData.email === "string" && profileData.email) ||
      null;
    const tokens = Array.isArray(profileData.fcmTokens)
      ? profileData.fcmTokens.filter(
          (token: unknown): token is string => typeof token === "string" && token.length > 0,
        )
      : [];
    const copy = messageFor(after.stato);
    const notificationId = `${orderId}_${after.stato}`;
    const notificationRef = db.doc(`salons/${salonId}/notifications/${notificationId}`);
    const mailRef = db.doc(`mail/${salonId}_${notificationId}`);

    const created = await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(notificationRef);
      if (existing.exists) return false;
      transaction.create(notificationRef, {
        orderId,
        clientId: after.clientId,
        clientNome: after.clientNome ?? "Cliente",
        stato: after.stato,
        title: copy.title,
        body: copy.body,
        channels: {
          email: { status: email ? "queued" : "unavailable" },
          push: { status: tokens.length > 0 ? "queued" : "unavailable" },
        },
        createdAt: FieldValue.serverTimestamp(),
      });
      if (email) {
        transaction.set(mailRef, {
          to: email,
          message: { subject: copy.title, text: copy.body },
          orderId,
          salonId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      return true;
    });

    if (!created || tokens.length === 0) return;
    try {
      const response = await getMessaging().sendEachForMulticast({
        tokens,
        notification: copy,
        data: { salonId, orderId, stato: after.stato },
      });
      await notificationRef.update({
        "channels.push.status": response.failureCount === 0 ? "sent" : "partial",
        "channels.push.successCount": response.successCount,
        "channels.push.failureCount": response.failureCount,
      });
    } catch (error) {
      await notificationRef.update({
        "channels.push.status": "failed",
        "channels.push.error": error instanceof Error ? error.message : "Errore push sconosciuto",
      });
    }
  },
);
