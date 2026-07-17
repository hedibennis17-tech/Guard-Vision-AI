"use client";

import {
  createContext, useContext, useEffect, useState,
  type ReactNode, useCallback,
} from "react";
import {
  collection, query, where, onSnapshot,
  doc, getDoc, type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/lib/hooks/useAuth";
import type { OrganizationDoc, MembershipDoc, SubscriptionDoc } from "@visionguard/shared";

interface OrgContext {
  organizations:    OrganizationDoc[];
  currentOrg:       OrganizationDoc | null;
  subscription:     SubscriptionDoc | null;
  membership:       MembershipDoc   | null;
  loading:          boolean;
  switchOrg:        (orgId: string) => void;
}

const OrganizationContext = createContext<OrgContext>({
  organizations: [], currentOrg: null, subscription: null,
  membership: null, loading: true, switchOrg: () => {},
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  // `authLoading` est CRUCIAL : au rechargement de la page, Firebase met un
  // court instant à restaurer la session. Pendant ce temps `user` vaut `null`
  // SANS que l'utilisateur soit réellement déconnecté. Si on traite ce `null`
  // transitoire comme "pas d'utilisateur", on conclut à tort "aucune donnée"
  // et tout disparaît après un refresh.
  const { user, loading: authLoading } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationDoc[]>([]);
  const [currentOrgId,  setCurrentOrgId]  = useState<string | null>(null);
  const [subscription,  setSubscription]  = useState<SubscriptionDoc | null>(null);
  const [membership,    setMembership]    = useState<MembershipDoc | null>(null);
  const [loading,       setLoading]       = useState(true);

  // Charger l'organisation de l'utilisateur courant
  useEffect(() => {
    // Tant que l'auth n'est pas résolue, on RESTE en chargement et on ne
    // touche à rien : impossible de savoir encore s'il y a un utilisateur.
    if (authLoading) { setLoading(true); return; }

    // Auth résolue, réellement aucun utilisateur : on peut vider proprement.
    if (!user) { setOrganizations([]); setCurrentOrgId(null); setLoading(false); return; }

    // Utilisateur présent : on repart en chargement le temps de résoudre l'org.
    let cancelled = false;
    setLoading(true);

    getDoc(doc(db, "users", user.uid)).then(async (userSnap) => {
      const userData = userSnap.data();
      if (!userData?.defaultOrganizationId) {
        if (!cancelled) setLoading(false);
        return;
      }

      const orgSnap = await getDoc(doc(db, "organizations", userData.defaultOrganizationId));
      if (!cancelled && orgSnap.exists()) {
        const orgData = { id: orgSnap.id, ...orgSnap.data() } as OrganizationDoc;
        setOrganizations([orgData]);
        setCurrentOrgId(orgData.id);
      }
      if (!cancelled) setLoading(false);
    }).catch((err) => {
      console.error("[v0] OrganizationContext load error:", err);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user, authLoading]);

  // Écouter l'abonnement et le membership de l'org courante
  useEffect(() => {
    if (!currentOrgId || !user) return;

    const subUnsub = onSnapshot(
      query(collection(db, "subscriptions"), where("organizationId", "==", currentOrgId)),
      (snap) => {
        if (!snap.empty) setSubscription(snap.docs[0].data() as SubscriptionDoc);
      }
    );

    const memUnsub = onSnapshot(
      doc(db, "organizations", currentOrgId, "members", user.uid),
      (snap) => {
        if (snap.exists()) setMembership(snap.data() as MembershipDoc);
      }
    );

    return () => { subUnsub(); memUnsub(); };
  }, [currentOrgId, user]);

  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
  }, []);

  const currentOrg = organizations.find((o) => o.id === currentOrgId) ?? null;

  return (
    <OrganizationContext.Provider value={{
      organizations, currentOrg, subscription, membership, loading, switchOrg,
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization(): OrgContext {
  return useContext(OrganizationContext);
}
