import * as admin from "firebase-admin";
admin.initializeApp();

// ── Triggers Firestore
export { onOrganizationCreated } from "./triggers/onOrganizationCreated";
export { onDetectionCreated }    from "./triggers/onDetectionCreated";

// ── Notifications
export { onNotificationCreated }                           from "./notifications/onNotificationCreated";
export { registerFcmToken, updateNotificationPrefs, markNotificationRead } from "./notifications/notificationPrefs";

// ── Cameras
export { addCamera }                      from "./http/addCamera";
export { connectCamera, discoverCameras } from "./http/connectCamera";

// ── Streaming
export { startStream, stopStream } from "./http/startStream";

// ── Events
export { acknowledgeEvent } from "./http/acknowledgeEvent";

// ── Reports (Phase 8)
export { generateReport, scheduleDailyReports, scheduleWeeklyReports, scheduleMonthlyReports }
  from "./reports/generateReport";
