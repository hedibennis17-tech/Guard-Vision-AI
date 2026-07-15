// Config Firebase partagée entre apps/dashboard et apps/user-app.
// Les valeurs réelles seront fournies via variables d'environnement
// (NEXT_PUBLIC_FIREBASE_*) une fois le projet Firestore/Storage communiqué.

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

export function assertFirebaseConfigured() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[VisionGuard] Config Firebase incomplète. Variables manquantes: ${missing.join(", ")}`
    );
  }
}
