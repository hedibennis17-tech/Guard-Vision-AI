"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  doc, setDoc, getDoc, collection, getDocs, deleteDoc,
} from "firebase/firestore";
import {
  ref, uploadBytes, getDownloadURL, deleteObject,
} from "firebase/storage";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, storage, auth } from "@/lib/firebase/client";

type CheckStatus = "pending" | "running" | "ok" | "error" | "warning";

interface Check {
  id:      string;
  label:   string;
  status:  CheckStatus;
  detail:  string;
  fix?:    string;
  fixUrl?: string;
  ms?:     number;
}

const INITIAL_CHECKS: Check[] = [
  { id:"env",        label:"Variables d'environnement Firebase", status:"pending", detail:"" },
  { id:"auth",       label:"Firebase Auth (Email/Password activé)", status:"pending", detail:"" },
  { id:"auth_write", label:"Création de compte test",             status:"pending", detail:"" },
  { id:"firestore_r",label:"Firestore — lecture",                  status:"pending", detail:"" },
  { id:"firestore_w",label:"Firestore — écriture",                 status:"pending", detail:"" },
  { id:"storage_w",  label:"Firebase Storage — upload",            status:"pending", detail:"" },
  { id:"camera_save",label:"Enregistrement caméra",                status:"pending", detail:"" },
  { id:"detection",  label:"Écriture détection Firestore",         status:"pending", detail:"" },
  { id:"event",      label:"Création Event",                       status:"pending", detail:"" },
  { id:"notif",      label:"Création Notification",                status:"pending", detail:"" },
];

export default function DiagnosticPage() {
  const [checks,   setChecks]   = useState<Check[]>(INITIAL_CHECKS);
  const [running,  setRunning]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [orgId,    setOrgId]    = useState<string|null>(null);
  const [camId,    setCamId]    = useState<string|null>(null);

  const update = useCallback((id: string, patch: Partial<Check>) => {
    setChecks((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c));
  }, []);

  async function runAll() {
    setRunning(true);
    setDone(false);
    setChecks(INITIAL_CHECKS.map((c) => ({ ...c, status:"pending", detail:"" })));

    let testOrgId   = orgId;
    let testCamId   = camId;
    let testUid: string | null = null;

    // ── 1. Variables d'environnement ──────────────────────────────────
    update("env", { status:"running", detail:"Vérification..." });
    const required = ["NEXT_PUBLIC_FIREBASE_API_KEY","NEXT_PUBLIC_FIREBASE_PROJECT_ID",
                      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET","NEXT_PUBLIC_FIREBASE_APP_ID"];
    // Les variables NEXT_PUBLIC sont disponibles côté client
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length === 0) {
      update("env", { status:"ok", detail:`Projet: ai-guard-vision-8ef41` });
    } else {
      update("env", { status:"error", detail:`Manquantes: ${missing.join(", ")}`,
        fix:"Vercel → Settings → Environment Variables → ajouter les 6 NEXT_PUBLIC_FIREBASE_*" });
    }

    // ── 2. Firebase Auth ─────────────────────────────────────────────
    update("auth", { status:"running" });
    try {
      const apiKey = "AIzaSyDD6PtkDgyIFBps2HoDBZAcSQSa9lMTzEE";
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
        { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" }
      );
      const data = await res.json();
      const errMsg = data?.error?.message ?? "";
      if (errMsg === "OPERATION_NOT_ALLOWED") {
        update("auth", { status:"error",
          detail:"Email/Password n'est pas activé.",
          fix:"Firebase Console → Authentication → Sign-in method → Email/Password → Enable",
          fixUrl:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/authentication/providers",
        });
      } else {
        update("auth", { status:"ok", detail:"Firebase Auth opérationnel." });
      }
    } catch (e: any) {
      update("auth", { status:"error", detail:e.message });
    }

    // ── 3. Créer un compte test (ou utiliser le compte actuel) ──────
    update("auth_write", { status:"running" });
    const t0 = Date.now();
    try {
      const user = auth.currentUser;
      if (user) {
        testUid = user.uid;
        update("auth_write", { status:"ok", detail:`Connecté: ${user.email}`, ms: Date.now()-t0 });
      } else {
        // Essayer de créer un compte test temporaire
        const testEmail    = `test-${Date.now()}@visionguard-diagnostic.ai`;
        const testPassword = "DiagnosticTest123!";
        const cred = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
        testUid = cred.user.uid;
        update("auth_write", { status:"ok", detail:`Compte test créé: ${testEmail}`, ms: Date.now()-t0 });
      }
    } catch (e: any) {
      update("auth_write", { status:"error", detail:e.message, ms: Date.now()-t0,
        fix:"Vérifiez que Email/Password est activé dans Firebase Auth.",
      });
      setRunning(false); setDone(true); return;
    }

    // ── 4. Firestore lecture ─────────────────────────────────────────
    update("firestore_r", { status:"running" });
    const t1 = Date.now();
    try {
      const snap = await getDoc(doc(db, "plans", "free"));
      update("firestore_r", { status:"ok",
        detail: snap.exists() ? `Doc 'plans/free' lu (${snap.data()?.name})` : "Firestore accessible (doc vide)",
        ms: Date.now()-t1 });
    } catch (e: any) {
      const isPermission = e.code === "permission-denied";
      update("firestore_r", { status:"error", detail:e.message, ms: Date.now()-t1,
        fix: isPermission
          ? "Firestore Console → Rules → allow read, write: if request.auth != null;"
          : "Vérifiez que Firestore est activé.",
        fixUrl: isPermission
          ? "https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/rules"
          : undefined,
      });
    }

    // ── 5. Firestore écriture ────────────────────────────────────────
    update("firestore_w", { status:"running" });
    const t2 = Date.now();
    const diagId = `diag-${Date.now()}`;
    try {
      if (!testOrgId) {
        // Créer une organisation de test
        testOrgId = `org-diag-${Date.now()}`;
        const now = new Date().toISOString();
        await setDoc(doc(db, "organizations", testOrgId), {
          id:testOrgId, name:"Test Diagnostic", ownerId:testUid!,
          subscriptionId:"sub-test", vertical:"home",
          createdAt:now, updatedAt:now,
        });
        // Membership
        await setDoc(doc(db, "organizations", testOrgId, "members", testUid!), {
          userId:testUid!, organizationId:testOrgId, role:"owner", status:"active",
          createdAt:now,
        });
        // Subscription
        await setDoc(doc(db, "subscriptions", `sub-${testOrgId}`), {
          id:`sub-${testOrgId}`, organizationId:testOrgId, planId:"free", status:"trialing",
          currentCameraCount:0, currentSiteCount:0, currentUserCount:1,
          createdAt:now, updatedAt:now,
        });
        // User profile
        await setDoc(doc(db, "users", testUid!), {
          id:testUid!, email:auth.currentUser?.email,
          defaultOrganizationId:testOrgId, createdAt:now,
        }, { merge:true });
        setOrgId(testOrgId);
      }
      // Test write
      await setDoc(doc(db, "_diagnostic", diagId), { test:true, ts:new Date().toISOString() });
      await deleteDoc(doc(db, "_diagnostic", diagId));
      update("firestore_w", { status:"ok", detail:`Écriture OK · Org créée: ${testOrgId.slice(0,16)}...`, ms: Date.now()-t2 });
    } catch (e: any) {
      const isPermission = e.code === "permission-denied";
      update("firestore_w", { status:"error", detail:e.message, ms: Date.now()-t2,
        fix: isPermission ? "Firestore → Rules → allow read, write: if request.auth != null;" : e.message,
        fixUrl: "https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/rules",
      });
      setRunning(false); setDone(true); return;
    }

    // ── 6. Storage upload ────────────────────────────────────────────
    update("storage_w", { status:"running" });
    const t3 = Date.now();
    try {
      const testBlob = new Blob(["VisionGuard diagnostic test"], { type:"text/plain" });
      const testRef  = ref(storage, `_diagnostic/${diagId}.txt`);
      await uploadBytes(testRef, testBlob);
      await getDownloadURL(testRef);
      await deleteObject(testRef).catch(() => {});
      update("storage_w", { status:"ok", detail:"Upload + Download OK.", ms: Date.now()-t3 });
    } catch (e: any) {
      const isPermission = e.code === "storage/unauthorized";
      update("storage_w", { status:"error", detail:e.message, ms: Date.now()-t3,
        fix: isPermission
          ? "Storage Console → Rules → allow read, write: if request.auth != null;"
          : "Activez Firebase Storage dans la Console.",
        fixUrl: isPermission
          ? "https://console.firebase.google.com/project/ai-guard-vision-8ef41/storage/rules"
          : "https://console.firebase.google.com/project/ai-guard-vision-8ef41/storage",
      });
      // Storage error n'est pas bloquant — on continue
    }

    // ── 7. Enregistrement caméra ─────────────────────────────────────
    update("camera_save", { status:"running" });
    const t4 = Date.now();
    try {
      const now   = new Date().toISOString();
      testCamId   = `cam-diag-${Date.now()}`;
      await setDoc(doc(db, "organizations", testOrgId!, "cameras", testCamId), {
        id:testCamId, organizationId:testOrgId!, siteId:"default",
        name:"Caméra Diagnostic", brand:"Test", model:"WebRTC",
        connector:"phone_webcam", status:"online", streamUrl:"webrtc://test",
        enabledDetectionTypes:["person","animal"], timezone:"America/Montreal",
        createdAt:now, updatedAt:now, createdBy:testUid!,
      });
      setCamId(testCamId);
      update("camera_save", { status:"ok",
        detail:`Caméra créée: ${testCamId.slice(0,16)}... dans org ${testOrgId!.slice(0,16)}...`,
        ms: Date.now()-t4 });
    } catch (e: any) {
      update("camera_save", { status:"error", detail:e.message, ms: Date.now()-t4,
        fix:"Vérifiez les règles Firestore.",
        fixUrl:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/rules",
      });
    }

    // ── 8. Écriture détection ────────────────────────────────────────
    update("detection", { status:"running" });
    const t5 = Date.now();
    const detId = `det-diag-${Date.now()}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, "organizations", testOrgId!, "detections", detId), {
        id:detId, organizationId:testOrgId!, cameraId:testCamId!, siteId:"default",
        type:"person", category:"human", label:"Personne", confidence:0.92,
        severity:"warning", source:"diagnostic",
        boundingBox:{ x:0.3, y:0.2, width:0.2, height:0.5 },
        snapshotUrl:null, detectedAt:now, createdAt:now,
      });
      update("detection", { status:"ok", detail:`Detection: ${detId.slice(0,16)}...`, ms: Date.now()-t5 });
    } catch (e: any) {
      update("detection", { status:"error", detail:e.message, ms: Date.now()-t5 });
    }

    // ── 9. Création Event ────────────────────────────────────────────
    update("event", { status:"running" });
    const t6 = Date.now();
    const evId = `ev-diag-${Date.now()}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, "organizations", testOrgId!, "events", evId), {
        id:evId, organizationId:testOrgId!, cameraId:testCamId!, siteId:"default",
        detectionIds:[detId], primaryType:"person", category:"human", label:"Personne",
        severity:"warning", durationSeconds:0, thumbnailUrl:null, videoClipUrl:null,
        acknowledged:false, createdAt:now, updatedAt:now,
      });
      update("event", { status:"ok", detail:`Event: ${evId.slice(0,16)}...`, ms: Date.now()-t6 });
    } catch (e: any) {
      update("event", { status:"error", detail:e.message, ms: Date.now()-t6 });
    }

    // ── 10. Notification ─────────────────────────────────────────────
    update("notif", { status:"running" });
    const t7 = Date.now();
    const notifId = `notif-diag-${Date.now()}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, "organizations", testOrgId!, "notifications", notifId), {
        id:notifId, organizationId:testOrgId!, userId:testUid!,
        eventId:evId, channel:"push",
        title:"⚠️ Test Diagnostic", body:"Notification de test Vision Guard.",
        severity:"warning", read:false, sentAt:null, createdAt:now,
      });
      update("notif", { status:"ok", detail:`Notification: ${notifId.slice(0,16)}...`, ms: Date.now()-t7 });
    } catch (e: any) {
      update("notif", { status:"error", detail:e.message, ms: Date.now()-t7 });
    }

    setRunning(false);
    setDone(true);
  }

  const allOk    = checks.every((c) => c.status === "ok");
  const hasError = checks.some((c)  => c.status === "error");

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">🔍 Diagnostic Vision Guard</h1>
          <p className="mt-1 text-sm text-slate-400">Tests en temps réel — module par module</p>
        </div>
        <Link href="/cameras" className="text-sm text-slate-400 hover:text-white">← Caméras</Link>
      </div>

      {/* Liens rapides Firebase Console */}
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="mb-3 text-xs font-semibold text-slate-400">LIENS RAPIDES — Firebase Console</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label:"Firestore Rules",    url:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/rules" },
            { label:"Storage Rules",      url:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/storage/rules" },
            { label:"Auth Providers",     url:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/authentication/providers" },
            { label:"Firestore Data",     url:"https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/data" },
          ].map((l) => (
            <a key={l.label} href={l.url} target="_blank"
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-brand hover:border-brand hover:bg-brand/10">
              {l.label} ↗
            </a>
          ))}
        </div>
      </div>

      {/* Bouton lancer */}
      <button
        onClick={runAll}
        disabled={running}
        className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 text-sm font-medium disabled:opacity-60"
      >
        {running
          ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Tests en cours...</>
          : done ? "🔄 Relancer les tests" : "▶ Lancer le diagnostic"}
      </button>

      {/* Résultats */}
      <div className="space-y-2">
        {checks.map((check) => (
          <div key={check.id}
            className={`rounded-xl border p-4 transition-all ${
              check.status === "ok"      ? "border-emerald-800/50 bg-emerald-900/10"
            : check.status === "error"  ? "border-red-800/50 bg-red-900/10"
            : check.status === "warning"? "border-amber-800/50 bg-amber-900/10"
            : check.status === "running"? "border-brand/50 bg-brand/5"
            : "border-slate-800 bg-slate-900"
            }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {/* Icône */}
                <span className="shrink-0 text-lg">
                  {check.status === "ok"       ? "✅"
                 : check.status === "error"    ? "❌"
                 : check.status === "warning"  ? "⚠️"
                 : check.status === "running"  ? "⟳"
                 : "○"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    check.status === "ok"    ? "text-emerald-300"
                  : check.status === "error" ? "text-red-300"
                  : "text-slate-200"
                  }`}>{check.label}</p>
                  {check.detail && (
                    <p className="mt-0.5 text-xs text-slate-500 break-words">{check.detail}</p>
                  )}
                  {check.fix && (
                    <div className="mt-2 rounded-lg bg-amber-900/20 border border-amber-800/40 px-3 py-2">
                      <p className="text-xs text-amber-300">🔧 Fix : {check.fix}</p>
                      {check.fixUrl && (
                        <a href={check.fixUrl} target="_blank"
                          className="mt-1 inline-block text-xs text-brand underline">
                          Ouvrir dans Firebase Console ↗
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {check.ms !== undefined && (
                <span className="shrink-0 text-xs text-slate-600">{check.ms}ms</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Résumé final */}
      {done && (
        <div className={`mt-6 rounded-xl border p-5 text-center ${
          allOk ? "border-emerald-800 bg-emerald-900/10" : "border-red-800 bg-red-900/10"
        }`}>
          {allOk ? (
            <>
              <p className="text-lg font-semibold text-emerald-400">✅ Tout fonctionne !</p>
              <p className="mt-1 text-sm text-slate-400">
                Firebase Auth · Firestore · Storage · Caméra · Détection · Event · Notification
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <Link href="/cameras/phone" className="rounded-lg bg-brand px-5 py-2 text-sm font-medium">
                  📱 Tester la caméra →
                </Link>
                <Link href="/events" className="rounded-lg border border-slate-700 px-5 py-2 text-sm text-slate-300">
                  🚨 Voir les events
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-red-400">
                {checks.filter(c=>c.status==="error").length} problème(s) détecté(s)
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Suivez les fixes en rouge ci-dessus, puis relancez le diagnostic.
              </p>
              <div className="mt-4">
                <a href="https://console.firebase.google.com/project/ai-guard-vision-8ef41/firestore/rules"
                  target="_blank"
                  className="inline-block rounded-lg bg-red-800 px-5 py-2 text-sm font-medium text-white">
                  🔧 Ouvrir Firebase Console →
                </a>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
