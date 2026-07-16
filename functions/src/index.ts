import * as admin from "firebase-admin";
admin.initializeApp();

export { onOrganizationCreated } from "./triggers/onOrganizationCreated";
export { onDetectionCreated }    from "./triggers/onDetectionCreated";
export { addCamera }             from "./http/addCamera";
export { connectCamera, discoverCameras } from "./http/connectCamera";
export { startStream, stopStream }        from "./http/startStream";
export { acknowledgeEvent }               from "./http/acknowledgeEvent";
