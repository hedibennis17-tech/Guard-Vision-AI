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
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationDoc[]>([]);
  const [currentOrgId,  setCurrentOrgId]  = useState<string | null>(null);
  const [subscription,  setSubscription]  = useState<SubscriptionDoc | null>(null);
  const [membership,    setMembership]    = useState<MembershipDoc | null>(null);
  const [loading,       setLoading]       = useState(true);

  // Écouter les organisations dont l'utilisateur est membre
  useEffect(() => {
    if (!user) { setOrganizations([]); setLoading(false); return; }

    // Écoute les memberships actifs de cet utilisateur
    // (collectionGroup query — nécessite l'index Firestore correspondant)
    const unsubs: Unsubscribe[] = [];

    const memberQuery = query(
      collection(db, "organizations"),
      // Note: en production, on requête via collectionGroup("members")
      // Pour Phase 1, on charge l'org du defaultOrganizationId de l'utilisateur
    );

    // Charger depuis le profil utilisateur pour commencer
    getDoc(doc(db, "users", user.uid)).then(async (userSnap) => {
      const userData = userSnap.data();
      if (!userData?.defaultOrganizationId) { setLoading(false); return; }

      const orgSnap = await getDoc(doc(db, "organizations", userData.defaultOrganizationId));
      if (orgSnap.exists()) {
        const orgData = { id: orgSnap.id, ...orgSnap.data() } as OrganizationDoc;
        setOrganizations([orgData]);
        setCurrentOrgId(orgData.id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    return () => unsubs.forEach((u) => u());
  }, [user]);

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
