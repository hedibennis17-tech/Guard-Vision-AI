import * as admin from "firebase-admin";
admin.initializeApp();

// Triggers Firestore
export { onOrganizationCreated } from "./triggers/onOrganizationCreated";
export { onDetectionCreated }    from "./triggers/onDetectionCreated";
export { onNotificationCreated } from "./notifications/onNotificationCreated";

// Cameras
export { addCamera }                      from "./http/addCamera";
export { connectCamera, discoverCameras } from "./http/connectCamera";

// Streaming
export { startStream, stopStream } from "./http/startStream";

// Events
export { acknowledgeEvent } from "./http/acknowledgeEvent";

// Notifications
export { registerFcmToken, updateNotificationPrefs, markNotificationRead }
  from "./notifications/notificationPrefs";
