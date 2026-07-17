"use client";

import {
  createContext, useContext, useEffect, useState, type ReactNode,
} from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut as firebaseSignOut,
  sendPasswordResetEmail, updateProfile, type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

// ── Super Admins ─────────────────────────────────────────────────────────────
const SUPER_ADMINS = [
  "hedibennis17@gmail.com",
];

export type GlobalRole = "super_admin" | "user";

export interface UserProfile {
  uid:                   string;
  email:                 string;
  displayName:           string;
  photoURL?:             string;
  globalRole:            GlobalRole;
  defaultOrganizationId?: string;
  createdAt:             string;
  lastLoginAt:           string;
}

interface AuthContextValue {
  user:        User | null;
  profile:     UserProfile | null;
  loading:     boolean;
  isSuperAdmin: boolean;
  signIn:      (email: string, password: string) => Promise<void>;
  signUp:      (email: string, password: string, name: string) => Promise<void>;
  signOut:     () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  error:       string | null;
  clearError:  () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Cookie pour le middleware
        document.cookie = `__session=${await firebaseUser.getIdToken()}; path=/; SameSite=Lax`;
        await loadOrCreateProfile(firebaseUser);
      } else {
        document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function loadOrCreateProfile(firebaseUser: User) {
    const isSA    = SUPER_ADMINS.includes(firebaseUser.email ?? "");
    const userRef = doc(db, "users", firebaseUser.uid);

    try {
      const snap = await getDoc(userRef);
      const now  = new Date().toISOString();

      if (snap.exists()) {
        const data = snap.data();
        const p: UserProfile = {
          uid:                   firebaseUser.uid,
          email:                 firebaseUser.email ?? "",
          displayName:           firebaseUser.displayName ?? data.displayName ?? "Utilisateur",
          photoURL:              firebaseUser.photoURL ?? undefined,
          globalRole:            isSA ? "super_admin" : (data.globalRole ?? "user"),
          defaultOrganizationId: data.defaultOrganizationId,
          createdAt:             data.createdAt ?? now,
          lastLoginAt:           now,
        };
        await setDoc(userRef, { lastLoginAt:now, globalRole:p.globalRole }, { merge:true });
        setProfile(p);
      } else {
        // Nouveau profil
        const p: UserProfile = {
          uid:          firebaseUser.uid,
          email:        firebaseUser.email ?? "",
          displayName:  firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "Utilisateur",
          globalRole:   isSA ? "super_admin" : "user",
          createdAt:    new Date().toISOString(),
          lastLoginAt:  new Date().toISOString(),
        };
        await setDoc(userRef, p);
        setProfile(p);
      }
    } catch {
      // Fallback si Firestore inaccessible
      setProfile({
        uid:         firebaseUser.uid,
        email:       firebaseUser.email ?? "",
        displayName: firebaseUser.displayName ?? "Utilisateur",
        globalRole:  isSA ? "super_admin" : "user",
        createdAt:   new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
    }
  }

  function translateError(code: string): string {
    const msgs: Record<string, string> = {
      "auth/invalid-email":          "Adresse email invalide.",
      "auth/user-disabled":          "Ce compte a été désactivé.",
      "auth/user-not-found":         "Aucun compte trouvé avec cet email.",
      "auth/wrong-password":         "Mot de passe incorrect.",
      "auth/invalid-credential":     "Email ou mot de passe incorrect.",
      "auth/email-already-in-use":   "Cet email est déjà utilisé.",
      "auth/weak-password":          "Mot de passe trop faible (minimum 6 caractères).",
      "auth/network-request-failed": "Erreur réseau — vérifiez votre connexion.",
      "auth/too-many-requests":      "Trop de tentatives — réessayez dans quelques minutes.",
    };
    return msgs[code] ?? `Erreur: ${code}`;
  }

  async function signIn(email: string, password: string) {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(translateError(err.code));
      throw err;
    }
  }

  async function signUp(email: string, password: string, name: string) {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
    } catch (err: any) {
      setError(translateError(err.code));
      throw err;
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
    document.cookie = "__session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }

  async function resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      setError(translateError(err.code));
      throw err;
    }
  }

  const isSuperAdmin = profile?.globalRole === "super_admin";

  return (
    <AuthContext.Provider value={{
      user, profile, loading, isSuperAdmin,
      signIn, signUp, signOut, resetPassword,
      error, clearError: () => setError(null),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
