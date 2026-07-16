import { doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";

export interface SetupStatus {
  authenticated:   boolean;
  hasOrganization: boolean;
  hasCamera:       boolean;
  organizationId?: string;
  organizationName?: string;
  error?:          string;
}

export async function checkSetup(): Promise<SetupStatus> {
  const user = auth.currentUser ?? await waitForAuth();
  if (!user) return { authenticated:false, hasOrganization:false, hasCamera:false };

  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    const orgId    = userSnap.data()?.defaultOrganizationId;
    if (!orgId) return { authenticated:true, hasOrganization:false, hasCamera:false };

    const orgSnap = await getDoc(doc(db, "organizations", orgId));
    if (!orgSnap.exists()) return { authenticated:true, hasOrganization:false, hasCamera:false };

    const camsSnap = await getDocs(collection(db, "organizations", orgId, "cameras"));

    return {
      authenticated:   true,
      hasOrganization: true,
      hasCamera:       camsSnap.size > 0,
      organizationId:  orgId,
      organizationName: orgSnap.data()?.name,
    };
  } catch (err: any) {
    // Firestore rules bloquent → montrer l'erreur précise
    return {
      authenticated: !!user,
      hasOrganization: false,
      hasCamera: false,
      error: `Firestore: ${err.code ?? err.message}. Vérifiez les règles dans la Console Firebase.`,
    };
  }
}

/** Attend que Firebase Auth soit initialisé (évite le bug currentUser=null au démarrage) */
async function waitForAuth() {
  const { onAuthStateChanged } = await import("firebase/auth");
  return new Promise<import("firebase/auth").User | null>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function quickSetup(organizationName: string = "Ma maison"): Promise<{ organizationId:string }> {
  const user = auth.currentUser ?? await waitForAuth();
  if (!user) throw new Error("Non connecté — connectez-vous d'abord. (→ /login)");

  const now   = new Date().toISOString();
  const orgId = doc(collection(db, "organizations")).id;
  const subId = doc(collection(db, "subscriptions")).id;

  try {
    await setDoc(doc(db, "organizations", orgId), {
      id:orgId, name:organizationName,
      slug: organizationName.toLowerCase().replace(/\s+/g,"-"),
      ownerId:user.uid, vertical:"home", subscriptionId:subId,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt:now, updatedAt:now, createdBy:user.uid,
    });
    await setDoc(doc(db, "subscriptions", subId), {
      id:subId, organizationId:orgId, planId:"free", status:"trialing",
      currentCameraCount:0, currentSiteCount:0, currentUserCount:1,
      trialEndsAt: new Date(Date.now()+14*86400000).toISOString(),
      createdAt:now, updatedAt:now,
    });
    await setDoc(doc(db, "organizations", orgId, "members", user.uid), {
      userId:user.uid, organizationId:orgId, role:"owner", status:"active",
      joinedAt:now, createdAt:now,
    });
    await setDoc(doc(db, "organizations", orgId, "sites", "default"), {
      id:"default", organizationId:orgId, name:"Site principal",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, createdAt:now,
    });
    await setDoc(doc(db, "users", user.uid), {
      id:user.uid, email:user.email,
      displayName: user.displayName ?? user.email?.split("@")[0],
      defaultOrganizationId:orgId, createdAt:now, lastLoginAt:now,
    }, { merge:true });

    return { organizationId: orgId };
  } catch (err: any) {
    if (err.code === "permission-denied") {
      throw new Error(
        "Permission refusée par Firestore.\n\n" +
        "→ Allez sur Firebase Console → Firestore → Rules\n" +
        "→ Remplacez les règles par : allow read, write: if request.auth != null;\n" +
        "→ Cliquez Publish, puis réessayez."
      );
    }
    throw err;
  }
}

export async function createCameraDirectly(input: {
  organizationId: string;
  name:  string;
  brand: string;
  connector: string;
  timezone: string;
}): Promise<string> {
  const user = auth.currentUser ?? await waitForAuth();
  if (!user) throw new Error("Non connecté.");

  const now = new Date().toISOString();
  const cameraId = doc(collection(db, "organizations", input.organizationId, "cameras")).id;

  try {
    await setDoc(doc(db, "organizations", input.organizationId, "cameras", cameraId), {
      id:cameraId, organizationId:input.organizationId, siteId:"default",
      name:input.name, brand:input.brand, model:"WebRTC Browser",
      connector:input.connector,
      status:"online", streamUrl:"webrtc://browser", streamProtocol:"webrtc",
      enabledDetectionTypes:["person","vehicle","animal","fire","smoke","retail_item","tool"],
      timezone:input.timezone, location:"Caméra navigateur",
      createdAt:now, updatedAt:now, createdBy:user.uid,
    });
    return cameraId;
  } catch (err: any) {
    if (err.code === "permission-denied") {
      throw new Error(
        "Permission refusée.\n\n" +
        "Firestore Console → Rules → Publiez :\n" +
        "allow read, write: if request.auth != null;"
      );
    }
    throw new Error(`Erreur Firebase: ${err.message}`);
  }
}
