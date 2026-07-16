import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const AI_ENGINE_URL = process.env.AI_ENGINE_URL ?? "http://localhost:8000";

/**
 * scheduleAnalytics — agrège les données de chaque organisation chaque soir à 23h55.
 */
export const scheduleAnalytics = onSchedule("55 23 * * *", async () => {
  const db  = admin.firestore();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  const orgsSnap = await db.collection("organizations").get();

  await Promise.allSettled(
    orgsSnap.docs.map((org) =>
      fetch(`${AI_ENGINE_URL}/analytics/aggregate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ organization_id: org.id, date: dateStr }),
      }).catch((e) => console.error(`Analytics ${org.id}: ${e.message}`))
    )
  );

  console.log(JSON.stringify({ module: "scheduleAnalytics", date: dateStr, orgs: orgsSnap.size }));
});

/**
 * getAnalytics — retourne les données analytics d'une période pour le dashboard.
 */
export const getAnalytics = onCall<{
  organizationId: string;
  startDate:      string;
  endDate:        string;
}>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, startDate, endDate } = request.data;
  const db = admin.firestore();

  const snap = await db
    .collection("organizations").doc(organizationId)
    .collection("analytics")
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .orderBy("date", "asc")
    .get();

  return { analytics: snap.docs.map((d) => d.data()) };
});
