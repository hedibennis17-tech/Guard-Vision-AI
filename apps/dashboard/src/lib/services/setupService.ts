/**
 * setupService — Organisation stable basée sur l'UID utilisateur
 * RÈGLE : org-{uid} = une seule org réelle par user. Fini les org-diag-*.
 */
import { doc, setDoc, getDoc, collection, getDocs, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase/client";

export interface SetupStatus {
  authenticated:boolean; hasOrganization:boolean; hasCamera:boolean;
  organizationId?:string; organizationName?:string; error?:string;
}

export async function waitForAuth() {
  if (auth.currentUser) return auth.currentUser;
  const { onAuthStateChanged } = await import("firebase/auth");
  return new Promise<import("firebase/auth").User|null>((resolve)=>{
    const u = onAuthStateChanged(auth,(user)=>{ u(); resolve(user); });
  });
}

/** Trouve l'org réelle de l'utilisateur — priorité org-{uid} */
export async function checkSetup(): Promise<SetupStatus> {
  const user = auth.currentUser ?? await waitForAuth();
  if (!user) return { authenticated:false, hasOrganization:false, hasCamera:false };

  try {
    // 1. Org stable basée sur uid
    const stableId = `org-${user.uid}`;
    const stable   = await getDoc(doc(db,"organizations",stableId));
    if (stable.exists()) {
      const cams = await getDocs(collection(db,"organizations",stableId,"cameras"));
      await setDoc(doc(db,"users",user.uid),{ defaultOrganizationId:stableId },{ merge:true });
      return { authenticated:true, hasOrganization:true, hasCamera:cams.size>0,
               organizationId:stableId, organizationName:stable.data()?.name };
    }

    // 2. defaultOrganizationId du profil (si non-diag)
    const userSnap   = await getDoc(doc(db,"users",user.uid));
    const savedOrgId = userSnap.data()?.defaultOrganizationId;
    if (savedOrgId && !savedOrgId.includes("diag")) {
      const orgSnap = await getDoc(doc(db,"organizations",savedOrgId));
      if (orgSnap.exists()) {
        const cams = await getDocs(collection(db,"organizations",savedOrgId,"cameras"));
        return { authenticated:true, hasOrganization:true, hasCamera:cams.size>0,
                 organizationId:savedOrgId, organizationName:orgSnap.data()?.name };
      }
    }

    // 3. Scanner les orgs membres (fallback)
    const all = await getDocs(collection(db,"organizations"));
    for (const o of all.docs) {
      const n = o.data()?.name ?? "";
      if (o.id.includes("diag")||n.toLowerCase().includes("diagnostic")||n.toLowerCase().includes("test")) continue;
      const mem = await getDoc(doc(db,"organizations",o.id,"members",user.uid));
      if (!mem.exists()) continue;
      const cams = await getDocs(collection(db,"organizations",o.id,"cameras"));
      await setDoc(doc(db,"users",user.uid),{ defaultOrganizationId:o.id },{ merge:true });
      return { authenticated:true, hasOrganization:true, hasCamera:cams.size>0,
               organizationId:o.id, organizationName:o.data()?.name };
    }

    return { authenticated:true, hasOrganization:false, hasCamera:false };
  } catch(err:any) {
    return { authenticated:!!user, hasOrganization:false, hasCamera:false,
             error:`Firestore: ${err.code??err.message}` };
  }
}

/**
 * Crée ou retourne l'org stable → ID fixe = org-{uid}
 * Idempotent : appels multiples = même org, jamais de doublon
 */
export async function quickSetup(orgName="Ma maison"): Promise<{ organizationId:string }> {
  const user = auth.currentUser ?? await waitForAuth();
  if (!user) throw new Error("Non connecté.");

  const stableId = `org-${user.uid}`;
  const now = new Date().toISOString();

  // Si déjà créé → retourner directement
  const existing = await getDoc(doc(db,"organizations",stableId));
  if (existing.exists()) {
    await setDoc(doc(db,"users",user.uid),{ defaultOrganizationId:stableId },{ merge:true });
    return { organizationId:stableId };
  }

  try {
    await setDoc(doc(db,"organizations",stableId),{
      id:stableId, name:orgName,
      slug:orgName.toLowerCase().replace(/\s+/g,"-"),
      ownerId:user.uid, vertical:"home",
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt:now, updatedAt:now, createdBy:user.uid,
    });
    await setDoc(doc(db,"organizations",stableId,"members",user.uid),{
      userId:user.uid, organizationId:stableId, role:"owner",
      status:"active", joinedAt:now, createdAt:now,
    });
    await setDoc(doc(db,"organizations",stableId,"sites","default"),{
      id:"default", organizationId:stableId, name:"Site principal",
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone, createdAt:now,
    });
    await setDoc(doc(db,"users",user.uid),{
      id:user.uid, email:user.email,
      displayName:user.displayName ?? user.email?.split("@")[0],
      defaultOrganizationId:stableId, createdAt:now, lastLoginAt:now,
    },{ merge:true });

    return { organizationId:stableId };
  } catch(err:any) {
    if (err.code==="permission-denied")
      throw new Error("Permission refusée → Firebase Console → Firestore → Rules → allow read, write: if request.auth != null;");
    throw err;
  }
}

/**
 * Crée une caméra (ou retourne l'existante si même nom)
 * ID stable = cam-{uid}-{slugName}
 */
export async function createCameraDirectly(input:{
  organizationId:string; name:string; brand:string;
  connector:string; timezone:string; location?:string;
}): Promise<string> {
  const user = auth.currentUser ?? await waitForAuth();
  if (!user) throw new Error("Non connecté.");

  const now = new Date().toISOString();

  // Réutiliser la caméra existante avec le même nom
  try {
    const cams = await getDocs(collection(db,"organizations",input.organizationId,"cameras"));
    const found = cams.docs.find(d=>d.data()?.name===input.name);
    if (found) {
      await updateDoc(found.ref,{ status:"online", updatedAt:now });
      return found.id;
    }
  } catch {}

  // ID stable basé sur le nom
  const slug = input.name.toLowerCase().replace(/[^a-z0-9]/g,"-").slice(0,20);
  const cameraId = `cam-${user.uid.slice(0,8)}-${slug}`;

  try {
    await setDoc(doc(db,"organizations",input.organizationId,"cameras",cameraId),{
      id:cameraId, organizationId:input.organizationId, siteId:"default",
      name:input.name, brand:input.brand, model:"WebRTC Browser",
      connector:input.connector, status:"online",
      streamUrl:"webrtc://browser", streamProtocol:"webrtc",
      location:input.location??input.name,
      enabledDetectionTypes:["person","vehicle","animal","fire","smoke","tool","ppe"],
      timezone:input.timezone,
      createdAt:now, updatedAt:now, createdBy:user.uid,
    });
    return cameraId;
  } catch(err:any) {
    if (err.code==="permission-denied")
      throw new Error("Permission refusée — vérifiez les règles Firestore.");
    throw new Error(`Erreur Firebase: ${err.message}`);
  }
}
