import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth,       type Auth }            from "firebase/auth";
import { getFirestore,  type Firestore }        from "firebase/firestore";
import { getStorage,    type FirebaseStorage }  from "firebase/storage";
import { getFunctions,  type Functions }        from "firebase/functions";

// Projet Firebase : ai-guard-vision-8ef41
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "AIzaSyDD6PtkDgyIFBps2HoDBZAcSQSa9lMTzEE",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "ai-guard-vision-8ef41.firebaseapp.com",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "ai-guard-vision-8ef41",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "ai-guard-vision-8ef41.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "20746657019",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "1:20746657019:web:c34bf2ed6029eec99e645e",
};

const app: FirebaseApp  = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth:      Auth            = getAuth(app);
export const db:        Firestore       = getFirestore(app);
export const storage:   FirebaseStorage = getStorage(app);
export const functions: Functions       = getFunctions(app, "us-central1");

export default app;
