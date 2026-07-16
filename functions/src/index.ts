import * as admin from "firebase-admin";
admin.initializeApp();

export { onOrganizationCreated }  from "./triggers/onOrganizationCreated";
export { onDetectionCreated }     from "./triggers/onDetectionCreated";
export { onNotificationCreated }  from "./notifications/onNotificationCreated";
export { registerFcmToken, updateNotificationPrefs, markNotificationRead }
  from "./notifications/notificationPrefs";
export { addCamera }              from "./http/addCamera";
export { connectCamera, discoverCameras } from "./http/connectCamera";
export { startStream, stopStream }        from "./http/startStream";
export { acknowledgeEvent }               from "./http/acknowledgeEvent";
export { generateReport, scheduleDailyReports, scheduleWeeklyReports, scheduleMonthlyReports }
  from "./reports/generateReport";
export { scheduleAnalytics, getAnalytics } from "./analytics/scheduleAnalytics";
