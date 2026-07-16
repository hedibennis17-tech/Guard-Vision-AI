"use client";

import { useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";

interface AuthState {
  user:        User | null;
  loading:     boolean;
  error:       string | null;
}

interface UseAuth extends AuthState {
  signIn:             (email: string, password: string) => Promise<void>;
  signUp:             (email: string, password: string, displayName: string) => Promise<void>;
  signOut:            () => Promise<void>;
  resetPassword:      (email: string) => Promise<void>;
  clearError:         () => void;
}

export function useAuth(): UseAuth {
  const [state, setState] = useState<AuthState>({
    user:    null,
    loading: true,
    error:   null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setState({ user, loading: false, error: null });
    });
    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setState((p) => ({ ...p, loading: true, error: null }));
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const msg = getAuthErrorMessage(err.code);
      setState((p) => ({ ...p, loading: false, error: msg }));
      throw new Error(msg);
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    try {
      setState((p) => ({ ...p, loading: true, error: null }));
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName });

      // Créer le UserDoc dans Firestore
      await setDoc(doc(db, "users", user.uid), {
        id:          user.uid,
        email:       user.email,
        displayName,
        createdAt:   new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      });
    } catch (err: any) {
      const msg = getAuthErrorMessage(err.code);
      setState((p) => ({ ...p, loading: false, error: msg }));
      throw new Error(msg);
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err: any) {
      throw new Error(getAuthErrorMessage(err.code));
    }
  }, []);

  const clearError = useCallback(() => {
    setState((p) => ({ ...p, error: null }));
  }, []);

  return { ...state, signIn, signUp, signOut, resetPassword, clearError };
}

function getAuthErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    "auth/user-not-found":        "Aucun compte avec cet email.",
    "auth/wrong-password":        "Mot de passe incorrect.",
    "auth/email-already-in-use":  "Cet email est déjà utilisé.",
    "auth/invalid-email":         "Email invalide.",
    "auth/weak-password":         "Mot de passe trop faible (min. 6 caractères).",
    "auth/too-many-requests":     "Trop de tentatives. Réessayez dans quelques minutes.",
    "auth/network-request-failed":"Erreur réseau. Vérifiez votre connexion.",
  };
  return messages[code] ?? "Une erreur est survenue. Veuillez réessayer.";
}
