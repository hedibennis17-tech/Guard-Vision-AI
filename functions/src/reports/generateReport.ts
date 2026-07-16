import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

/**
 * generateReport — Phase 8
 * Déclenche la génération d'un rapport en appelant le service Python AI Engine.
 * Le service génère le PDF, l'uploade dans Storage et crée le ReportDoc Firestore.
 */

interface GenerateReportInput {
  organizationId: string;
  periodStart:    string;
  periodEnd:      string;
  cadence?:       "daily" | "weekly" | "monthly" | "on_demand";
}

export const generateReport = onCall<GenerateReportInput>(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Authentification requise.");

  const { organizationId, periodStart, periodEnd, cadence = "on_demand" } = request.data;
  if (!organizationId || !periodStart || !periodEnd) {
    throw new HttpsError("invalid-argument", "organizationId, periodStart et periodEnd sont requis.");
  }

  const db = admin.firestore();

  // Vérifier membership
  const memberSnap = await db
    .collection("organizations").doc(organizationId)
    .collection("members").doc(request.auth.uid)
    .get();

  if (!memberSnap.exists || !["owner", "admin", "manager"].includes(memberSnap.data()?.role)) {
    throw new HttpsError("permission-denied", "Rôle insuffisant.");
  }

  // Appeler le service Python AI Engine
  const aiEngineUrl = process.env.AI_ENGINE_URL ?? "http://localhost:8000";

  try {
    const response = await fetch(`${aiEngineUrl}/reports/generate`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        organization_id: organizationId,
        period_start:    periodStart,
        period_end:      periodEnd,
        cadence,
        generated_by:    request.auth.uid,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Engine HTTP ${response.status}`);
    }

    const result: any = await response.json();
    return { success: true, reportId: result.report_id, status: "generating" };
  } catch (err: any) {
    console.error("Erreur appel AI Engine:", err.message);
    // Fallback : créer un ReportDoc "pending" en attendant
    const reportRef = db
      .collection("organizations").doc(organizationId)
      .collection("reports").doc();

    const now = new Date().toISOString();
    await reportRef.set({
      id:             reportRef.id,
      organizationId,
      cadence,
      format:         "pdf",
      periodStart,
      periodEnd,
      fileUrl:        "",
      status:         "pending",
      generatedBy:    request.auth.uid,
      createdAt:      now,
    });

    return { success: true, reportId: reportRef.id, status: "pending" };
  }
});

/**
 * scheduleReports — Génère automatiquement les rapports planifiés.
 * Tourne 3 fois par jour à minuit UTC pour couvrir tous les fuseaux horaires.
 */
export const scheduleDailyReports = onSchedule("0 0 * * *", async () => {
  await _generateScheduledReports("daily");
});

export const scheduleWeeklyReports = onSchedule("0 0 * * 1", async () => {
  await _generateScheduledReports("weekly");
});

export const scheduleMonthlyReports = onSchedule("0 0 1 * *", async () => {
  await _generateScheduledReports("monthly");
});

async function _generateScheduledReports(cadence: "daily" | "weekly" | "monthly") {
  const db  = admin.firestore();
  const now = new Date();

  let periodStart: Date;
  if (cadence === "daily") {
    periodStart = new Date(now); periodStart.setDate(now.getDate() - 1);
  } else if (cadence === "weekly") {
    periodStart = new Date(now); periodStart.setDate(now.getDate() - 7);
  } else {
    periodStart = new Date(now); periodStart.setMonth(now.getMonth() - 1);
  }

  // Récupérer toutes les organisations actives
  const orgsSnap = await db.collection("organizations").get();
  const aiEngineUrl = process.env.AI_ENGINE_URL ?? "http://localhost:8000";

  const promises = orgsSnap.docs.map(async (orgDoc) => {
    try {
      await fetch(`${aiEngineUrl}/reports/generate`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          organization_id: orgDoc.id,
          period_start:    periodStart.toISOString(),
          period_end:      now.toISOString(),
          cadence,
          generated_by:    "system",
        }),
      });
    } catch (err: any) {
      console.error(`Erreur rapport ${cadence} pour org ${orgDoc.id}:`, err.message);
    }
  });

  await Promise.allSettled(promises);
  console.log(JSON.stringify({
    module: "scheduleReports", cadence,
    orgs: orgsSnap.size, ts: now.toISOString(),
  }));
}
